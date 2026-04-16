import { useState, useRef, useCallback, useEffect } from 'react';
import { Option } from 'effect';
import type { Card } from '../domain/Card';
import { makeCardId } from '../domain/Card';
import type { StandardBase } from '../domain/Rarity';
import {
  STANDARD_BASES,
  RARITY_COLORS,
  buildRarity,
  getBase,
  isParallel as rarityIsParallel,
  isSP as rarityIsSP,
} from '../domain/Rarity';
import { parsePrice, displayPriceOrDash, displayPrice } from '../domain/Price';
import type { SpIndex } from '../services/ImageResolver';
import { resolveImageUrl } from '../services/ImageResolver';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import RarityBadge from './RarityBadge';
import CardImage from './CardImage';

const EMPTY_SP_INDEX: SpIndex = new Map();

interface Props {
  card: Card;
  onBack: () => void;
  onUpdate: (card: Card, oldId?: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSwipe: (direction: 'left' | 'right') => void;
  hasPrev: boolean;
  hasNext: boolean;
  spIndex?: SpIndex;
}

export default function CardDetail({
  card,
  onBack,
  onUpdate,
  onDelete,
  onToggleFavorite,
  onSwipe,
  hasPrev,
  hasNext,
  spIndex,
}: Props) {
  const [buyLink, setBuyLink] = useState(Option.getOrElse(card.buyLink, () => ''));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // Edit fields
  const [editSerie, setEditSerie] = useState(card.serie);
  const [editIdcard, setEditIdcard] = useState(card.idcard as string);
  const [editCharacter, setEditCharacter] = useState(card.character);
  const [editPrice, setEditPrice] = useState(displayPrice(card.price));
  const base = getBase(card.rarity);
  const [editBase, setEditBase] = useState<StandardBase | null>(base);
  const [editParallel, setEditParallel] = useState(rarityIsParallel(card.rarity));
  const [editSP, setEditSP] = useState(rarityIsSP(card.rarity));

  const touchStart = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(zoomed);

  // Reset state when card changes (swipe)
  useEffect(() => {
    setBuyLink(Option.getOrElse(card.buyLink, () => ''));
    setConfirmDelete(false);
    setEditing(false);
    setZoomed(false);
    setEditSerie(card.serie);
    setEditIdcard(card.idcard as string);
    setEditCharacter(card.character);
    setEditPrice(displayPrice(card.price));
    const b = getBase(card.rarity);
    setEditBase(b);
    setEditParallel(rarityIsParallel(card.rarity));
    setEditSP(rarityIsSP(card.rarity));
  }, [card.id]);

  useEffect(() => {
    if (!zoomed) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomed]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({ ...card, image: Option.some(reader.result as string) });
    };
    reader.readAsDataURL(file);
  };

  const handleLinkSave = () => {
    onUpdate({ ...card, buyLink: buyLink.trim() ? Option.some(buyLink.trim()) : Option.none() });
  };

  const handleEditSave = () => {
    const newRarity = buildRarity(editBase, editParallel, editSP);
    const newIdcard = editIdcard.trim().toUpperCase();
    const newId = makeCardId(newIdcard, newRarity);
    const oldId = card.id !== newId ? card.id as string : undefined;
    onUpdate(
      {
        ...card,
        serie: editSerie.trim(),
        idcard: newIdcard as any,
        character: editCharacter.trim(),
        rarity: newRarity,
        price: parsePrice(editPrice.trim()),
        id: newId,
      },
      oldId,
    );
    setEditing(false);
  };

  const handleEditCancel = () => {
    setEditSerie(card.serie);
    setEditIdcard(card.idcard as string);
    setEditCharacter(card.character);
    setEditPrice(displayPrice(card.price));
    const b = getBase(card.rarity);
    setEditBase(b);
    setEditParallel(rarityIsParallel(card.rarity));
    setEditSP(rarityIsSP(card.rarity));
    setEditing(false);
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
    [onSwipe],
  );

