import { useState, useEffect, useRef, useCallback } from "react"
import { imageCacheGet, imageCachePut, canvasToBlob } from "../services/ImageCacheRepository"

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
    canvasToBlob(url).then((blob) => {
      if (!blob || urlRef.current !== url) return
      imageCachePut(url, blob).catch(() => {})
    }).catch(() => {})
  }, [])

  return {
    src: blobSrc ?? cdnUrl,
    onImgLoad,
  }
}
