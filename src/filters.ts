import type { Card, FilterState } from './types';
import { parseRarity } from './rarity';

export const defaultFilters: FilterState = {
  series: [],
  rarityBases: [],
  rarityParallel: null,
  raritySP: null,
  priceMin: '',
  priceMax: '',
};

export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.series.length > 0 ||
    f.rarityBases.length > 0 ||
    f.rarityParallel !== null ||
    f.raritySP !== null ||
    f.priceMin !== '' ||
    f.priceMax !== ''
  );
}

function parsePrice(price: string): number | null {
  const cleaned = price.replace(/[€\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function applyFilters(cards: Card[], filters: FilterState): Card[] {
  if (!hasActiveFilters(filters)) return cards;

  return cards.filter((card) => {
    if (filters.series.length > 0 && !filters.series.includes(card.serie)) {
      return false;
    }

    const parsed = parseRarity(card.rarity);

    if (filters.rarityBases.length > 0 && !filters.rarityBases.includes(parsed.base)) {
      return false;
    }

    if (filters.rarityParallel !== null && parsed.isParallel !== filters.rarityParallel) {
      return false;
    }

    if (filters.raritySP !== null && (parsed.base === 'SP') !== filters.raritySP) {
      return false;
    }

    if (filters.priceMin || filters.priceMax) {
      const price = parsePrice(card.price);
      if (price === null) return false;
      if (filters.priceMin) {
        const min = parseFloat(filters.priceMin);
        if (!isNaN(min) && price < min) return false;
      }
      if (filters.priceMax) {
        const max = parseFloat(filters.priceMax);
        if (!isNaN(max) && price > max) return false;
      }
    }

    return true;
  });
}
