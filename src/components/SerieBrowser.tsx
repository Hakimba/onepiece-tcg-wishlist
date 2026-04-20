import { useState, useMemo, useCallback } from "react"
import type { Card } from "../domain/Card"
import { makeCard, makeCardId, IdCard } from "../domain/Card"
import { fromDotgg, CATEGORY_COLORS } from "../domain/Rarity"
import { Empty } from "../domain/Price"
import {
  buildSetIndex,
  availableRarities,
  filterByRarities,
  sortedSetCodes,
  groupByCategory,
  SET_NAMES,
} from "../domain/SetIndex"
import type { SetVariantEntry, SetLists } from "../domain/SetIndex"
import type { VariantsIndex } from "../services/VariantResolver"
import { variantImageUrl } from "../services/ImageResolver"
import RarityBadge from "./RarityBadge"

// ---------------------------------------------------------------------------
// Rarity display mapping (dotgg → UI color key)
// ---------------------------------------------------------------------------

const RARITY_PILL_COLORS: Readonly<Record<string, string>> = {
  L: CATEGORY_COLORS["L"],
  C: CATEGORY_COLORS["C"],
  UC: CATEGORY_COLORS["UC"],
  R: CATEGORY_COLORS["R"],
  SR: CATEGORY_COLORS["SR"],
  SEC: CATEGORY_COLORS["SEC"],
  "SP CARD": CATEGORY_COLORS["SP"],
  ALT: "#e879f9",
}

