import { useState, useRef, useCallback, useEffect } from 'react';
import type { Card } from '../types';
import type { AmbiguousCard } from '../variantResolver';
import { variantImageUrl, dotggRarityToApp } from '../variantResolver';
import { makeCardId } from '../store';
import RarityBadge from './RarityBadge';

interface Props {
  ambiguous: AmbiguousCard[];
  resolved: Card[];
  mode: 'import' | 'add';
  onFinish: (cards: Card[]) => void;
  onCancel: () => void;
}

export default function DisambiguationQueue({ ambiguous, resolved, mode, onFinish, onCancel }: Props) {
  const [items, setItems] = useState<AmbiguousCard[]>(ambiguous);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);

  const resolvedCount = items.filter((i) => i.chosenIndices.length > 0).length;
  const totalChosenCards = items.reduce((sum, i) => sum + i.chosenIndices.length, 0);

  // Lock body scroll when carousel is open
  useEffect(() => {
    document.body.style.overflow = carouselIndex !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [carouselIndex]);

  const handleChoose = (itemIdx: number, candidateIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIdx) return item;
        if (item.multiSelect) {
          // Toggle in/out of selection
          const indices = item.chosenIndices.includes(candidateIdx)
            ? item.chosenIndices.filter((ci) => ci !== candidateIdx)
            : [...item.chosenIndices, candidateIdx];
          return { ...item, chosenIndices: indices };
        }
        // Single select — replace
        return { ...item, chosenIndices: item.chosenIndices[0] === candidateIdx ? [] : [candidateIdx] };
      })
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
      .filter((item) => item.chosenIndices.length > 0)
      .flatMap((item) =>
        item.chosenIndices.map((ci) => {
          const chosen = item.candidates[ci];
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
        })
      );
    onFinish(mode === 'import' ? [...resolved, ...disambiguated] : disambiguated);
  };

  // Picker view for a single ambiguous card
  if (activeIndex !== null && items[activeIndex]) {
    const item = items[activeIndex];
    const isSelected = (ci: number) => item.chosenIndices.includes(ci);
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
        {(item.rarityMismatch || item.serieMismatch) && (
          <div className="disambiguation-warning">
            {item.rarityMismatch && item.serieMismatch
              ? 'La rareté et la série indiquées n\'ont pas été trouvées pour cette carte.'
              : item.rarityMismatch
                ? 'La rareté indiquée n\'existe pas pour cette carte.'
                : 'La série indiquée n\'a pas été trouvée.'}
            {' '}Voici les variantes disponibles.
          </div>
        )}
        {item.multiSelect && (
          <div className="disambiguation-hint-multi">
            Tu peux sélectionner plusieurs variantes.
          </div>
        )}
        <div className="variant-picker">
          {item.candidates.map((c, ci) => (
            <div
              key={c.suffix}
              className={`variant-card ${isSelected(ci) ? 'selected' : ''}`}
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
                  className={`variant-select-btn ${isSelected(ci) ? 'selected' : ''}`}
                  onClick={() => handleChoose(activeIndex, ci)}
                >
                  {isSelected(ci) ? '✓ Sélectionné' : 'Choisir'}
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
          disabled={item.chosenIndices.length === 0}
        >
          Confirmer{item.chosenIndices.length > 1 ? ` (${item.chosenIndices.length})` : ''}
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
                  className={`variant-carousel-select ${isSelected(carouselIndex) ? 'selected' : ''}`}
                  onClick={() => handleChoose(activeIndex, carouselIndex)}
                >
                  {isSelected(carouselIndex) ? '✓ Sélectionné' : 'Choisir cette variante'}
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
      {mode === 'import' && resolved.length > 0 && (
        <p className="disambiguation-hint">
          <strong>{resolved.length} carte{resolved.length > 1 ? 's' : ''}</strong> {resolved.length > 1 ? 'seront importées' : 'sera importée'} automatiquement.
        </p>
      )}
      <div className="disambiguation-list">
        {(() => {
          const mismatch = items.map((item, i) => ({ item, i })).filter(({ item }) => item.rarityMismatch || item.serieMismatch);
          const unknown = items.map((item, i) => ({ item, i })).filter(({ item }) => !item.rarityMismatch && !item.serieMismatch && !item.card.rarity.trim());
          const ambig = items.map((item, i) => ({ item, i })).filter(({ item }) => !item.rarityMismatch && !item.serieMismatch && item.card.rarity.trim());
          const sections: { label: string; entries: { item: AmbiguousCard; i: number }[] }[] = [];
          if (mismatch.length > 0) sections.push({ label: 'Rareté ou série inexistante pour cette carte', entries: mismatch });
          if (ambig.length > 0) sections.push({ label: 'Plusieurs variantes possibles', entries: ambig });
          if (unknown.length > 0) sections.push({ label: 'Toutes les variantes (rareté non précisée)', entries: unknown });

          return sections.map((section) => (
            <div key={section.label}>
              <div className="disambiguation-section-label">{section.label}</div>
              {section.entries.map(({ item, i }) => (
                <button
                  key={item.card.idcard + i}
                  className={`disambiguation-entry ${item.chosenIndices.length > 0 ? 'resolved' : ''}`}
                  onClick={() => setActiveIndex(i)}
                >
                  <div className="disambiguation-entry-info">
                    <span className="disambiguation-entry-id">{item.card.idcard}</span>
                    <span className="disambiguation-entry-name">
                      {item.card.character || item.canonicalName}
                    </span>
                    <RarityBadge rarity={item.rarityMismatch ? '?' : (item.card.rarity || '?')} size="xs" />
                  </div>
                  <div className="disambiguation-entry-right">
                    <span className="disambiguation-entry-count">
                      {item.multiSelect && item.chosenIndices.length > 0
                        ? `${item.chosenIndices.length}/${item.candidates.length}`
                        : `${item.candidates.length} variantes`
                      }
                    </span>
                    {item.chosenIndices.length > 0 && (
                      <svg className="disambiguation-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ));
        })()}
      </div>
      <button
        className="btn-add btn-submit"
        onClick={handleFinish}
        disabled={mode === 'import' ? (resolved.length + totalChosenCards === 0) : totalChosenCards === 0}
      >
        {mode === 'import'
          ? `Importer ${resolved.length + totalChosenCards} carte${resolved.length + totalChosenCards > 1 ? 's' : ''}`
          : `Ajouter ${totalChosenCards} carte${totalChosenCards > 1 ? 's' : ''}`
        }
      </button>
    </div>
  );
}
