import { useEffect, useRef } from "react"
import { Option, pipe } from "effect"
import type { Card } from "../domain/Card"
import type { SpIndex } from "../services/ImageResolver"
import { resolveImageUrl } from "../services/ImageResolver"
import { imageCacheGet, imageCachePut, canvasToBlob } from "../services/ImageCacheRepository"

const getCdnUrls = (cards: ReadonlyArray<Card>, spIndex: SpIndex): ReadonlyArray<string> => {
  const seen = new Set<string>()
  return cards.flatMap((card) =>
    Option.isSome(card.image)
      ? []
      : pipe(
          resolveImageUrl(card, spIndex),
          Option.match({
            onNone: () => [],
            onSome: (url) => {
              if (seen.has(url)) return []
              seen.add(url)
              return [url]
            },
          }),
        ),
  )
}

async function syncMissing(urls: ReadonlyArray<string>, signal: AbortSignal) {
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
  spIndex: Option.Option<SpIndex>,
): void {
  const cardsRef = useRef(cards)
  const spIndexRef = useRef(spIndex)
  cardsRef.current = cards
  spIndexRef.current = spIndex

  useEffect(() => {
    let ac: AbortController | undefined

    const sync = () => {
      if (!navigator.onLine) return
      pipe(
        spIndexRef.current,
        Option.match({
          onNone: () => {},
          onSome: (sp) => {
            const urls = getCdnUrls(cardsRef.current, sp)
            if (urls.length === 0) return
            ac = new AbortController()
            syncMissing(urls, ac.signal).catch(() => {})
          },
        }),
      )
    }

    sync()

    window.addEventListener("online", sync)
    return () => {
      window.removeEventListener("online", sync)
      ac?.abort()
    }
  }, [])
}
