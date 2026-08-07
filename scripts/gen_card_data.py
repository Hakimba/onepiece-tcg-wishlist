#!/usr/bin/env python3
"""Generate every card-data file under public/ from dotgg + limitlesstcg.

Outputs (all written to <repo>/public/, deterministic and sorted):
  variants-index.json — idcard -> {name, variants[{s,r,cs}]}   (dotgg)
  sp-index.json       — idcard -> image suffix for SP CARDs     (dotgg)
  set-names.json      — set code -> extension name              (limitless)
  set-lists.json      — set code -> authoritative card keys      (limitless)

Designed to run unattended from CI: every fetch is retried, and the run aborts
before writing anything if the upstream data looks degraded (see SanityError).
A partial write would be published straight to prod, so the guards are the point.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from html import unescape
from typing import Any, Iterable

DOTGG_URL = "https://api.dotgg.gg/cgfw/getcards?game=onepiece"
LIMITLESS_SETS_URL = "https://onepiece.limitlesstcg.com/cards"
LIMITLESS_SET_URL = "https://onepiece.limitlesstcg.com/cards/{slug}"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(REPO_ROOT, "public")

# Set families that aggregate reprints from other extensions. dotgg's CardSets
# field both over- and under-reports these (PRB01: 427 variants tagged vs 319
# actually in the set), so their card list is taken from limitless instead.
# Matching on the family rather than a literal list means PRB03 is covered the
# day it ships. Counts alone can't decide this: the deviation of PRB02 (5%) sits
# below that of several perfectly fine ST sets.
AUTHORITATIVE_SET_RE = re.compile(r"^PRB\d+$")

# Log sets whose dotgg count strays this far from limitless — not acted on, but
# a standing hint that a family may need adding above.
DEVIATION_REPORT_RATIO = 0.15

# Refuse to publish if the new data lost more than this fraction of the entries
# already committed. Catches an upstream outage returning a truncated payload.
MAX_SHRINK_RATIO = 0.10

USER_AGENT = "onepiece-wishlist-data-bot/1.0 (+https://github.com/Hakimba/onepiece-wishlist)"


class SanityError(RuntimeError):
    """Upstream data failed a guard — nothing is written."""


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------


def fetch(url: str, *, attempts: int = 3, timeout: int = 120) -> bytes:
    last: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            if i < attempts - 1:
                delay = 2 ** i
                log(f"  retry {i + 1}/{attempts - 1} in {delay}s ({url}): {exc}")
                time.sleep(delay)
    raise SanityError(f"fetch failed after {attempts} attempts: {url} ({last})")


def fetch_text(url: str, **kw: Any) -> str:
    return fetch(url, **kw).decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Set codes
# ---------------------------------------------------------------------------


def normalize(code: str) -> str:
    return code.replace("-", "").upper()


def codes_from_cs(cs: str) -> list[str]:
    """Mirror of SetCode.extractAllFromCs — keep both in sync."""
    bracketed = re.search(r"\[([A-Z0-9-]+)\]", cs or "")
    if bracketed:
        parts = re.findall(r"[A-Z]+\d+", bracketed.group(1))
        return [normalize(p) for p in (parts or [bracketed.group(1)])]
    bare = (cs or "").strip()
    return [normalize(bare)] if re.fullmatch(r"[A-Z]+\d*-?\d+", bare) else []


# ---------------------------------------------------------------------------
# dotgg — variants-index.json + sp-index.json
# ---------------------------------------------------------------------------


def load_dotgg() -> list[dict[str, Any]]:
    log("Fetching dotgg API...")
    data = json.loads(fetch(DOTGG_URL))
    if not isinstance(data, list):
        raise SanityError(f"dotgg returned {type(data).__name__}, expected a list")
    if not data:
        raise SanityError("dotgg returned an empty list")
    missing = [f for f in ("id", "id_normal", "name", "rarity") if f not in data[0]]
    if missing:
        raise SanityError(f"dotgg schema changed — missing fields: {missing}")
    log(f"  {len(data)} cards")
    return data


def group_by_normal(cards: Iterable[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for c in cards:
        groups[c.get("id_normal") or c["id"]].append(c)
    return groups


def build_variants_index(groups: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    index: dict[str, Any] = {}
    for idn in sorted(groups):
        variants = groups[idn]
        seen: set[str] = set()
        entries = []
        for c in sorted(variants, key=lambda c: c["id"]):
            suffix = c["id"][len(idn):] if c["id"] != idn else ""
            if suffix in seen:
                continue
            seen.add(suffix)
            # CardSets is absent or null on a handful of cards; the app expects a string.
            entries.append({"s": suffix, "r": c["rarity"], "cs": c.get("CardSets") or ""})
        index[idn] = {"name": variants[0]["name"], "variants": entries}
    return index


def build_sp_index(cards: Iterable[dict[str, Any]]) -> dict[str, str]:
    return {
        c["id_normal"]: c["id"][len(c["id_normal"]):]
        for c in sorted(cards, key=lambda c: c["id"])
        if c.get("rarity") == "SP CARD" and c["id"] != c["id_normal"]
    }


# ---------------------------------------------------------------------------
# limitless — set-names.json
# ---------------------------------------------------------------------------

SET_ROW_RE = re.compile(
    r"<td><a href=\"/cards/([^\"]+)\">([A-Z0-9-]+)</a></td>\s*"
    r"<td><a href=\"/cards/[^\"]+\">([^<]*)</a></td>",
)
CARD_COUNT_RE = re.compile(r"<td class=\"md-only\"><a href=\"/cards/[^\"]+\">\s*(\d+)")
TITLE_RE = re.compile(r"<title>\s*(.*?)\s*\(([A-Z0-9-]+)\)\s*[-–—]", re.S)


def parse_sets_table(html: str) -> dict[str, dict[str, Any]]:
    """code -> {name, slug, cards} from the limitless sets listing."""
    sets: dict[str, dict[str, Any]] = {}
    for row in re.findall(r"<tr>.*?</tr>", html, re.S):
        m = SET_ROW_RE.search(row)
        if not m:
            continue
        slug, code, name = m.group(1), normalize(m.group(2)), unescape(m.group(3)).strip()
        if not name:
            continue
        count = CARD_COUNT_RE.search(row)
        sets[code] = {
            "name": name,
            "slug": slug,
            "cards": int(count.group(1)) if count else None,
        }
    return sets


def fetch_set_name(code: str) -> tuple[str, str] | None:
    """Fall back to a set's own page — newest JP-only sets are not in the table."""
    try:
        html = fetch_text(LIMITLESS_SET_URL.format(slug=code.lower()), attempts=2, timeout=30)
    except SanityError:
        return None
    m = TITLE_RE.search(html)
    if not m or normalize(m.group(2)) != code:
        return None
    return unescape(m.group(1)).strip(), code.lower()


