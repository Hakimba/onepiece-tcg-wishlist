import { get, set } from 'idb-keyval';
import type { Card } from './types';

const CARDS_KEY = 'wishlist-cards';

export async function loadCards(): Promise<Card[]> {
  const cards = await get<Card[]>(CARDS_KEY);
  return cards ?? [];
}

export async function saveCards(cards: Card[]): Promise<void> {
  await set(CARDS_KEY, cards);
}

export async function addCard(card: Card): Promise<{ cards: Card[]; duplicate: boolean }> {
  const cards = await loadCards();
  if (cards.some((c) => c.id === card.id)) {
    return { cards, duplicate: true };
  }
  cards.push(card);
  await saveCards(cards);
  return { cards, duplicate: false };
}

export async function updateCard(updated: Card, oldId?: string): Promise<Card[]> {
  const cards = await loadCards();
  const idx = cards.findIndex((c) => c.id === (oldId ?? updated.id));
  if (idx !== -1) {
    cards[idx] = updated;
    await saveCards(cards);
  }
  return cards;
}

export async function deleteCard(id: string): Promise<Card[]> {
  let cards = await loadCards();
  cards = cards.filter((c) => c.id !== id);
  await saveCards(cards);
  return cards;
}

export function makeCardId(idcard: string, rarity: string): string {
  return `${idcard}__${rarity}`;
}
