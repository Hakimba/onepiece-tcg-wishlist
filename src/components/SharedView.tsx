import { useState, useCallback, useMemo, useEffect } from "react"
import { Option, pipe } from "effect"
import type { Card } from "../domain/Card"
import type { CardId } from "../domain/Card"
import type { AppContext, UIState, ViewMode, SortPrice } from "../state/AppState"
import { AppAction } from "../state/AppAction"
import { toPredicate, hasActiveFilters } from "../domain/Filter"
import { comparePrice } from "../domain/Price"
import { displayPriceOrDash } from "../domain/Price"
import type { SpIndex } from "../services/ImageResolver"
import { resolveImageUrl } from "../services/ImageResolver"
import type { Theme } from "../hooks/useTheme"
import { useBodyScrollLock } from "../hooks/useBodyScrollLock"
import { useSwipeGesture } from "../hooks/useSwipeGesture"
import ListView from "./ListView"
import MosaicView from "./MosaicView"
import FilterPanel from "./FilterPanel"
import SearchBar from "./SearchBar"
import BackToTop from "./BackToTop"
import RarityBadge from "./RarityBadge"
import CardImage from "./CardImage"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  ctx: AppContext
  ui: UIState
  dispatch: (action: AppAction) => void
  theme: Theme
  toggleTheme: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EMPTY_SP_INDEX: SpIndex = new Map()
const noopFavorite = (_id: CardId) => {}

