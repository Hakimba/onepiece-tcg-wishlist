import { useEffect } from "react"

/**
 * Lock document body scroll when `locked` is true.
 * Extracted from CardDetail and DisambiguationQueue to avoid duplication.
 */
export const useBodyScrollLock = (locked: boolean): void => {
  useEffect(() => {
    document.body.style.overflow = locked ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [locked])
}
