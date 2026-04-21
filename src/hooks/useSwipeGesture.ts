import { useState, useRef, useCallback } from "react"

// Shared touch swipe detection — extracts the common pattern from CardDetail and SharedCardDetail.
// Returns drag state + touch handlers. The caller decides what to do on swipe (navigate, animate, etc.).

interface SwipeOptions {
  readonly onSwipe: (direction: "left" | "right") => void
  readonly canSwipeLeft: boolean
  readonly canSwipeRight: boolean
  readonly threshold?: number
  readonly enabled?: boolean
}

export function useSwipeGesture({
  onSwipe,
  canSwipeLeft,
  canSwipeRight,
  threshold = 100,
  enabled = true,
}: SwipeOptions) {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const isHorizontalSwipe = useRef<boolean | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isHorizontalSwipe.current = null
    setIsDragging(true)
  }, [enabled])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = e.touches[0].clientY - touchStartY.current

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY)
      if (!isHorizontalSwipe.current) { setIsDragging(false); return }
    }
    if (!isHorizontalSwipe.current) return

    let x = deltaX
    if ((x > 0 && !canSwipeLeft) || (x < 0 && !canSwipeRight)) x = x / 3
    setDragX(x)
  }, [canSwipeLeft, canSwipeRight])

  const onTouchEnd = useCallback(() => {
    if (touchStartX.current === null) return
    touchStartX.current = null
    touchStartY.current = null

    if (!isHorizontalSwipe.current) {
      setIsDragging(false)
      setDragX(0)
      return
    }

    if (Math.abs(dragX) > threshold) {
      const direction = dragX < 0 ? "right" as const : "left" as const
      const canGo = direction === "left" ? canSwipeLeft : canSwipeRight
      if (canGo) {
        onSwipe(direction)
        setIsDragging(false)
        setDragX(0)
        return
      }
    }

    setIsDragging(false)
    setDragX(0)
  }, [dragX, threshold, canSwipeLeft, canSwipeRight, onSwipe])

  const resetDrag = useCallback(() => {
    setDragX(0)
    setIsDragging(false)
  }, [])

  return { dragX, isDragging, setDragX, onTouchStart, onTouchMove, onTouchEnd, resetDrag }
}
