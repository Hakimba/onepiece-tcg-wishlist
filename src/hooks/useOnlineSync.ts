import { useEffect, useRef } from "react"
import { Option } from "effect"
import type { Card } from "../domain/Card"
import type { SpIndex } from "../services/ImageResolver"
import { resolveImageUrl } from "../services/ImageResolver"
import { imageCacheGet, imageCachePut, canvasToBlob } from "../services/ImageCacheRepository"

function getCdnUrls(cards: ReadonlyArray<Card>, spIndex: SpIndex): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const card of cards) {
    if (Option.isSome(card.image)) continue
    const url = Option.getOrNull(resolveImageUrl(card, spIndex))
    if (url && !seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
}

async function syncMissing(urls: string[], signal: AbortSignal) {
  const CONCURRENCY = 3
  let i = 0

  async function next(): Promise<void> {
    while (i < urls.length) {
      if (signal.aborted) return
      const url = urls[i++]
      try {
        const existing = await imageCacheGet(url)
        if (existing) continue
        const blob = await canvasToBlob(url)
        if (blob) await imageCachePut(url, blob)
      } catch {
        // skip
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => next()))
}

export function useOnlineSync(
  cards: ReadonlyArray<Card>,
  spIndex: SpIndex | undefined,
): void {
  const cardsRef = useRef(cards)
  const spIndexRef = useRef(spIndex)
  cardsRef.current = cards
  spIndexRef.current = spIndex

  useEffect(() => {
    let ac: AbortController | null = null

    const sync = () => {
      if (!navigator.onLine) return
      const sp = spIndexRef.current
      if (!sp) return
      const urls = getCdnUrls(cardsRef.current, sp)
      if (urls.length === 0) return

      ac = new AbortController()
      syncMissing(urls, ac.signal).catch(() => {})
    }

    sync()

    window.addEventListener("online", sync)
    return () => {
      window.removeEventListener("online", sync)
      ac?.abort()
    }
  }, [])
}
