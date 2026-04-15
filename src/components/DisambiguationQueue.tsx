import { useState, useRef, useCallback, useEffect } from 'react';
import type { Card } from '../types';
import type { AmbiguousCard } from '../variantResolver';
import { variantImageUrl } from '../variantResolver';
import { makeCardId } from '../store';
import RarityBadge from './RarityBadge';

interface Props {
  ambiguous: AmbiguousCard[];
  resolved: Card[];
  onFinish: (cards: Card[]) => void;
  onCancel: () => void;
}

function dotggRarityToApp(dotggRarity: string, suffix: string): string {
  // Map dotgg rarity back to our app format
  if (dotggRarity === 'SP CARD') return `SP ${dotggRarity}`;
  if (dotggRarity === 'LR') return 'Leader';
  // If has suffix → it's a parallel
  if (suffix !== '') return `${dotggRarity} Parallel`;
  return dotggRarity;
}

export default function DisambiguationQueue({ ambiguous, resolved, onFinish, onCancel }: Props) {
  const [items, setItems] = useState<AmbiguousCard[]>(ambiguous);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);

  const resolvedCount = items.filter((i) => i.chosenIndex !== null).length;

  // Lock body scroll when carousel is open
  useEffect(() => {
    document.body.style.overflow = carouselIndex !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [carouselIndex]);

  const handleChoose = (itemIdx: number, candidateIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx ? { ...item, chosenIndex: candidateIdx } : item
      )
    );
  };

  const handleCarouselSwipe = useCallback((direction: 'left' | 'right') => {
    if (activeIndex === null || carouselIndex === null) return;
    const item = items[activeIndex];
    if (!item) return;
    const next = direction === 'right'
      ? Math.min(carouselIndex + 1, item.candidates.length - 1)
      : Math.max(carouselIndex - 1, 0);
    setCarouselIndex(next);
  }, [activeIndex, carouselIndex, items]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(diff) > 60) {
      handleCarouselSwipe(diff > 0 ? 'left' : 'right');
    }
    touchStart.current = null;
  }, [handleCarouselSwipe]);

  const handleFinish = () => {
    const disambiguated: Card[] = items
      .filter((item) => item.chosenIndex !== null)
      .map((item) => {
        const chosen = item.candidates[item.chosenIndex!];
        const newRarity = dotggRarityToApp(chosen.rarity, chosen.suffix);
        const newId = makeCardId(item.card.idcard, newRarity);
        return {
          ...item.card,
          id: newId,
          rarity: newRarity,
          character: item.canonicalName || item.card.character,
          imageSuffix: chosen.suffix,
          edition: chosen.cardSets,
        };
      });
    onFinish([...resolved, ...disambiguated]);
  };

  // Picker view for a single ambiguous card
  if (activeIndex !== null && items[activeIndex]) {
    const item = items[activeIndex];
    return (
      <div className="disambiguation-screen">
        <div className="disambiguation-header">
          <button className="btn-back" onClick={() => { setActiveIndex(null); setCarouselIndex(null); }}>
            ← Retour
          </button>
          <h2>{item.card.idcard}</h2>
        </div>
        {item.canonicalName && (
          <div className="disambiguation-card-name">{item.canonicalName}</div>
        )}
        <div className="variant-picker">
          {item.candidates.map((c, ci) => (
            <div
              key={c.suffix}
              className={`variant-card ${item.chosenIndex === ci ? 'selected' : ''}`}
            >
              <div className="variant-image-tap" onClick={() => setCarouselIndex(ci)}>
                <img
                  src={variantImageUrl(item.card.idcard, c.suffix)}
                  alt={`${item.card.idcard}${c.suffix}`}
                  className="variant-image"
                  loading="lazy"
                />
              </div>
              <div className="variant-meta">
                <button
                  className={`variant-select-btn ${item.chosenIndex === ci ? 'selected' : ''}`}
                  onClick={() => handleChoose(activeIndex, ci)}
                >
                  {item.chosenIndex === ci ? '✓ Sélectionné' : 'Choisir'}
                </button>
                <RarityBadge rarity={dotggRarityToApp(c.rarity, c.suffix)} size="xs" />
                <span className="variant-edition">{c.cardSets}</span>
              </div>
            </div>
          ))}
        </div>
        <button
          className="btn-add btn-submit"
          onClick={() => { setActiveIndex(null); setCarouselIndex(null); }}
          disabled={item.chosenIndex === null}
        >
          Confirmer
        </button>

        {carouselIndex !== null && (
          <div
            className="variant-carousel-overlay"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="variant-carousel-header">
              <button className="zoom-close" onClick={() => setCarouselIndex(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="variant-carousel-body">
              <button
                className="variant-carousel-arrow"
                disabled={carouselIndex <= 0}
                onClick={() => handleCarouselSwipe('left')}
              >
                ‹
              </button>
              <div className="variant-carousel-card">
                <img
                  src={variantImageUrl(item.card.idcard, item.candidates[carouselIndex].suffix)}
                  alt={`${item.card.idcard}${item.candidates[carouselIndex].suffix}`}
                  className="variant-carousel-image"
                />
                <div className="variant-carousel-meta">
                  <RarityBadge rarity={dotggRarityToApp(item.candidates[carouselIndex].rarity, item.candidates[carouselIndex].suffix)} size="md" />
                  <span className="variant-carousel-edition">{item.candidates[carouselIndex].cardSets}</span>
                </div>
                <button
                  className={`variant-carousel-select ${item.chosenIndex === carouselIndex ? 'selected' : ''}`}
                  onClick={() => handleChoose(activeIndex, carouselIndex)}
                >
                  {item.chosenIndex === carouselIndex ? '✓ Sélectionné' : 'Choisir cette variante'}
                </button>
              </div>
              <button
                className="variant-carousel-arrow"
                disabled={carouselIndex >= item.candidates.length - 1}
                onClick={() => handleCarouselSwipe('right')}
              >
                ›
              </button>
            </div>
            <div className="variant-carousel-dots">
              {item.candidates.map((_, di) => (
                <span
                  key={di}
                  className={`variant-carousel-dot ${di === carouselIndex ? 'active' : ''}`}
                  onClick={() => setCarouselIndex(di)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Queue view
  return (
    <div className="disambiguation-screen">
      <div className="disambiguation-header">
        <button className="btn-back" onClick={onCancel}>← Annuler</button>
        <h2>Désambiguïsation</h2>
        <span className="badge">{resolvedCount}/{items.length}</span>
      </div>
      <p className="disambiguation-hint">
        <strong>{resolved.length} carte{resolved.length > 1 ? 's' : ''}</strong> {resolved.length > 1 ? 'seront importées' : 'sera importée'} automatiquement.<br />
        <strong>{items.length} carte{items.length > 1 ? 's' : ''}</strong> {items.length > 1 ? 'ont' : 'a'} plusieurs variantes — choisis la bonne image.
      </p>
      <div className="disambiguation-list">
        {items.map((item, i) => (
          <button
            key={item.card.idcard + i}
            className={`disambiguation-entry ${item.chosenIndex !== null ? 'resolved' : ''}`}
            onClick={() => setActiveIndex(i)}
          >
            <div className="disambiguation-entry-info">
              <span className="disambiguation-entry-id">{item.card.idcard}</span>
              <span className="disambiguation-entry-name">
                {item.card.character || item.canonicalName}
              </span>
              <RarityBadge rarity={item.card.rarity || '?'} size="xs" />
            </div>
            <div className="disambiguation-entry-right">
              <span className="disambiguation-entry-count">
                {item.candidates.length} variantes
              </span>
              {item.chosenIndex !== null && (
                <svg className="disambiguation-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
      <button className="btn-add btn-submit" onClick={handleFinish}>
        Importer {resolved.length + resolvedCount} carte{resolved.length + resolvedCount > 1 ? 's' : ''}
      </button>
    </div>
  );
}
