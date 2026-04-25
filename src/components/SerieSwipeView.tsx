import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import type { SetVariantEntry } from "../domain/SetIndex"
import { fromDotgg } from "../domain/Rarity"
import { variantImageUrl } from "../services/ImageResolver"
import RarityBadge from "./RarityBadge"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  readonly entries: ReadonlyArray<SetVariantEntry>
  readonly setCode: string | null
  readonly selectedKeys: ReadonlySet<string>
  readonly onToggle: (key: string) => void
  readonly onZoom: (entry: SetVariantEntry) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 80
const DEAD_ZONE = 5
const ROTATION_FACTOR = 0.05
const EXIT_DURATION_MS = 200

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SerieSwipeView({ entries, setCode, selectedKeys, onToggle, onZoom }: Props) {
  const [processedKeys, setProcessedKeys] = useState<ReadonlyArray<string>>([])
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [imgErrors, setImgErrors] = useState<ReadonlySet<string>>(new Set())
  const [animating, setAnimating] = useState(false)

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isHorizontalSwipe = useRef<boolean | null>(null)
  const prevSetCode = useRef(setCode)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset only when the set changes — rarity filter changes must NOT reset
  useEffect(() => {
    if (prevSetCode.current !== setCode) {
      setProcessedKeys([])
      setDragX(0)
      setIsDragging(false)
      setAnimating(false)
      setImgErrors(new Set())
      if (exitTimer.current) clearTimeout(exitTimer.current)
    }
    prevSetCode.current = setCode
  }, [setCode])

  const processedSet = useMemo(() => new Set(processedKeys), [processedKeys])

  const queue = useMemo(
    () => entries.filter((e) => !processedSet.has(e.key)),
    [entries, processedSet],
  )

  const currentIndex = 0

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current) }, [])

  // ----- Commit a decision -----

  const commitDecision = useCallback((direction: "left" | "right") => {
    if (animating) return
    const entry = queue[currentIndex]
    if (!entry) return
    const accepted = direction === "right"
    if (accepted) onToggle(entry.key)
    setAnimating(true)
    setDragX(direction === "right" ? window.innerWidth : -window.innerWidth)
    setIsDragging(false)

    const key = entry.key
    exitTimer.current = setTimeout(() => {
      setProcessedKeys((prev) => [...prev, key])
      setDragX(0)
      setAnimating(false)
      exitTimer.current = null
    }, EXIT_DURATION_MS)
  }, [animating, queue, currentIndex, onToggle])

  // ----- Touch handlers -----

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (animating) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isHorizontalSwipe.current = null
    setIsDragging(true)
  }, [animating])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    if (animating) return

    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = e.touches[0].clientY - touchStartY.current

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) < DEAD_ZONE && Math.abs(deltaY) < DEAD_ZONE) return
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY)
      if (!isHorizontalSwipe.current) {
        setIsDragging(false)
        return
      }
    }

    if (!isHorizontalSwipe.current) return
    setDragX(deltaX)
  }, [animating])

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null) return
    touchStartX.current = null
    touchStartY.current = null

    if (!isHorizontalSwipe.current || animating) {
      setIsDragging(false)
      setDragX(0)
      return
    }

    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      commitDecision(dragX > 0 ? "right" : "left")
      return
    }

    setIsDragging(false)
    setDragX(0)
  }, [dragX, animating, commitDecision])

  // ----- Button handlers -----

  const handleAccept = useCallback(() => commitDecision("right"), [commitDecision])
  const handleSkip = useCallback(() => commitDecision("left"), [commitDecision])

  const handleUndo = useCallback(() => {
    if (processedKeys.length === 0 || animating) return
    const lastKey = processedKeys[processedKeys.length - 1]
    if (selectedKeys.has(lastKey)) onToggle(lastKey)
    setProcessedKeys((prev) => prev.slice(0, -1))
  }, [processedKeys, animating, onToggle, selectedKeys])

  const handleAcceptAll = useCallback(() => {
    if (animating || queue.length === 0) return
    for (const entry of queue) {
      if (!selectedKeys.has(entry.key)) onToggle(entry.key)
    }
    setProcessedKeys((prev) => [...prev, ...queue.map((e) => e.key)])
  }, [animating, queue, selectedKeys, onToggle])

  const handleImgError = useCallback((key: string) => {
    setImgErrors((prev) => new Set(prev).add(key))
  }, [])

  // ----- Render -----

  if (entries.length === 0) {
    return (
      <div className="serie-swipe-container">
        <div className="serie-swipe-done">
          Toutes les cartes sont dans ta wishlist
        </div>
      </div>
    )
  }

  if (queue.length === 0 && !animating) {
    return (
      <div className="serie-swipe-container">
        <div className="serie-swipe-done">
          <span className="serie-swipe-done-title">Termin&eacute; !</span>
          <span className="serie-swipe-done-count">
            {selectedKeys.size} carte{selectedKeys.size > 1 ? "s" : ""} s&eacute;lectionn&eacute;e{selectedKeys.size > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    )
  }

  const currentEntry = queue[currentIndex] ?? null
  const nextEntry = queue[currentIndex + 1] ?? null

  const overlayOpacity = isDragging ? Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD) : 0
  const showAccept = dragX > 0
  const showReject = dragX < 0

  const rotation = isDragging || animating ? dragX * ROTATION_FACTOR : 0
  const frontTransform = `translateX(${dragX}px) rotate(${rotation}deg)`
  const frontTransition = isDragging ? "none" : `transform ${EXIT_DURATION_MS}ms ease-out`

  return (
    <div className="serie-swipe-container">
      <div className="serie-swipe-progress">
        {processedKeys.length + 1} / {entries.length}
        <button
          type="button"
          className="serie-swipe-btn-accept-all"
          disabled={animating || queue.length === 0}
          onClick={handleAcceptAll}
        >
          Tout accepter ({queue.length})
        </button>
      </div>

      <div
        className="serie-swipe-stack"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {nextEntry && (
          <SwipeCard
            key={`behind-${nextEntry.key}`}
            entry={nextEntry}
            behind
            hasImgError={imgErrors.has(nextEntry.key)}
            onImgError={handleImgError}
            onZoom={onZoom}
          />
        )}
        {currentEntry && (
          <SwipeCard
            key={currentEntry.key}
            entry={currentEntry}
            style={{ transform: frontTransform, transition: frontTransition, willChange: isDragging || animating ? "transform" : undefined }}
            overlayOpacity={overlayOpacity}
            showAccept={showAccept}
            showReject={showReject}
            hasImgError={imgErrors.has(currentEntry.key)}
            onImgError={handleImgError}
            onZoom={onZoom}
          />
        )}
      </div>

      <div className="serie-swipe-actions">
        <button
          type="button"
          className="serie-swipe-btn serie-swipe-btn-undo"
          disabled={processedKeys.length === 0 || animating}
          onClick={handleUndo}
          aria-label="Annuler"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          type="button"
          className="serie-swipe-btn serie-swipe-btn-skip"
          disabled={animating}
          onClick={handleSkip}
          aria-label="Passer"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          className="serie-swipe-btn serie-swipe-btn-accept"
          disabled={animating}
          onClick={handleAccept}
          aria-label="Accepter"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SwipeCard — single card in the stack
// ---------------------------------------------------------------------------

interface SwipeCardProps {
  readonly entry: SetVariantEntry
  readonly behind?: boolean
  readonly style?: React.CSSProperties
  readonly overlayOpacity?: number
  readonly showAccept?: boolean
  readonly showReject?: boolean
  readonly hasImgError: boolean
  readonly onImgError: (key: string) => void
  readonly onZoom: (entry: SetVariantEntry) => void
}

function SwipeCard({
  entry, behind, style,
  overlayOpacity = 0, showAccept = false, showReject = false,
  hasImgError, onImgError, onZoom,
}: SwipeCardProps) {
  const rarity = fromDotgg(entry.variant.r, entry.variant.s)
  const imgSrc = variantImageUrl(entry.idcard, entry.variant.s)

  const handleTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onZoom(entry)
  }, [onZoom, entry])

  return (
    <div
      className={`serie-swipe-card${behind ? " behind" : ""}`}
      style={behind ? undefined : style}
    >
      {hasImgError ? (
        <div className="serie-swipe-card-placeholder">{entry.key}</div>
      ) : (
        <img
          className="serie-swipe-card-image"
          src={imgSrc}
          alt={entry.name}
          onClick={handleTap}
          onError={() => onImgError(entry.key)}
        />
      )}
      <div className="serie-swipe-card-info">
        <span className="serie-swipe-card-id">{entry.idcard}</span>
        <span className="serie-swipe-card-name">{entry.name}</span>
        <RarityBadge rarity={rarity} size="sm" />
      </div>

      {showAccept && overlayOpacity > 0 && (
        <div className="serie-swipe-overlay accept" style={{ opacity: overlayOpacity }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      {showReject && overlayOpacity > 0 && (
        <div className="serie-swipe-overlay reject" style={{ opacity: overlayOpacity }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}
    </div>
  )
}
