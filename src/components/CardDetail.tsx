import { useState, useRef, useCallback, useEffect } from 'react';
import type { Card } from '../types';
import RarityBadge from './RarityBadge';

interface Props {
  card: Card;
  onBack: () => void;
  onUpdate: (card: Card) => void;
  onDelete: (id: string) => void;
  onSwipe: (direction: 'left' | 'right') => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function CardDetail({
  card,
  onBack,
  onUpdate,
  onDelete,
  onSwipe,
  hasPrev,
  hasNext,
}: Props) {
  const [buyLink, setBuyLink] = useState(card.buyLink ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const touchStart = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset state when card changes (swipe)
  useEffect(() => {
    setBuyLink(card.buyLink ?? '');
    setConfirmDelete(false);
  }, [card.id]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({ ...card, image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleLinkSave = () => {
    onUpdate({ ...card, buyLink: buyLink.trim() || undefined });
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStart.current;
      if (Math.abs(diff) > 60) {
        onSwipe(diff > 0 ? 'left' : 'right');
      }
      touchStart.current = null;
    },
    [onSwipe]
  );

  return (
    <div
      className="detail"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>
          ← Retour
        </button>
        <div className="detail-nav">
          <button disabled={!hasPrev} onClick={() => onSwipe('left')}>‹</button>
          <button disabled={!hasNext} onClick={() => onSwipe('right')}>›</button>
        </div>
      </div>

      <div className="detail-image-section">
        {card.image ? (
          <img src={card.image} alt={card.character} className="detail-image" />
        ) : (
          <div className="detail-placeholder">Pas d'image</div>
        )}
        <button className="btn-upload" onClick={() => fileRef.current?.click()}>
          {card.image ? 'Changer l\'image' : 'Ajouter une image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="detail-info">
        <div className="detail-row">
          <span className="detail-label">Série</span>
          <span className="detail-value">{card.serie}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">ID</span>
          <span className="detail-value">{card.idcard}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Personnage</span>
          <span className="detail-value">{card.character}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Rareté</span>
          <span className="detail-value">
            <RarityBadge rarity={card.rarity} size="md" />
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Prix</span>
          <span className="detail-value">{card.price || '—'}</span>
        </div>
      </div>

      <div className="detail-link-section">
        <label className="detail-label">Lien d'achat</label>
        <div className="detail-link-row">
          <input
            type="url"
            placeholder="https://www.cardmarket.com/..."
            value={buyLink}
            onChange={(e) => setBuyLink(e.target.value)}
            onBlur={handleLinkSave}
          />
          <button className="btn-secondary" onClick={handleLinkSave}>OK</button>
        </div>
        {card.buyLink && (
          <a
            className="detail-link-preview"
            href={card.buyLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ouvrir le lien
          </a>
        )}
      </div>

      <div className="detail-danger">
        {confirmDelete ? (
          <div className="confirm-delete">
            <span>Supprimer cette carte ?</span>
            <button className="btn-danger" onClick={() => onDelete(card.id)}>Oui</button>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Non</button>
          </div>
        ) : (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
