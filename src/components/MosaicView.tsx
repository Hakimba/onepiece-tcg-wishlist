import { memo } from 'react';
import { Option } from 'effect';
import type { Card, CardId } from '../domain/Card';
import type { SpIndex } from '../services/ImageResolver';
import { displayPrice } from '../domain/Price';
import RarityBadge from './RarityBadge';
import CardImage from './CardImage';

interface Props {
  cards: ReadonlyArray<Card>;
  onSelect: (index: number) => void;
  onToggleFavorite: (id: CardId) => void;
  spIndex?: SpIndex;
}

interface CellProps {
  card: Card;
  index: number;
  onSelect: (index: number) => void;
  onToggleFavorite: (id: CardId) => void;
  spIndex?: SpIndex;
}

// Memoized cell — only re-renders when this card's display-relevant fields
// change, not on every parent re-render. Toggling one favorite no longer
// re-renders all 200 cells.
const MosaicCell = memo(
  function MosaicCell({ card, index, onSelect, onToggleFavorite, spIndex }: CellProps) {
    const buyLink = Option.getOrNull(card.buyLink);
    const edition = Option.getOrNull(card.edition);
    const priceStr = displayPrice(card.price);
    return (
      <div className="mosaic-card" data-card-id={card.id} onClick={() => onSelect(index)}>
        <div className="mosaic-image-wrapper">
          <CardImage card={card} spIndex={spIndex} className="mosaic-image" />
          <button
            className={`mosaic-fav-corner ${card.favorite ? 'active' : ''}`}
            aria-label={card.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(card.id); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={card.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        </div>
        <div className="mosaic-info">
          <div className="mosaic-info-left">
            <span className="mosaic-id">{card.idcard}</span>
            <span className="mosaic-char">{card.character}</span>
            <RarityBadge rarity={card.rarity} size="xs" />
            <span className="mosaic-price">{priceStr || ' '}</span>
          </div>
          <div className="mosaic-badges">
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
  },
  (prev, next) =>
    prev.card === next.card &&
    prev.index === next.index &&
    prev.spIndex === next.spIndex &&
    prev.onSelect === next.onSelect &&
    prev.onToggleFavorite === next.onToggleFavorite,
);

export default function MosaicView({ cards, onSelect, onToggleFavorite, spIndex }: Props) {
  if (cards.length === 0) {
    return <div className="empty">Aucune carte. Importe un CSV ou ajoute une carte.</div>;
  }

  return (
    <div className="mosaic-view">
      {cards.map((card, i) => (
        <MosaicCell
          key={card.id}
          card={card}
          index={i}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
          spIndex={spIndex}
        />
      ))}
    </div>
  );
}
