import type { Card } from '../types';
import RarityBadge from './RarityBadge';

interface Props {
  cards: Card[];
  onSelect: (index: number) => void;
  spIndex?: Map<string, string>;
}

export default function ListView({ cards, onSelect }: Props) {
  if (cards.length === 0) {
    return <div className="empty">Aucune carte. Importe un CSV ou ajoute une carte.</div>;
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <span className="col-markers" />
        <span className="col-id">ID</span>
        <span className="col-char">Personnage</span>
        <span className="col-rarity">Rareté</span>
        <span className="col-price">Prix</span>
      </div>
      {cards.map((card, i) => (
        <div key={card.id} className="list-row" onClick={() => onSelect(i)}>
          <span className="col-markers">
            <svg className="marker-icon active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            {card.buyLink ? (
              <a className="marker-icon active" href={card.buyLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              </a>
            ) : (
              <svg className="marker-icon inactive" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
            )}
          </span>
          <span className="col-id">{card.idcard}</span>
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
