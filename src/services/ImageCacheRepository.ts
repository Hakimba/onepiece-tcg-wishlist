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
