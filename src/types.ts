export interface Card {
  id: string;
  serie: string;
  idcard: string;
  character: string;
  rarity: string;
  price: string;
  image?: string;
  buyLink?: string;
}

export type ViewMode = 'list' | 'mosaic';

export interface FilterState {
  series: string[];
  rarityBases: string[];
  rarityParallel: boolean | null;
  raritySP: boolean | null;
  priceMin: string;
  priceMax: string;
}