def names_from_cs(variants_index: dict[str, Any]) -> dict[str, str]:
    """Set names as dotgg spells them, e.g. 'GIFT COLLECTION 2023 [GC-01]'.

    Low quality — shouty, HTML-escaped, occasionally mislabelled — so these only
    ever fill a gap, never override a better source. Without them the Japan-only
    oddities (AC01, GC01, TS01/02) would show a bare code forever, since
    limitless does not carry them at all.
    """
    tally: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for entry in variants_index.values():
        for variant in entry["variants"]:
            label = unescape(re.sub(r"\[[^\]]*\]", "", variant["cs"])).strip(" -")
            if not label:
                continue
            for code in codes_from_cs(variant["cs"]):
                tally[code][label] += 1
    return {
        code: max(labels.items(), key=lambda kv: kv[1])[0]
        for code, labels in tally.items()
    }


def build_set_names(
    table: dict[str, dict[str, Any]],
    wanted: Iterable[str],
    previous: dict[str, str],
    cs_names: dict[str, str],
) -> tuple[dict[str, str], dict[str, str]]:
    """Names for every set, and the slugs discovered along the way.

    Weakest source first, so the best one wins: dotgg's cs field, then the name
    already committed, then a set's own limitless page, then the limitless table.
    Keeping `previous` in the chain means a name, once known, is never lost —
    that is what carries EB04, which limitless does not list at all.
    """
    names: dict[str, str] = {**cs_names, **previous}
    slugs: dict[str, str] = {c: v["slug"] for c, v in table.items()}

    for code in sorted(set(wanted) - set(table)):
        if not re.fullmatch(r"(OP|EB|ST|PRB)\d+", code):
            continue  # promos, DON and the Japan-only oddities have no set page
        found = fetch_set_name(code)
        if found is None:
            continue
        names[code], slugs[code] = found[0], found[1]
        log(f"  {code}: '{found[0]}' (set page)")
        time.sleep(0.5)  # be polite, this only runs for genuinely new sets

    for code, entry in table.items():
        names[code] = entry["name"]

    return {k: names[k] for k in sorted(names)}, slugs


# ---------------------------------------------------------------------------
# limitless — set-lists.json
# ---------------------------------------------------------------------------

CARD_KEY_RE = re.compile(r"/one-piece/[^/\"]+/([A-Z0-9]+-\d+(?:_[a-z]\d+)?)_[A-Z]{2}\.webp")


def scrape_set_list(code: str, slug: str) -> list[str]:
    html = fetch_text(LIMITLESS_SET_URL.format(slug=slug), attempts=2, timeout=60)
    seen: dict[str, None] = {}
    for key in CARD_KEY_RE.findall(html):
        seen.setdefault(key, None)
    return sorted(seen)


