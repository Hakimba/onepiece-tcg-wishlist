import { useCallback } from "react"

// Trivial passthrough hook. The blob caching layer (canvasToBlob + IDB) is gone:
// the dotgg CDN doesn't send CORS headers so the canvas / fetch round-trip
// always failed silently, leaving the IDB store empty for everyone. The service
// worker (vite-plugin-pwa CacheFirst on static.dotgg.gg/onepiece/card/*.webp)
// already handles caching and offline serving, plus the browser's HTTP cache.
// We keep the hook signature so call sites (CardImage, CardDetail) don't churn.

const noop = () => {}

export function useImageCache(cdnUrl: string | null): {
  src: string | null
  onImgLoad: () => void
} {
  return { src: cdnUrl, onImgLoad: useCallback(noop, []) }
}
