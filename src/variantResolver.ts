import type { Card } from './types';
import { parseRarity } from './rarity';
import { makeCardId } from './store';

export interface VariantEntry {
  s: string;   // suffix: "", "_p1", "_p2", ...
  r: string;   // dotgg rarity: "R", "SR", "SP CARD", "LR", ...
  cs: string;  // CardSets edition name
}

export interface VariantsIndexEntry {
  name: string;
  variants: VariantEntry[];
}

export type VariantsIndex = Record<string, VariantsIndexEntry>;

export interface VariantCandidate {
  suffix: string;
  rarity: string;
  cardSets: string;
}

export interface AmbiguousCard {
  card: Card;
  candidates: VariantCandidate[];
  canonicalName: string;
  chosenIndices: number[];
  multiSelect?: boolean;
  rarityMismatch?: boolean;
  serieMismatch?: boolean;
}

export async function loadVariantsIndex(): Promise<VariantsIndex> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}variants-index.json`);
    return await res.json();
  } catch {
    return {};
  }
}

function extractSetPrefix(idcard: string): string | null {
  const m = idcard.match(/^([A-Z]+\d+)-/);
  return m ? m[1] : null;
}

/** Normalize set codes for comparison: "OP-09" → "OP09", "PRB-02" → "PRB02" */
function normalizeSetCode(code: string): string {
  return code.replace(/-/g, '');
}

const EXTENSION_PREFIXES = ['OP', 'EB', 'ST', 'PRB'];

function isExtensionSet(code: string): boolean {
  return EXTENSION_PREFIXES.some((p) => code.startsWith(p));
}

/** Extract set code from cs field — bracket format "[OP-09]" or bare "OP-05" */
function extractCsSetCode(cs: string): string | null {
  const bracketMatch = cs.match(/\[([A-Z0-9-]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  // Bare set code: the whole cs is just a set code like "OP-05"
  const bare = cs.trim();
  if (/^[A-Z]+\d*-?\d+$/.test(bare)) return bare;
  return null;
}

function filterBySet(variants: VariantEntry[], idcard: string): VariantEntry[] {
  const setPrefix = extractSetPrefix(idcard);
  if (!setPrefix) return variants;

  const norm = normalizeSetCode(setPrefix);
  const filtered: VariantEntry[] = [];
  const fromOriginSet: VariantEntry[] = [];

  for (const v of variants) {
    const code = extractCsSetCode(v.cs);
    if (!code) { filtered.push(v); continue; }
    const normCode = normalizeSetCode(code);
    if (normCode === norm) { filtered.push(v); fromOriginSet.push(v); continue; }
    if (!isExtensionSet(code)) { filtered.push(v); }
  }

  if (filtered.length === 0) return variants;
  if (fromOriginSet.length > 0 && fromOriginSet.length < filtered.length) return fromOriginSet;
  return filtered;
}

function appRarityToDotgg(base: string): string | null {
  const map: Record<string, string> = {
    C: 'C', UC: 'UC', R: 'R', SR: 'SR', SEC: 'SEC', L: 'L',
  };
  return map[base] ?? null;
}

function filterByRarity(variants: VariantEntry[], rarity: string): VariantEntry[] {
  if (!rarity.trim()) return variants;
  const parsed = parseRarity(rarity);
  if (parsed.base === 'SP') {
    return variants.filter((v) => v.r === 'SP CARD');
  }
  const dotggBase = appRarityToDotgg(parsed.base);
  if (parsed.isParallel) {
    return variants.filter((v) =>
      v.s !== '' && v.r !== 'SP CARD' && (!dotggBase || v.r === dotggBase)
    );
  }
  return variants.filter((v) => v.s === '' && (!dotggBase || v.r === dotggBase));
}

function filterBySerie(variants: VariantEntry[], serie: string): { result: VariantEntry[]; matched: boolean } {
  const norm = normalizeSetCode(serie);
  const matched = variants.filter((v) => {
    const code = extractCsSetCode(v.cs);
    return code && normalizeSetCode(code) === norm;
  });
  return matched.length > 0
    ? { result: matched, matched: true }
    : { result: variants, matched: false };
}

interface FilterResult {
  candidates: VariantCandidate[];
  serieMismatch: boolean;
}

function filterCandidates(variants: VariantEntry[], rarity: string, idcard: string, serie?: string): FilterResult {
  // 1. Filter by rarity on ALL variants (don't exclude cross-set reprints)
  const byRarity = filterByRarity(variants, rarity);

  // 2. If user explicitly provided a serie, use it as a set filter
  if (serie) {
    const { result: bySerie, matched } = filterBySerie(byRarity, serie);
    return {
      candidates: bySerie.map((v) => ({ suffix: v.s, rarity: v.r, cardSets: v.cs })),
      serieMismatch: !matched,
    };
  }

  // 3. For standard rarity (no suffix), multiple candidates = same card in different sets.
  //    Use set filter to auto-resolve to the origin set.
  //    For SP / Parallel, each suffix is a unique artwork — don't filter by set.
  const parsed = rarity.trim() ? parseRarity(rarity) : null;
  const isStandard = parsed && parsed.base !== 'SP' && !parsed.isParallel;

  if (isStandard && byRarity.length > 1) {
    const bySet = filterBySet(byRarity, idcard);
    if (bySet.length > 0 && bySet.length < byRarity.length) {
      return { candidates: bySet.map((v) => ({ suffix: v.s, rarity: v.r, cardSets: v.cs })), serieMismatch: false };
    }
  }

  return { candidates: byRarity.map((v) => ({ suffix: v.s, rarity: v.r, cardSets: v.cs })), serieMismatch: false };
}

export function resolveVariants(
  cards: Card[],
  index: VariantsIndex,
  existingCards?: Card[]
): { resolved: Card[]; ambiguous: AmbiguousCard[] } {
  const resolved: Card[] = [];
  const ambiguous: AmbiguousCard[] = [];

  // Build set of existing suffixes per idcard for filtering
  const existingSuffixesByIdcard = new Map<string, Set<string>>();
  if (existingCards) {
    for (const c of existingCards) {
      if (!existingSuffixesByIdcard.has(c.idcard)) {
        existingSuffixesByIdcard.set(c.idcard, new Set());
      }
      existingSuffixesByIdcard.get(c.idcard)!.add(c.imageSuffix ?? '');
    }
  }

  const fillSerie = (c: Card): Card =>
    c.serie ? c : { ...c, serie: extractSetPrefix(c.idcard) ?? '' };

  for (const card of cards) {
    const entry = index[card.idcard];

    if (!entry) {
      // Not in index (single variant or unknown card)
      resolved.push(fillSerie(card));
      continue;
    }

    const filterResult = filterCandidates(entry.variants, card.rarity, card.idcard, card.serie);
    let candidates = filterResult.candidates;
    const serieMismatch = filterResult.serieMismatch;
    const candidatesBeforeDedup = candidates.length;

    // Remove candidates already present in the wishlist
    const existingSuffixes = existingSuffixesByIdcard.get(card.idcard);
    if (existingSuffixes) {
      candidates = candidates.filter((c) => !existingSuffixes.has(c.suffix));
    }

    if (candidates.length === 0) {
      if (candidatesBeforeDedup > 0) {
        // All variants already in wishlist — skip
        continue;
      }
      // No candidates from rarity filter — fallback: retry without rarity filter
      if (card.rarity.trim()) {
        let fallbackVariants: VariantEntry[] = entry.variants;
        if (card.serie) {
          const { result } = filterBySerie(fallbackVariants, card.serie);
          fallbackVariants = result;
        }
        let fallbackCandidates = fallbackVariants.map((v) => ({ suffix: v.s, rarity: v.r, cardSets: v.cs }));
        if (existingSuffixes) {
          fallbackCandidates = fallbackCandidates.filter((c) => !existingSuffixes.has(c.suffix));
        }
        if (fallbackCandidates.length > 0) {
          ambiguous.push({
            card: fillSerie(card),
            candidates: fallbackCandidates,
            canonicalName: entry.name,
            chosenIndices: [],
            rarityMismatch: true,
          });
          continue;
        }
      }
      // Truly no candidates — add card as-is
      let updated = fillSerie({ ...card });
      if (!card.character.trim() && entry.name) {
        updated = { ...updated, character: entry.name };
      }
      resolved.push(updated);
      continue;
    }

    if (candidates.length === 1 && !serieMismatch) {
      // Single match, no issues — auto-resolve
      const c = candidates[0];
      const updated = {
        ...fillSerie(card),
        edition: c.cardSets,
        imageSuffix: c.suffix,
        ...((!card.character.trim() && entry.name) ? { character: entry.name } : {}),
        // Fill rarity from dotgg if user didn't specify one
        ...(!card.rarity.trim() ? { rarity: dotggRarityToApp(c.rarity, c.suffix), id: makeCardId(card.idcard, dotggRarityToApp(c.rarity, c.suffix)) } : {}),
      };
      resolved.push(updated);
      continue;
    }

    // Multiple candidates or serie mismatch — needs disambiguation
    const isMultiSelect = !card.rarity.trim() && !serieMismatch;
    ambiguous.push({
      card: fillSerie(card),
      candidates,
      canonicalName: entry.name,
      chosenIndices: [],
      multiSelect: isMultiSelect || undefined,
      serieMismatch: serieMismatch || undefined,
    });
  }

  return { resolved, ambiguous };
}

export function dotggRarityToApp(dotggRarity: string, suffix: string): string {
  if (dotggRarity === 'SP CARD') return 'SP';
  if (dotggRarity === 'LR') return 'Leader';
  if (suffix !== '') return `${dotggRarity} Parallel`;
  return dotggRarity;
}

export const CDN_BASE = 'https://static.dotgg.gg/onepiece/card';

export function variantImageUrl(idcard: string, suffix: string): string {
  return `${CDN_BASE}/${idcard}${suffix}.webp`;
}
