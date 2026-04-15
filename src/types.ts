export interface Card {
  id: string;
  serie: string;
  idcard: string;
  character: string;
  rarity: string;
  price: string;
  image?: string;
  buyLink?: string;
  favorite?: boolean;
  edition?: string;
  imageSuffix?: string;
}

export type ViewMode = 'list' | 'mosaic';

export type SortPrice = 'asc' | 'desc' | null;

export type PageId = 'home' | 'characters';

export interface FilterState {
  series: string[];
  rarityBases: string[];
  rarityParallel: boolean | null;
  raritySP: boolean | null;
  priceMin: string;
  priceMax: string;
}
