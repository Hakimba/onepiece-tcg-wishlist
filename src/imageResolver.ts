import { parseRarity } from './rarity';

const CDN_BASE = 'https://static.dotgg.gg/onepiece/card';

function getImageSuffix(rarity: string): string | null {
  const parsed = parseRarity(rarity);
  if (parsed.base === 'SP') return null;
  if (parsed.isParallel) return '_p1';
  return '';
}

export function resolveImageUrl(
  idcard: string,
  rarity: string,
  spIndex?: Map<string, string>,
  imageSuffix?: string
): string | null {
  if (imageSuffix !== undefined) {
    return `${CDN_BASE}/${idcard}${imageSuffix}.webp`;
  }
  const suffix = getImageSuffix(rarity);
  if (suffix !== null) {
    return `${CDN_BASE}/${idcard}${suffix}.webp`;
  }
  // SP : index obligatoire, pas de fallback
  const spSuffix = spIndex?.get(idcard);
  if (!spSuffix) return null;
  return `${CDN_BASE}/${idcard}${spSuffix}.webp`;
}

export async function loadSpIndex(): Promise<Map<string, string>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}sp-index.json`);
    const data: Record<string, string> = await res.json();
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}
