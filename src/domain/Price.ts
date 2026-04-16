import { Data } from "effect"

// ---------------------------------------------------------------------------
// Price — type somme
// ---------------------------------------------------------------------------

export type Price = Data.TaggedEnum<{
  Single: { readonly euros: number }
  Range: { readonly min: number; readonly max: number }
  Empty: {}
}>

export const Price = Data.taggedEnum<Price>()
export const { Single, Range, Empty } = Price

// ---------------------------------------------------------------------------
// Parse : string -> Price (total — never fails, "" -> Empty)
// ---------------------------------------------------------------------------

const cleanPriceStr = (s: string): string =>
  s.replace(/[€\s]/g, "").replace(",", ".")

export const parsePrice = (raw: string): Price => {
  const trimmed = raw.trim()
  if (trimmed === "") return Empty()

  // Try range format: "10-15", "10 - 15"
  const rangeParts = trimmed.split(/\s*-\s*/)
  if (rangeParts.length === 2) {
    const min = parseFloat(cleanPriceStr(rangeParts[0]))
    const max = parseFloat(cleanPriceStr(rangeParts[1]))
    if (!isNaN(min) && !isNaN(max)) return Range({ min, max })
  }

  // Try single value
  const cleaned = cleanPriceStr(trimmed)
  const match = cleaned.match(/[\d.]+/)
  if (match) {
    const n = parseFloat(match[0])
    if (!isNaN(n)) return Single({ euros: n })
  }

  return Empty()
}

// ---------------------------------------------------------------------------
// Display : Price -> string (total)
// ---------------------------------------------------------------------------

export const displayPrice: (p: Price) => string = Price.$match({
  Single: ({ euros }) => `${euros}€`,
  Range: ({ min, max }) => `${min}-${max}€`,
  Empty: () => "",
})

export const displayPriceOrDash = (p: Price): string =>
  displayPrice(p) || "—"

// ---------------------------------------------------------------------------
// Ordering (for sort) — Empty is always last (Infinity)
// ---------------------------------------------------------------------------

const toSortValue: (p: Price) => number = Price.$match({
  Single: ({ euros }) => euros,
  Range: ({ min }) => min,
  Empty: () => Infinity,
})

export const comparePrice = (a: Price, b: Price): number =>
  toSortValue(a) - toSortValue(b)

// ---------------------------------------------------------------------------
// Predicates for filtering
// ---------------------------------------------------------------------------

export const isInRange = (min: number | null, max: number | null) => (p: Price): boolean =>
  Price.$match({
    Single: ({ euros }) =>
      (min === null || euros >= min) && (max === null || euros <= max),
    Range: ({ min: rmin }) =>
      (min === null || rmin >= min) && (max === null || rmin <= max),
    Empty: () => false,
  })(p)
