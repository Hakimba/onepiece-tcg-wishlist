import type { Card } from '../types';
import RarityBadge from './RarityBadge';

interface Props {
  cards: Card[];
  onSelect: (index: number) => void;
}

export default function ListView({ cards, onSelect }: Props) {
  if (cards.length === 0) {
    return <div className="empty">Aucune carte. Importe un CSV ou ajoute une carte.</div>;
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <span className="col-id">ID</span>
        <span className="col-char">Personnage</span>
        <span className="col-rarity">Rareté</span>
        <span className="col-price">Prix</span>
      </div>
      {cards.map((card, i) => (
        <div key={card.id} className="list-row" onClick={() => onSelect(i)}>
          {card.buyLink ? (
            <a
              className="col-id link"
              href={card.buyLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {card.idcard}
            </a>
          ) : (
            <span className="col-id">{card.idcard}</span>
          )}
          <span className="col-char">{card.character}</span>
          <span className="col-rarity">
            <RarityBadge rarity={card.rarity} size="sm" />
          </span>
          <span className="col-price">{card.price || '—'}</span>
        </div>
      ))}
    </div>
  );
}
