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

export const extractFromCs = (cs: string): Option.Option<SetCode> =>
  pipe(
    Option.fromNullable(cs.match(/\[([A-Z0-9-]+)\]/)),
    Option.map((m) => SetCode(m[1])),
    Option.orElse(() => {
      const bare = cs.trim()
      return /^[A-Z]+\d*-?\d+$/.test(bare) ? Option.some(SetCode(bare)) : Option.none()
    }),
  )

export const extractAllFromCs = (cs: string): ReadonlyArray<SetCode> =>
  pipe(
    Option.fromNullable(cs.match(/\[([A-Z0-9-]+)\]/)),
    Option.match({
      onNone: () => {
        const bare = cs.trim()
        return /^[A-Z]+\d*-?\d+$/.test(bare) ? [SetCode(bare)] : []
      },
      onSome: (m) => pipe(
        Option.fromNullable(m[1].match(/[A-Z]+\d+/g)),
        Option.map((parts) => parts.map(SetCode)),
        Option.getOrElse(() => [SetCode(m[1])]),
      ),
    }),
  )

// ---------------------------------------------------------------------------
// Normalization & comparison
// ---------------------------------------------------------------------------

export const normalize = (code: SetCode): string =>
  String(code).replace(/-/g, "")

export const equals = (a: SetCode, b: SetCode): boolean =>
  normalize(a) === normalize(b)

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const EXTENSION_PREFIXES = ["OP", "EB", "ST", "PRB"] as const

export const isExtensionSet = (code: SetCode): boolean =>
  EXTENSION_PREFIXES.some((p) => String(code).startsWith(p))

export const isPromoPrefix = (code: SetCode): boolean =>
  String(code) === "P"

export const isPromoId = (idcard: IdCard): boolean =>
  pipe(extractFromIdCard(idcard), Option.map(isPromoPrefix), Option.getOrElse(() => false))