def authoritative_sets(
    table: dict[str, dict[str, Any]],
    previous: dict[str, Any],
) -> list[str]:
    """Sets whose card list is taken from limitless rather than dotgg.

    Every set already committed is kept, so a scrape that silently stops
    matching can never quietly drop a set the app depends on.
    """
    return sorted({c for c in table if AUTHORITATIVE_SET_RE.match(c)} | set(previous))


def report_deviations(
    table: dict[str, dict[str, Any]],
    dotgg_counts: dict[str, int],
) -> None:
    for code in sorted(table):
        expected = table[code].get("cards")
        if not expected:
            continue
        got = dotgg_counts.get(code, 0)
        if abs(got - expected) / expected >= DEVIATION_REPORT_RATIO:
            log(f"  note: {code} dotgg={got} limitless={expected}")


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def read_existing(filename: str) -> Any:
    path = os.path.join(PUBLIC_DIR, filename)
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def guard_shrink(filename: str, new: dict[str, Any]) -> None:
    old = read_existing(filename)
    if not isinstance(old, dict) or not old:
        return
    floor = len(old) * (1 - MAX_SHRINK_RATIO)
    if len(new) < floor:
        raise SanityError(
            f"{filename}: {len(new)} entries vs {len(old)} committed "
            f"(min {floor:.0f}) — upstream looks degraded, refusing to write"
        )


def write_json(filename: str, data: dict[str, Any]) -> None:
    path = os.path.join(PUBLIC_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
        f.write("\n")
    log(f"  wrote {filename} ({len(data)} entries)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def write_summary(
    previous_index: dict[str, Any],
    variants_index: dict[str, Any],
    previous_names: dict[str, str],
    set_names: dict[str, str],
) -> None:
    """Describe the change for the commit body. No-op outside CI."""
    path = os.environ.get("SUMMARY_FILE")
    if not path:
        return
    new_cards = sorted(set(variants_index) - set(previous_index))
    new_sets = sorted(set(set_names) - set(previous_names))
    lines = []
    if new_sets:
        lines.append("Nouveaux sets :")
        lines += [f"  {code} — {set_names[code]}" for code in new_sets]
    if new_cards:
        lines.append(f"Nouvelles cartes : {len(new_cards)}")
        lines += [f"  {c}" for c in new_cards[:20]]
        if len(new_cards) > 20:
            lines.append(f"  … et {len(new_cards) - 20} autres")
    if not lines:
        lines.append("Mise a jour sans nouvelle carte ni nouveau set.")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    previous_index = read_existing("variants-index.json") or {}
    cards = load_dotgg()
    groups = group_by_normal(cards)
    variants_index = build_variants_index(groups)
    sp_index = build_sp_index(cards)

    # Counted per variant, which is what limitless's own card counts measure.
    dotgg_counts: dict[str, int] = defaultdict(int)
    for entry in variants_index.values():
        for variant in entry["variants"]:
            for code in codes_from_cs(variant["cs"]):
                dotgg_counts[code] += 1

    log("Fetching limitless sets table...")
    table = parse_sets_table(fetch_text(LIMITLESS_SETS_URL, timeout=60))
    if not table:
        raise SanityError("limitless sets table parsed to nothing — markup changed?")
    log(f"  {len(table)} sets listed")
    report_deviations(table, dotgg_counts)

    previous_names = read_existing("set-names.json") or {}
    set_names, slugs = build_set_names(
        table, dotgg_counts.keys(), previous_names, names_from_cs(variants_index)
    )

    previous_lists = read_existing("set-lists.json") or {}
    targets = authoritative_sets(table, previous_lists)
    log(f"Authoritative set lists: {', '.join(targets) or 'none'}")
    set_lists: dict[str, list[str]] = {}
    for code in targets:
        cards_in_set = scrape_set_list(code, slugs.get(code, code.lower()))
        if cards_in_set:
            set_lists[code] = cards_in_set
            log(f"  {code}: {len(cards_in_set)} cards")
        else:
            log(f"  {code}: scraped nothing")
        time.sleep(0.5)

    dropped = sorted(set(previous_lists) - set(set_lists))
    if dropped:
        raise SanityError(
            f"set-lists.json would lose {', '.join(dropped)} — the limitless scrape "
            "returned nothing for them, refusing to write"
        )

    guard_shrink("variants-index.json", variants_index)
    guard_shrink("sp-index.json", sp_index)
    guard_shrink("set-names.json", set_names)
    guard_shrink("set-lists.json", set_lists)

    write_json("variants-index.json", variants_index)
    write_json("sp-index.json", sp_index)
    write_json("set-names.json", set_names)
    write_json("set-lists.json", set_lists)
    write_summary(previous_index, variants_index, previous_names, set_names)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SanityError as exc:
        log(f"ABORT: {exc}")
        sys.exit(1)