export default function SharedView({ ctx, ui, dispatch, theme, toggleTheme }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [zoomed, setZoomed] = useState(false)

  useBodyScrollLock(zoomed)

  const filteredCards = useMemo(() => {
    const predicate = toPredicate(ui.filters, ui.searchQuery, false)
    const result = ctx.cards.filter(predicate)
    if (ui.sortPrice) {
      const dir = ui.sortPrice === "asc" ? 1 : -1
      return result.sort((a, b) => dir * comparePrice(a.price, b.price))
    }
    return result
  }, [ctx.cards, ui.filters, ui.searchQuery, ui.sortPrice])

  const filtersActive = useMemo(
    () => hasActiveFilters(ui.filters, ui.searchQuery, false),
    [ui.filters, ui.searchQuery],
  )

  const allSeries = useMemo(
    () => [...new Set(ctx.cards.map((c) => c.serie))].sort(),
    [ctx.cards],
  )

  const allCharacters = useMemo(
    () => [...new Set(ctx.cards.map((c) => c.character).filter(Boolean))].sort(),
    [ctx.cards],
  )

  const updateUI = useCallback(
    (fn: (u: UIState) => UIState) => dispatch(AppAction.UpdateUI({ fn })),
    [dispatch],
  )

  const handleSelect = useCallback((index: number) => setSelectedIndex(index), [])
  const handleBack = useCallback(() => { setSelectedIndex(null); setZoomed(false) }, [])

  // ----- Detail card (inline) -----

  if (selectedIndex !== null) {
    const card = filteredCards[selectedIndex]
    if (!card) { setSelectedIndex(null); return null }
    return (
      <SharedCardDetail
        card={card}
        index={selectedIndex}
        total={filteredCards.length}
        spIndex={ctx.spIndex}
        onBack={handleBack}
        onNavigate={setSelectedIndex}
        zoomed={zoomed}
        onZoom={setZoomed}
      />
    )
  }

  // ----- List/Mosaic view -----

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>OP Wishlist</h1>
          <span className="shared-badge">Vue partagee</span>
          <span className="badge">
            {filtersActive ? `${filteredCards.length}/${ctx.cards.length} cartes` : `${ctx.cards.length} cartes`}
          </span>
          <button className="btn-theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Mode jour" : "Mode nuit"}>
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
        <div className="header-actions">
          <div className="header-toolbar">
            <div className="view-toggle">
              <button className={ui.view === "list" ? "active" : ""} onClick={() => updateUI((u) => ({ ...u, view: "list" as ViewMode }))} title="Liste">
                &#9776;
              </button>
              <button className={ui.view === "mosaic" ? "active" : ""} onClick={() => updateUI((u) => ({ ...u, view: "mosaic" as ViewMode }))} title="Mosaique">
                &#9638;
              </button>
            </div>
            <button className={`btn-filter ${ui.showFilters ? "active" : ""}`} onClick={() => updateUI((u) => ({ ...u, showFilters: !u.showFilters }))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {filtersActive && <span className="filter-dot" />}
            </button>
            <div className="sort-toggle">
              <button className={ui.sortPrice === "asc" ? "active" : ""} onClick={() => updateUI((u) => ({ ...u, sortPrice: u.sortPrice === "asc" ? null : "asc" as SortPrice }))} title="Prix croissant">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
                <span className="sort-label">&euro;</span>
              </button>
              <button className={ui.sortPrice === "desc" ? "active" : ""} onClick={() => updateUI((u) => ({ ...u, sortPrice: u.sortPrice === "desc" ? null : "desc" as SortPrice }))} title="Prix decroissant">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
                <span className="sort-label">&euro;</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <SearchBar
        query={ui.searchQuery}
        onChange={(q) => updateUI((u) => ({ ...u, searchQuery: q }))}
        allCharacters={allCharacters}
      />
      {ui.showFilters && (
        <FilterPanel
          filters={ui.filters}
          onChange={(f) => updateUI((u) => ({ ...u, filters: f }))}
          allSeries={allSeries}
        />
      )}
      {ui.view === "list" ? (
        <ListView cards={filteredCards} onSelect={handleSelect} onToggleFavorite={noopFavorite} spIndex={ctx.spIndex} />
      ) : (
        <MosaicView cards={filteredCards} onSelect={handleSelect} onToggleFavorite={noopFavorite} spIndex={ctx.spIndex} />
      )}
      <BackToTop />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SharedCardDetail — read-only card detail with zoom + swipe navigation
// ---------------------------------------------------------------------------

interface DetailProps {
  card: Card
  index: number
  total: number
  spIndex: SpIndex
  onBack: () => void
  onNavigate: (index: number) => void
  zoomed: boolean
  onZoom: (z: boolean) => void
}

function SharedCardDetail({ card, index, total, spIndex, onBack, onNavigate, zoomed, onZoom }: DetailProps) {
  const hasPrev = index > 0
  const hasNext = index < total - 1

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (direction === "left" && hasPrev) onNavigate(index - 1)
    else if (direction === "right" && hasNext) onNavigate(index + 1)
  }, [hasPrev, hasNext, index, onNavigate])

  const { dragX, isDragging, onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture({
    onSwipe: handleSwipe,
    canSwipeLeft: hasPrev,
    canSwipeRight: hasNext,
    enabled: !zoomed,
  })

  useBodyScrollLock(zoomed)

  useEffect(() => {
    if (zoomed) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1)
      else if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [zoomed, hasPrev, hasNext, index, onNavigate])

  useEffect(() => {
    if (!zoomed) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onZoom(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [zoomed, onZoom])

  const imageUrlOpt = resolveImageUrl(card, spIndex ?? EMPTY_SP_INDEX)
  const imageUrl = Option.getOrNull(imageUrlOpt)
  const dragRotation = isDragging ? dragX * 0.03 : 0

  return (
    <div className="detail">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>&#8592; Retour</button>
        <div className="detail-nav">
          <button disabled={!hasPrev} onClick={() => onNavigate(index - 1)}>&#8249;</button>
          <button disabled={!hasNext} onClick={() => onNavigate(index + 1)}>&#8250;</button>
        </div>
      </div>

      <div
        className="detail-body"
        style={{
          transform: `translateX(${dragX}px)${dragRotation ? ` rotate(${dragRotation}deg)` : ""}`,
          transition: isDragging ? "none" : "transform 0.15s ease-out",
          willChange: isDragging ? "transform" : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="detail-image-section">
          {imageUrl ? (
            <div className="detail-image-tap" onClick={() => onZoom(true)}>
              <CardImage card={card} spIndex={spIndex} className="detail-image" />
            </div>
          ) : (
            <CardImage card={card} spIndex={spIndex} className="detail-image" />
          )}
        </div>

        <div className="detail-card">
          <div className="detail-row">
            <span className="detail-label">Serie</span>
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
            <span className="detail-label">Rarete</span>
            <span className="detail-value"><RarityBadge rarity={card.rarity} size="md" /></span>
          </div>
          {pipe(card.edition, Option.map((ed) => (
            <div className="detail-row" key="edition">
              <span className="detail-label">Edition</span>
              <span className="detail-value detail-edition">{ed}</span>
            </div>
          )), Option.getOrNull)}
          <div className="detail-row">
            <span className="detail-label">Prix</span>
            <span className="detail-value">{displayPriceOrDash(card.price)}</span>
          </div>
        </div>
      </div>

      {zoomed && imageUrl && (
        <div className="image-zoom-overlay" onClick={() => onZoom(false)}>
          <button className="zoom-close" onClick={() => onZoom(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img src={imageUrl} alt={card.character} className="zoom-image" />
        </div>
      )}
    </div>
  )
}