  const imageUrlOpt = resolveImageUrl(card, spIndex ?? EMPTY_SP_INDEX);
  const imageUrl = Option.getOrNull(imageUrlOpt);

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
          <button
            className={`btn-favorite-detail ${card.favorite ? 'active' : ''}`}
            onClick={() => onToggleFavorite(card.id)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={card.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button disabled={!hasPrev} onClick={() => onSwipe('left')}>‹</button>
          <button disabled={!hasNext} onClick={() => onSwipe('right')}>›</button>
        </div>
      </div>

      <div className="detail-image-section">
        {imageUrl ? (
          <div className="detail-image-tap" onClick={() => setZoomed(true)}>
            <CardImage card={card} spIndex={spIndex} className="detail-image" />
          </div>
        ) : (
          <CardImage card={card} spIndex={spIndex} className="detail-image" />
        )}
        <div className="detail-image-actions">
          <button className="btn-upload" onClick={() => fileRef.current?.click()}>
            Remplacer l'image
          </button>
          {Option.isSome(card.image) && (
            <button
              className="btn-secondary"
              onClick={() => onUpdate({ ...card, image: Option.none() })}
            >
              Réinitialiser
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="detail-info">
        {editing ? (
          <>
            <div className="detail-edit-field">
              <label className="detail-label">Série</label>
              <input
                type="text"
                value={editSerie}
                onChange={(e) => setEditSerie(e.target.value)}
                placeholder="OP01"
              />
            </div>
            <div className="detail-edit-field">
              <label className="detail-label">ID Carte</label>
              <input
                type="text"
                value={editIdcard}
                onChange={(e) => setEditIdcard(e.target.value)}
                placeholder="OP01-025"
              />
            </div>
            <div className="detail-edit-field">
              <label className="detail-label">Personnage</label>
              <input
                type="text"
                value={editCharacter}
                onChange={(e) => setEditCharacter(e.target.value)}
                placeholder="Roronoa Zoro"
              />
            </div>
            <div className="detail-edit-field">
              <label className="detail-label">Rareté</label>
              <div className="rarity-picker">
                <button
                  type="button"
                  className={`rarity-pill${editBase === null && !editSP ? ' selected' : ''}`}
                  style={{ '--pill-color': '#6b7280' } as React.CSSProperties}
                  onClick={() => { setEditBase(null); setEditParallel(false); setEditSP(false); }}
                >
                  ?
                </button>
                {STANDARD_BASES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rarity-pill${editBase === r && !editSP ? ' selected' : ''}`}
                    style={{ '--pill-color': RARITY_COLORS[r] } as React.CSSProperties}
                    onClick={() => { setEditBase(r); setEditSP(false); }}
                  >
                    {r === 'L' ? 'Leader' : r}
                  </button>
                ))}
              </div>
              {editBase !== null && !editSP && (
                <div className="rarity-toggles">
                  <label className="rarity-toggle">
                    <input
                      type="checkbox"
                      checked={editParallel}
                      onChange={(e) => setEditParallel(e.target.checked)}
                    />
                    <span className="toggle-label toggle-alt">Parallel / Alt</span>
                  </label>
                </div>
              )}
              <div className="rarity-toggles">
                <label className="rarity-toggle">
                  <input
                    type="checkbox"
                    checked={editSP}
                    onChange={(e) => { setEditSP(e.target.checked); if (e.target.checked) { setEditParallel(false); setEditBase(null); } }}
                  />
                  <span className="toggle-label toggle-sp">SP</span>
                </label>
              </div>
            </div>
            <div className="detail-edit-field">
              <label className="detail-label">Prix</label>
              <input
                type="text"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="10-15"
              />
            </div>
            <div className="detail-edit-actions">
              <button className="btn-save" onClick={handleEditSave}>Sauvegarder</button>
              <button className="btn-secondary" onClick={handleEditCancel}>Annuler</button>
            </div>
          </>
        ) : (
          <>
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
            {Option.isSome(card.edition) && (
              <div className="detail-row">
                <span className="detail-label">Édition</span>
                <span className="detail-value detail-edition">{Option.getOrElse(card.edition, () => '')}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Prix</span>
              <span className="detail-value">{displayPriceOrDash(card.price)}</span>
            </div>
            <button className="btn-edit" onClick={() => setEditing(true)}>
              Éditer
            </button>
          </>
        )}
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
        {Option.isSome(card.buyLink) && (
          <a
            className="detail-link-preview"
            href={Option.getOrElse(card.buyLink, () => '')}
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

      {zoomed && imageUrl && (
        <div
          className="image-zoom-overlay"
          onClick={() => setZoomed(false)}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <button className="zoom-close" onClick={() => setZoomed(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img src={imageUrl} alt={card.character} className="zoom-image" />
        </div>
      )}
    </div>
  );
}
