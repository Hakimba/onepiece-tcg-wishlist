import { useCallback } from "react"
import type { Card } from "../domain/Card"
import { generateShareFragment } from "../services/ShareUrl"

export function useShareHandler(cards: ReadonlyArray<Card>) {
  return useCallback(async (): Promise<string> => {
    const fragment = generateShareFragment(cards)
    const longUrl = `${window.location.origin}${window.location.pathname}${fragment}`

    let url = longUrl
    try {
      const resp = await fetch(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`,
      )
      if (resp.ok) {
        const data = await resp.json()
        if (data.shorturl) url = data.shorturl
      }
    } catch {
      // fallback to long URL
    }

    if (navigator.share) {
      navigator.share({ title: "OP Wishlist", url }).catch(() => {
        navigator.clipboard.writeText(url).catch(() => {})
      })
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
    }
    return url
  }, [cards])
}
