export type BaseRarity = 'C' | 'UC' | 'R' | 'SR' | 'SEC' | 'L' | 'SP';

export interface ParsedRarity {
  base: BaseRarity;
  isParallel: boolean;
}

export function parseRarity(raw: string): ParsedRarity {
  const r = raw.trim();
  const lower = r.toLowerCase();

  const isParallel = lower.includes('parallel') || lower.includes('alt');

  // SP is a standalone base rarity (matches dotgg "SP CARD")
  if (lower.startsWith('sp') && (lower === 'sp' || lower.startsWith('sp ') || lower.startsWith('sp card'))) {
    return { base: 'SP', isParallel };
  }

  // Strip parallel/alt to find base
  let cleaned = r.replace(/\s*(parallel|alt(ernative)?)\s*/gi, '').trim();

  let base: BaseRarity;
  const cl = cleaned.toLowerCase();
  if (cl === 'sec' || cl === 'secret') base = 'SEC';
  else if (cl === 'sr') base = 'SR';
  else if (cl === 'r') base = 'R';
  else if (cl === 'uc') base = 'UC';
  else if (cl === 'c') base = 'C';
  else if (cl === 'l' || cl === 'leader') base = 'L';
  else base = 'R'; // fallback

  return { base, isParallel };
}

export function buildRarityString(base: BaseRarity, isParallel: boolean): string {
  let result = '';
  if (base === 'L') result = 'Leader';
  else result = base;
  if (isParallel) result += ' Parallel';
  return result;
}

export const RARITY_COLORS: Record<BaseRarity, string> = {
  C: '#6b7280',
  UC: '#9ca3af',
  R: '#3b82f6',
  SR: '#a855f7',
  SEC: '#f0c040',
  L: '#14b8a6',
  SP: '#22c55e',
};
