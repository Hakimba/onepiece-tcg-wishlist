import { useState, useRef, useCallback, useEffect } from 'react';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { Option } from 'effect';
import type { Card } from '../domain/Card';
import { CharacterName, makeCardId, normalizeIdCard } from '../domain/Card';
import type { CardId } from '../domain/Card';
import type { Rarity as RarityType } from '../domain/Rarity';
import { Promo } from '../domain/Rarity';
import * as SC from '../domain/SetCode';
import RarityPicker from './RarityPicker';
import { parsePrice, displayPriceOrDash, displayPrice } from '../domain/Price';
import type { SpIndex } from '../services/ImageResolver';
import { resolveImageUrl } from '../services/ImageResolver';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useImageCache } from '../hooks/useImageCache';
import RarityBadge from './RarityBadge';
import CardImage from './CardImage';

const EMPTY_SP_INDEX: SpIndex = new Map();

type SlidePhase = 'idle' | 'out' | 'entering' | 'in';

interface Props {
  card: Card;
  onBack: () => void;
  onUpdate: (card: Card, oldId?: Option.Option<CardId>) => void;
  onDelete: (id: CardId) => void;
  onToggleFavorite: (id: CardId) => void;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const [editSerie, setEditSerie] = useState<string>(card.serie);
  const [editIdcard, setEditIdcard] = useState<string>(card.idcard);
  const [editCharacter, setEditCharacter] = useState<string>(card.character);
  const [editPrice, setEditPrice] = useState(displayPrice(card.price));
  const [editRarity, setEditRarity] = useState<RarityType>(card.rarity);
  const [editBuyLink, setEditBuyLink] = useState(Option.getOrElse(card.buyLink, () => ''));

  const editIdBranded = normalizeIdCard(editIdcard);
  const editIsPromo = SC.isPromoId(editIdBranded);
  const editEffectiveRarity = editIsPromo ? Promo() : editRarity;

  // Slide animation state (out → card change → entering → in → idle)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [slidePhase, setSlidePhase] = useState<SlidePhase>('idle');
  const slideDirectionRef = useRef<'left' | 'right' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const commitNavigation = useCallback((direction: 'left' | 'right') => {
    if (direction === 'left' && !hasPrev) return;
    if (direction === 'right' && !hasNext) return;
    if (slidePhase !== 'idle') return;
    setSlideDirection(direction);
    setSlidePhase('out');
  }, [hasPrev, hasNext, slidePhase]);

