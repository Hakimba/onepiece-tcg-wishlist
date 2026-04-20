import { createStore, get, set, del, keys } from "idb-keyval"

const store = createStore("image-cache-db", "blobs")

export const imageCacheGet = (url: string): Promise<Blob | undefined> =>
  get<Blob>(url, store)

export const imageCachePut = (url: string, blob: Blob): Promise<void> =>
  set(url, blob, store)

export const imageCacheDel = (url: string): Promise<void> =>
  del(url, store)

export const imageCacheKeys = (): Promise<IDBValidKey[]> =>
  keys(store)

export const canvasToBlob = (url: string): Promise<Blob | null> =>
  new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => resolve(blob ?? null), "image/webp", 0.85)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
