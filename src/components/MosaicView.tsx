import type { Card } from '../types';
import RarityBadge from './RarityBadge';

interface Props {
  cards: Card[];
  onSelect: (index: number) => void;
}

export default function MosaicView({ cards, onSelect }: Props) {
  if (cards.length === 0) {
    return <div className="empty">Aucune carte. Importe un CSV ou ajoute une carte.</div>;
  }

  return (
    <div className="mosaic-view">
      {cards.map((card, i) => (
        <div key={card.id} className="mosaic-card" onClick={() => onSelect(i)}>
          <div className="mosaic-image-wrapper">
            {card.buyLink ? (
              <a
                href={card.buyLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {card.image ? (
                  <img src={card.image} alt={card.character} className="mosaic-image" />
                ) : (
                  <div className="mosaic-placeholder">
                    <span>{card.idcard}</span>
                  </div>
                )}
              </a>
            ) : card.image ? (
              <img src={card.image} alt={card.character} className="mosaic-image" />
            ) : (
              <div className="mosaic-placeholder">
                <span>{card.idcard}</span>
              </div>
            )}
          </div>
          <div className="mosaic-info">
            <span className="mosaic-id">{card.idcard}</span>
            <span className="mosaic-char">{card.character}</span>
            <RarityBadge rarity={card.rarity} size="xs" />
          </div>
        </div>
      ))}
    </div>
  );
}
