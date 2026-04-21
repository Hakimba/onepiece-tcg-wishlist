import { Either } from "effect"
import { deflateSync, inflateSync } from "fflate"
import { ShareDecodeError } from "../domain/SharedWishlist"

// ---------------------------------------------------------------------------
// Base64url (URL-safe, no padding)
// ---------------------------------------------------------------------------

const toBase64url = (bytes: Uint8Array): string => {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const fromBase64url = (s: string): Either.Either<Uint8Array, ShareDecodeError> => {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return Either.right(bytes)
  } catch {
    return Either.left(ShareDecodeError.InvalidHash({ raw: s }))
  }
}

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
  Either.flatMap(fromBase64url(encoded), (compressed) => {
    try {
      const bytes = inflateSync(compressed)
      return Either.right(new TextDecoder().decode(bytes))
    } catch (cause) {
      return Either.left(ShareDecodeError.DecompressionFailed({ cause }))
    }
  })
