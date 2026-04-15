import type { Card } from './types';
import { parseRarity } from './rarity';

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
  chosenIndex: number | null;
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

const EXTENSION_PREFIXES = ['OP', 'EB', 'ST', 'PRB'];

function isExtensionSet(code: string): boolean {
  return EXTENSION_PREFIXES.some((p) => code.startsWith(p));
}

function filterCandidates(variants: VariantEntry[], rarity: string, idcard: string): VariantCandidate[] {
  let filtered = variants;

  // Exclude variants from a DIFFERENT extension set (OP, EB, ST, PRB)
  // Keep: same set, promos/events (no bracket), and non-extension sets (GC, TS, AC...)
  const setPrefix = extractSetPrefix(idcard);
  if (setPrefix) {
    filtered = filtered.filter((v) => {
      const m = v.cs.match(/\[([A-Z0-9-]+)\]/);
      if (!m) return true;
      if (m[1] === setPrefix) return true;
      return !isExtensionSet(m[1]);
    });
    if (filtered.length === 0) filtered = variants;
  }

  if (rarity.trim()) {
    const parsed = parseRarity(rarity);
    if (parsed.isSP) {
      filtered = filtered.filter((v) => v.r === 'SP CARD');
    } else if (parsed.isParallel) {
      filtered = filtered.filter((v) => v.s !== '' && v.r !== 'SP CARD');
    } else {
      filtered = filtered.filter((v) => v.s === '');
    }
  }

  return filtered.map((v) => ({ suffix: v.s, rarity: v.r, cardSets: v.cs }));
}

export function resolveVariants(
  cards: Card[],
  index: VariantsIndex
): { resolved: Card[]; ambiguous: AmbiguousCard[] } {
  const resolved: Card[] = [];
  const ambiguous: AmbiguousCard[] = [];

  for (const card of cards) {
    const entry = index[card.idcard];

    if (!entry) {
      // Not in index (single variant or unknown card)
      resolved.push(card);
      continue;
    }

    const candidates = filterCandidates(entry.variants, card.rarity, card.idcard);

    if (candidates.length <= 1) {
      // 0 or 1 match — auto-resolve, fill character if empty
      const updated = { ...card };
      if (!card.character.trim() && entry.name) {
        updated.character = entry.name;
      }
      if (candidates.length === 1) {
        updated.edition = candidates[0].cardSets;
        updated.imageSuffix = candidates[0].suffix;
      }
      resolved.push(updated);
      continue;
    }

    // Multiple candidates — needs disambiguation
    ambiguous.push({
      card,
      candidates,
      canonicalName: entry.name,
      chosenIndex: null,
    });
  }

  return { resolved, ambiguous };
}

export const CDN_BASE = 'https://static.dotgg.gg/onepiece/card';

export function variantImageUrl(idcard: string, suffix: string): string {
  return `${CDN_BASE}/${idcard}${suffix}.webp`;
}
