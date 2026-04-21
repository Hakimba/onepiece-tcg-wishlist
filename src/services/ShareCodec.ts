import { Either } from "effect"
import { deflateSync, inflateSync } from "fflate"
import { ShareDecodeError } from "../domain/SharedWishlist"

// Compression synchrone (pas d'async) — le payload est toujours sub-1KB.
// deflateSync niveau 9 + base64url (URL-safe, sans padding).

// ---------------------------------------------------------------------------
// Base64url (URL-safe, no padding)
// ---------------------------------------------------------------------------

const toBase64url = (bytes: Uint8Array): string => {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const fromBase64url = (s: string): Either.Either<Uint8Array, ShareDecodeError> =>
  Either.try({
    try: () => {
      const padded = s.replace(/-/g, "+").replace(/_/g, "/")
      const binary = atob(padded)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes
    },
    catch: () => ShareDecodeError.InvalidHash({ raw: s }),
  })

// ---------------------------------------------------------------------------
// Encode: text → deflate → base64url
// ---------------------------------------------------------------------------

export const encode = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  const compressed = deflateSync(bytes, { level: 9 })
  return toBase64url(compressed)
}

// ---------------------------------------------------------------------------
// Decode: base64url → inflate → text
// ---------------------------------------------------------------------------

export const decode = (encoded: string): Either.Either<string, ShareDecodeError> =>
  Either.flatMap(fromBase64url(encoded), (compressed) =>
    Either.try({
      try: () => new TextDecoder().decode(inflateSync(compressed)),
      catch: (cause) => ShareDecodeError.DecompressionFailed({ cause }),
    }),
  )
