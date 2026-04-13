import type { Card } from './types';
import { makeCardId } from './store';

export function parseCSV(text: string): Card[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const serieIdx = header.indexOf('serie');
  const idcardIdx = header.indexOf('idcard');
  const characterIdx = header.indexOf('character');
  const rarityIdx = header.indexOf('rarity');
  const priceIdx = header.indexOf('price');

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const idcard = cols[idcardIdx] ?? '';
    const rarity = cols[rarityIdx] ?? '';
    return {
      id: makeCardId(idcard, rarity),
      serie: cols[serieIdx] ?? '',
      idcard,
      character: cols[characterIdx] ?? '',
      rarity,
      price: cols[priceIdx] ?? '',
    };
  });
}

export function exportCSV(cards: Card[]): string {
  const header = 'serie,idcard,character,rarity,price';
  const rows = cards.map(
    (c) => `${c.serie},${c.idcard},${c.character},${c.rarity},${c.price}`
  );
  return [header, ...rows].join('\n') + '\n';
}

export function downloadCSV(cards: Card[]): void {
  const csv = exportCSV(cards);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'onepiece-wishlist.csv';
  a.click();
  URL.revokeObjectURL(url);
}
