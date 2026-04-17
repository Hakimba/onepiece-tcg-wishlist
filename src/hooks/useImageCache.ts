import { useState, useEffect, useRef, useCallback } from "react"
import { imageCacheGet, imageCachePut } from "../services/ImageCacheRepository"

const memoryCache = new Map<string, string>()
const MAX_MEMORY = 200

function evictOldest() {
  if (memoryCache.size <= MAX_MEMORY) return
  const first = memoryCache.keys().next().value
  if (first !== undefined) {
    URL.revokeObjectURL(memoryCache.get(first)!)
    memoryCache.delete(first)
  }
}

export function useImageCache(cdnUrl: string | null): {
  src: string | null
  onImgLoad: () => void
} {
  const memorySrc = cdnUrl ? memoryCache.get(cdnUrl) ?? null : null

  const [blobSrc, setBlobSrc] = useState<string | null>(memorySrc)
  const urlRef = useRef(cdnUrl)
  urlRef.current = cdnUrl

  useEffect(() => {
    if (!cdnUrl) {
      setBlobSrc(null)
      return
    }

    const cached = memoryCache.get(cdnUrl)
    if (cached) {
      setBlobSrc(cached)
      return
    }

    let cancelled = false

    imageCacheGet(cdnUrl)
      .then((blob) => {
        if (cancelled || urlRef.current !== cdnUrl || !blob) return
        const url = URL.createObjectURL(blob)
        memoryCache.set(cdnUrl, url)
        evictOldest()
        setBlobSrc(url)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [cdnUrl])

  const onImgLoad = useCallback(() => {
    const url = urlRef.current
    if (!url || memoryCache.has(url)) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob || urlRef.current !== url) return
        imageCachePut(url, blob).catch(() => {})
      }, "image/webp", 0.85)
    }
    img.src = url
  }, [])

  return {
    src: blobSrc ?? cdnUrl,
    onImgLoad,
  }
}