  const { dragX, isDragging, setDragX, onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture({
    onSwipe: commitNavigation,
    canSwipeLeft: hasPrev,
    canSwipeRight: hasNext,
    enabled: slidePhase === 'idle',
  });

  useBodyScrollLock(zoomed);

  useEffect(() => { slideDirectionRef.current = slideDirection; }, [slideDirection]);

  useEffect(() => {
    setConfirmDelete(false);
    setEditing(false);
    setZoomed(false);
    setEditSerie(card.serie);
    setEditIdcard(String(card.idcard));
    setEditCharacter(card.character);
    setEditPrice(displayPrice(card.price));
    setEditRarity(card.rarity);
    setEditBuyLink(Option.getOrElse(card.buyLink, () => ''));

    if (slideDirectionRef.current) {
      const dir = slideDirectionRef.current;
      setSlidePhase('entering');
      setDragX(dir === 'right' ? window.innerWidth : -window.innerWidth);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlidePhase('in');
          setDragX(0);
        });
      });
    }
  }, [card.id]);

  useEffect(() => {
    if (!zoomed) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomed]);

  const handleTransitionEnd = useCallback(() => {
    if (slidePhase === 'out' && slideDirection) {
      onSwipe(slideDirection);
    } else if (slidePhase === 'in') {
      setSlidePhase('idle');
      setSlideDirection(null);
    }
  }, [slidePhase, slideDirection, onSwipe]);

  useEffect(() => {
    if (zoomed || editing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        commitNavigation('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        commitNavigation('right');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomed, editing, commitNavigation]);

  // --- Inline styles for animation ---

  const dragRotation = isDragging ? dragX * 0.03 : 0;

  const bodyTransform = slidePhase === 'out'
    ? `translateX(${slideDirection === 'right' ? '-110%' : '110%'}) rotate(${slideDirection === 'right' ? -5 : 5}deg)`
    : `translateX(${dragX}px)${dragRotation ? ` rotate(${dragRotation}deg)` : ''}`;

  const bodyTransition = (isDragging || slidePhase === 'entering')
    ? 'none'
    : 'transform 0.15s ease-out';

  const bodyStyle: React.CSSProperties = {
    transform: bodyTransform,
    transition: bodyTransition,
    willChange: isDragging ? 'transform' : undefined,
  };

  // --- Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({ ...card, image: Option.some(reader.result as string) });
    };
    reader.readAsDataURL(file);
  };

  const handleEditSave = () => {
    const newRarity = editEffectiveRarity;
    const newIdcard = normalizeIdCard(editIdcard);
    const newId = makeCardId(newIdcard, newRarity);
    const oldId = card.id !== newId ? Option.some(card.id) : Option.none<CardId>();
    const trimmedLink = editBuyLink.trim();
    onUpdate(
      {
        ...card,
        serie: SC.SetCode(editSerie.trim()),
        idcard: newIdcard,
        character: CharacterName(editCharacter.trim()),
        rarity: newRarity,
        price: parsePrice(editPrice.trim()),
        buyLink: trimmedLink ? Option.some(trimmedLink) : Option.none(),
        id: newId,
      },
      oldId,
    );
    setEditing(false);
  };

  const handleEditCancel = () => {
    setEditSerie(card.serie);
    setEditIdcard(String(card.idcard));
    setEditCharacter(card.character);
    setEditPrice(displayPrice(card.price));
    setEditRarity(card.rarity);
    setEditBuyLink(Option.getOrElse(card.buyLink, () => ''));
    setEditing(false);
  };

  const imageUrlOpt = resolveImageUrl(card, spIndex ?? EMPTY_SP_INDEX);
  const rawImageUrl = Option.getOrNull(imageUrlOpt);
  const isCustomImage = Option.isSome(card.image);
  const { src: cachedImageUrl } = useImageCache(isCustomImage ? null : rawImageUrl);
  const imageUrl = isCustomImage ? rawImageUrl : (cachedImageUrl ?? rawImageUrl);

  return (
    <div className="detail">
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
          <button disabled={!hasPrev} onClick={() => commitNavigation('left')}>‹</button>
          <button disabled={!hasNext} onClick={() => commitNavigation('right')}>›</button>
        </div>
      </div>

      <div
        className="detail-body"
        style={bodyStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="detail-image-section">
          {imageUrl ? (
            <div className="detail-image-tap" onClick={() => setZoomed(true)}>
              <CardImage card={card} spIndex={spIndex} className="detail-image" />
            </div>
          ) : (
            <CardImage card={card} spIndex={spIndex} className="detail-image" />
          )}
          <div className="detail-image-overlay-actions">
            <button className="btn-icon-circle" onClick={() => fileRef.current?.click()} title="Remplacer l'image">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            {Option.isSome(card.image) && (
              <button
                className="btn-icon-circle"
                onClick={() => onUpdate({ ...card, image: Option.none() })}
                title="Réinitialiser l'image"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
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

        <div className="detail-card">
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
                <RarityPicker rarity={editRarity} onChange={setEditRarity} isPromo={editIsPromo} />
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
              <div className="detail-edit-field">
                <label className="detail-label">Lien d'achat</label>
                <input
                  type="url"
                  value={editBuyLink}
                  onChange={(e) => setEditBuyLink(e.target.value)}
                  placeholder="https://www.cardmarket.com/..."
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
              {Option.isSome(card.buyLink) && (
                <div className="detail-row">
                  <span className="detail-label">Achat</span>
                  <span className="detail-value">
                    <a
                      className="detail-buy-link"
                      href={Option.getOrElse(card.buyLink, () => '')}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ouvrir le lien
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </span>
                </div>
              )}
              <button className="btn-edit" onClick={() => setEditing(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Éditer
              </button>
            </>
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
