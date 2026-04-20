#!/usr/bin/env bash
# Generate variants-index.json and set-lists.json from dotgg API + limitlesstcg.
#
# variants-index.json: card data from dotgg (names, rarities, variant suffixes)
# set-lists.json: authoritative card lists per set from limitlesstcg
#   Used by buildSetIndex to add standard reprints that dotgg doesn't track.
set -euo pipefail

DOTGG_URL="https://api.dotgg.gg/cgfw/getcards?game=onepiece"
LIMITLESS_BASE="https://onepiece.limitlesstcg.com/cards"

# Sets to scrape from limitlesstcg (incomplete in dotgg)
LIMITLESS_SETS="PRB01 PRB02"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

echo "Fetching dotgg API..." >&2
curl -s "$DOTGG_URL" > "$tmpdir/dotgg.json"

# Scrape limitlesstcg
for set_code in $LIMITLESS_SETS; do
  slug=$(echo "$set_code" | tr '[:upper:]' '[:lower:]')
  echo "  Fetching limitlesstcg: $set_code" >&2
  curl -s "$LIMITLESS_BASE/$slug" \
    | grep -oP '(?<=/one-piece/)[^/"]+/[A-Z0-9]+-\d+(?:_[a-z]\d+)?(?=_[A-Z]{2}\.webp)' \
    | sed 's|^[^/]*/||' \
    | sort -u \
    > "$tmpdir/limitless_${set_code}.txt"
  echo "  → $(wc -l < "$tmpdir/limitless_${set_code}.txt") entries" >&2
done

python3 - "$tmpdir" $LIMITLESS_SETS <<'PYEOF'
import json, sys, os
from collections import defaultdict

tmpdir = sys.argv[1]
limitless_sets = sys.argv[2:]

# --- Build variants-index from dotgg ---
with open(os.path.join(tmpdir, "dotgg.json")) as f:
    data = json.load(f)

groups = defaultdict(list)
for c in data:
    idn = c.get("id_normal", c["id"])
    groups[idn].append(c)

index = {}
for idn, variants in sorted(groups.items()):
    first = variants[0]
    index[idn] = {
        "name": first["name"],
        "variants": [
            {
                "s": c["id"][len(idn):] if c["id"] != idn else "",
                "r": c["rarity"],
                "cs": c.get("CardSets", ""),
            }
            for c in variants
        ],
    }

# --- Build set-lists from limitlesstcg ---
set_lists = {}
for set_code in limitless_sets:
    fpath = os.path.join(tmpdir, f"limitless_{set_code}.txt")
    if not os.path.exists(fpath):
        continue
    with open(fpath) as f:
        cards = [line.strip() for line in f if line.strip()]
    set_lists[set_code] = cards
    print(f"  {set_code}: {len(cards)} cards from limitlesstcg", file=sys.stderr)

# --- Output ---
json.dump(index, sys.stdout, separators=(",", ":"))
print()

# Write set-lists to separate file
set_lists_path = os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), "..", "public", "set-lists.json")
# Fallback: write next to variants-index
try:
    with open(set_lists_path, "w") as f:
        json.dump(set_lists, f, separators=(",", ":"))
    print(f"  Wrote set-lists.json ({len(set_lists)} sets)", file=sys.stderr)
except Exception:
    json.dump(set_lists, open(os.path.join(tmpdir, "set-lists.json"), "w"), separators=(",", ":"))
    print(f"  Wrote set-lists.json to tmpdir", file=sys.stderr)
PYEOF
