import { Option } from 'effect';
import type { Card } from '../domain/Card';
import type { SpIndex } from '../services/ImageResolver';
import { displayPrice } from '../domain/Price';
import RarityBadge from './RarityBadge';
import CardImage from './CardImage';

interface Props {
  cards: ReadonlyArray<Card>;
  onSelect: (index: number) => void;
  onToggleFavorite: (id: string) => void;
  spIndex?: SpIndex;
}

export default function MosaicView({ cards, onSelect, onToggleFavorite, spIndex }: Props) {
  if (cards.length === 0) {
    return <div className="empty">Aucune carte. Importe un CSV ou ajoute une carte.</div>;
  }

  return (
    <div className="mosaic-view">
      {cards.map((card, i) => {
        const buyLink = Option.getOrNull(card.buyLink);
        const edition = Option.getOrNull(card.edition);
        const priceStr = displayPrice(card.price);
        return (
          <div key={card.id} className="mosaic-card" onClick={() => onSelect(i)}>
            <div className="mosaic-image-wrapper">
              <CardImage card={card} spIndex={spIndex} className="mosaic-image" />
            </div>
            <div className="mosaic-info">
              <div className="mosaic-info-left">
                <span className="mosaic-id">{card.idcard}</span>
                <span className="mosaic-char">{card.character}</span>
                <RarityBadge rarity={card.rarity} size="xs" />
                <span className="mosaic-price">{priceStr || '\u00A0'}</span>
              </div>
              <div className="mosaic-badges">
                <button
                  className={`marker-star ${card.favorite ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(card.id); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={card.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
                {buyLink && (
                  <a
                    className="mosaic-buy-badge"
                    href={buyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
            {edition && (
              <div className="mosaic-edition-bar">
                <span className="mosaic-edition">{edition}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
