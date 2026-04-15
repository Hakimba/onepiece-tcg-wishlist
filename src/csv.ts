import type { Card } from './types';
import { makeCardId } from './store';

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

export function parseCSV(text: string): Card[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const serieIdx = header.indexOf('serie');
  const idcardIdx = header.indexOf('idcard');
  const characterIdx = header.indexOf('character');
  const rarityIdx = header.indexOf('rarity');
  const priceIdx = header.indexOf('price');
  const sellerUrlIdx = header.indexOf('seller_url');
  const favoriteIdx = header.indexOf('favorite');

  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cols = parseCSVLine(line);
    const idcard = cols[idcardIdx] ?? '';
    const rarity = cols[rarityIdx] ?? '';
    const sellerUrl = sellerUrlIdx >= 0 ? cols[sellerUrlIdx] ?? '' : '';
    const fav = favoriteIdx >= 0 ? cols[favoriteIdx] ?? '' : '';
    return {
      id: makeCardId(idcard, rarity),
      serie: cols[serieIdx] ?? '',
      idcard,
      character: cols[characterIdx] ?? '',
      rarity,
      price: cols[priceIdx] ?? '',
      ...(sellerUrl ? { buyLink: sellerUrl } : {}),
      ...(fav === '1' ? { favorite: true } : {}),
    };
  });
}

export function exportCSV(cards: Card[]): string {
  const header = 'serie,idcard,character,rarity,price,seller_url,favorite';
  const rows = cards.map(
    (c) => [c.serie, c.idcard, c.character, c.rarity, c.price, c.buyLink ?? '', c.favorite ? '1' : '']
      .map(escapeCSVField).join(',')
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