const RARITY_LABELS: Readonly<Record<string, string>> = {
  L: "Leader",
  C: "C",
  UC: "UC",
  R: "R",
  SR: "SR",
  SEC: "SEC",
  "SP CARD": "SP",
  ALT: "Alt / Parallel",
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  variantsIndex: VariantsIndex
  setLists: SetLists
  existingCards: ReadonlyArray<Card>
  onConfirm: (cards: ReadonlyArray<Card>) => void
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SerieBrowser({ variantsIndex, setLists, existingCards, onConfirm, onBack }: Props) {
  const [selectedSet, setSelectedSet] = useState<string | null>(null)
  const [selectedRarities, setSelectedRarities] = useState<ReadonlySet<string>>(new Set())
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const [imgErrors, setImgErrors] = useState<ReadonlySet<string>>(new Set())
  const [zoomedEntry, setZoomedEntry] = useState<SetVariantEntry | null>(null)

  const setIndex = useMemo(() => buildSetIndex(variantsIndex, setLists), [variantsIndex, setLists])
  const sortedSets = useMemo(() => sortedSetCodes(setIndex), [setIndex])
  const groupedSets = useMemo(() => groupByCategory(sortedSets), [sortedSets])

  const setEntries = useMemo(
    () => (selectedSet ? setIndex.get(selectedSet) ?? [] : []),
    [setIndex, selectedSet],
  )

  const rarities = useMemo(() => availableRarities(setEntries), [setEntries])

  const filteredEntries = useMemo(
    () => filterByRarities(setEntries, selectedRarities),
    [setEntries, selectedRarities],
  )

  const existingIds = useMemo(() => {
    const set = new Set<string>()
    for (const c of existingCards) set.add(c.id)
    return set
  }, [existingCards])

  const entryCardId = useCallback((e: SetVariantEntry) =>
    makeCardId(IdCard(e.idcard), fromDotgg(e.variant.r, e.variant.s)) as string,
  [])

  const selectedCount = selectedKeys.size

  const selectableCount = useMemo(
    () => filteredEntries.filter((e) => !existingIds.has(entryCardId(e))).length,
    [filteredEntries, existingIds, entryCardId],
  )

  // ----- Handlers -----

  const handleSetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    setSelectedSet(v || null)
    setSelectedRarities(new Set())
    setSelectedKeys(new Set())
    setImgErrors(new Set())
    setZoomedEntry(null)
  }, [])

  const handleToggleRarity = useCallback((rarity: string) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev)
      if (next.has(rarity)) next.delete(rarity)
      else next.add(rarity)
      return next
    })
  }, [])

  const handleToggleCard = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedKeys(new Set(
      filteredEntries
        .filter((e) => !existingIds.has(entryCardId(e)))
        .map((e) => e.key),
    ))
  }, [filteredEntries, existingIds, entryCardId])

  const handleDeselectAll = useCallback(() => {
    setSelectedKeys(new Set())
  }, [])

  const handleImgError = useCallback((key: string) => {
    setImgErrors((prev) => new Set(prev).add(key))
  }, [])

  const handleConfirm = useCallback(() => {
    const cards: Card[] = []
    for (const entry of setEntries) {
      if (!selectedKeys.has(entry.key)) continue
      const rarity = fromDotgg(entry.variant.r, entry.variant.s)
      cards.push(
        makeCard({
          idcard: entry.idcard,
          serie: selectedSet ?? "",
          character: entry.name,
          rarity,
          price: Empty(),
          imageSuffix: entry.variant.s || undefined,
        }),
      )
    }
    onConfirm(cards)
  }, [setEntries, selectedKeys, selectedSet, onConfirm])

  const handleZoom = useCallback((entry: SetVariantEntry) => {
    setZoomedEntry(entry)
  }, [])

  const handleCloseZoom = useCallback(() => {
    setZoomedEntry(null)
  }, [])

  // ----- Render -----

  return (
    <div className="serie-browser">
      <div className="serie-browser-header">
        <button className="serie-browser-back" onClick={onBack} type="button">
          ←
        </button>
        <h2>Import par série</h2>
      </div>

      <div className="serie-browser-controls">
        <select className="serie-select" value={selectedSet ?? ""} onChange={handleSetChange}>
          <option value="">-- Choisis une série --</option>
          {groupedSets.map(({ category, codes }) => (
            <optgroup key={category} label={category}>
              {codes.map((code) => (
                <option key={code} value={code}>
                  {code} — {SET_NAMES[code] ?? code}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {selectedSet && rarities.length > 0 && (
          <>
            <div className="serie-browser-rarity-pills">
              {rarities.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`serie-rarity-pill${selectedRarities.has(r) ? " selected" : ""}`}
                  style={{ "--pill-color": RARITY_PILL_COLORS[r] ?? CATEGORY_COLORS["?"] } as React.CSSProperties}
                  data-rarity={r === "SP CARD" ? "SP" : r}
                  onClick={() => handleToggleRarity(r)}
                >
                  {RARITY_LABELS[r] ?? r}
                </button>
              ))}
            </div>

            <div className="serie-browser-actions">
              <button type="button" onClick={handleSelectAll}>
                Tout sélectionner
              </button>
              <button type="button" onClick={handleDeselectAll}>
                Tout désélectionner
              </button>
            </div>
          </>
        )}
      </div>

      {!selectedSet ? (
        <div className="serie-browser-empty">
          Sélectionne une série pour voir les cartes
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="serie-browser-empty">
          Aucune carte pour ces filtres
        </div>
      ) : (
        <div className="serie-browser-grid">
          {filteredEntries.map((entry) => (
            <SerieCard
              key={entry.key}
              entry={entry}
              selected={selectedKeys.has(entry.key)}
              inWishlist={existingIds.has(entryCardId(entry))}
              hasImgError={imgErrors.has(entry.key)}
              onToggle={handleToggleCard}
              onImgError={handleImgError}
              onZoom={handleZoom}
            />
          ))}
        </div>
      )}

      {selectedSet && (
        <div className="serie-browser-footer">
          <span className="serie-browser-count">
            {selectedCount} / {selectableCount} carte{selectableCount > 1 ? "s" : ""}
          </span>
          <button
            className="serie-browser-confirm"
            disabled={selectedCount === 0}
            onClick={handleConfirm}
            type="button"
          >
            Ajouter {selectedCount} carte{selectedCount > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {zoomedEntry && (
        <div className="serie-zoom-overlay" onClick={handleCloseZoom}>
          <div className="serie-zoom-content" onClick={(e) => e.stopPropagation()}>
            <button className="serie-zoom-close" onClick={handleCloseZoom} type="button">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <img
              className="serie-zoom-image"
              src={variantImageUrl(zoomedEntry.idcard, zoomedEntry.variant.s)}
              alt={zoomedEntry.name}
            />
            <div className="serie-zoom-meta">
              <span className="serie-zoom-id">{zoomedEntry.idcard}{zoomedEntry.variant.s}</span>
              <span className="serie-zoom-name">{zoomedEntry.name}</span>
              <RarityBadge rarity={fromDotgg(zoomedEntry.variant.r, zoomedEntry.variant.s)} size="md" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SerieCard — individual variant in the grid (memoized)
// ---------------------------------------------------------------------------

interface SerieCardProps {
  entry: SetVariantEntry
  selected: boolean
  inWishlist: boolean
  hasImgError: boolean
  onToggle: (key: string) => void
  onImgError: (key: string) => void
  onZoom: (entry: SetVariantEntry) => void
}

function SerieCardInner({ entry, selected, inWishlist, hasImgError, onToggle, onImgError, onZoom }: SerieCardProps) {
  const rarity = fromDotgg(entry.variant.r, entry.variant.s)
  const imgSrc = variantImageUrl(entry.idcard, entry.variant.s)

  const handleClick = useCallback(() => {
    if (inWishlist) return
    onToggle(entry.key)
  }, [onToggle, entry.key, inWishlist])

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onZoom(entry)
  }, [onZoom, entry])

  return (
    <div
      className={`serie-card${selected ? " selected" : ""}${inWishlist ? " in-wishlist" : ""}`}
      onClick={handleClick}
    >
      {hasImgError ? (
        <div className="serie-card-placeholder">{entry.key}</div>
      ) : (
        <img
          className="serie-card-image"
          src={imgSrc}
          alt={entry.name}
          loading="lazy"
          onClick={handleImageClick}
          onError={() => onImgError(entry.key)}
        />
      )}
      <div className="serie-card-info">
        <span className="serie-card-id">{entry.idcard}</span>
        <span className="serie-card-name">{entry.name}</span>
        <span className="serie-card-rarity">
          <RarityBadge rarity={rarity} size="xs" />
        </span>
      </div>
    </div>
  )
}

import { memo } from "react"
const SerieCard = memo(SerieCardInner)
