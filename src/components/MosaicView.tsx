import type { Card } from '../types';
import RarityBadge from './RarityBadge';
import CardImage from './CardImage';

interface Props {
  cards: Card[];
  onSelect: (index: number) => void;
  spIndex?: Map<string, string>;
}

export default function MosaicView({ cards, onSelect, spIndex }: Props) {
  if (cards.length === 0) {
    return <div className="empty">Aucune carte. Importe un CSV ou ajoute une carte.</div>;
  }

  return (
    <div className="mosaic-view">
      {cards.map((card, i) => (
        <div key={card.id} className="mosaic-card" onClick={() => onSelect(i)}>
          <div className="mosaic-image-wrapper">
            <CardImage card={card} spIndex={spIndex} className="mosaic-image" />
          </div>
          <div className="mosaic-info">
            <div className="mosaic-info-left">
              <span className="mosaic-id">{card.idcard}</span>
              <span className="mosaic-char">{card.character}</span>
              <RarityBadge rarity={card.rarity} size="xs" />
            </div>
            {card.buyLink && (
              <a
                className="mosaic-buy-badge"
                href={card.buyLink}
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
      ))}
    </div>
  );
}
