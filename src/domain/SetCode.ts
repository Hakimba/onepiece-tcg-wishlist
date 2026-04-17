import { Brand, Option, pipe } from "effect"
import type { IdCard } from "./Card"

// ---------------------------------------------------------------------------
// SetCode — branded type for set identifiers (OP09, P, ST01, etc.)
// ---------------------------------------------------------------------------

export type SetCode = string & Brand.Brand<"SetCode">
export const SetCode = Brand.nominal<SetCode>()

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export const extractFromIdCard = (idcard: IdCard): Option.Option<SetCode> =>
  pipe(
    idcard.match(/^([A-Z]+\d*)-/),
    Option.fromNullable,
    Option.map((m) => SetCode(m[1])),
  )

export const extractFromCs = (cs: string): Option.Option<SetCode> => {
  const bracketMatch = cs.match(/\[([A-Z0-9-]+)\]/)
  if (bracketMatch) return Option.some(SetCode(bracketMatch[1]))
  const bare = cs.trim()
  if (/^[A-Z]+\d*-?\d+$/.test(bare)) return Option.some(SetCode(bare))
  return Option.none()
}

// ---------------------------------------------------------------------------
// Normalization & comparison
// ---------------------------------------------------------------------------

export const normalize = (code: SetCode): string =>
  (code as string).replace(/-/g, "")

export const equals = (a: SetCode, b: SetCode): boolean =>
  normalize(a) === normalize(b)

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const EXTENSION_PREFIXES = ["OP", "EB", "ST", "PRB"] as const

export const isExtensionSet = (code: SetCode): boolean =>
  EXTENSION_PREFIXES.some((p) => (code as string).startsWith(p))

export const isPromoPrefix = (code: SetCode): boolean =>
  (code as string) === "P"

export const isPromoId = (idcard: IdCard): boolean =>
  pipe(extractFromIdCard(idcard), Option.map(isPromoPrefix), Option.getOrElse(() => false))
