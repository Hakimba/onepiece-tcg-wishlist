import { useEffect } from "react"

export const useBodyScrollLock = (locked: boolean): void => {
  useEffect(() => {
    document.body.style.overflow = locked ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [locked])
}
