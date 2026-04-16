import { Data, Either, pipe } from "effect"

// ---------------------------------------------------------------------------
// StandardBase — les raretés qui acceptent le modificateur Parallel
// ---------------------------------------------------------------------------

export const STANDARD_BASES = ["C", "UC", "R", "SR", "SEC", "L"] as const
export type StandardBase = (typeof STANDARD_BASES)[number]

const isStandardBase = (s: string): s is StandardBase =>
  (STANDARD_BASES as readonly string[]).includes(s)

// ---------------------------------------------------------------------------
// Rarity — type somme (SP + Parallel impossible par construction)
// ---------------------------------------------------------------------------

export type Rarity = Data.TaggedEnum<{
  Standard: { readonly base: StandardBase }
  Parallel: { readonly base: StandardBase }
  SP: {}
  Unknown: {}
}>

export const Rarity = Data.taggedEnum<Rarity>()
export const { Standard, Parallel, SP, Unknown } = Rarity

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

export class RarityParseError extends Data.TaggedError("RarityParseError")<{
  readonly input: string
}> {}

// ---------------------------------------------------------------------------
// Parsing : string -> Either<RarityParseError, Rarity>
// ---------------------------------------------------------------------------

export const parseRarity = (raw: string): Either.Either<Rarity, RarityParseError> => {
  const trimmed = raw.trim()
  if (trimmed === "" || trimmed === "?") return Either.right(Unknown())

  const lower = trimmed.toLowerCase()
  const hasParallel = lower.includes("parallel") || lower.includes("alt")

  // SP detection (before stripping parallel — "SP" is standalone)
  if (
    lower === "sp" ||
    lower.startsWith("sp ") ||
    lower.startsWith("sp card")
  ) {
    // SP + Parallel is invalid → we just return SP (SP is always unique artwork)
    return Either.right(SP())
  }

  // Strip parallel/alt modifiers to find the base
  const cleaned = trimmed
    .replace(/\s*(parallel|alt(ernative)?)\s*/gi, "")
    .trim()
    .toUpperCase()

  // Normalize common aliases
  const normalized = cleaned === "SECRET" ? "SEC" : cleaned === "LEADER" ? "L" : cleaned

  if (isStandardBase(normalized)) {
    return Either.right(hasParallel ? Parallel({ base: normalized }) : Standard({ base: normalized }))
  }

  return Either.left(new RarityParseError({ input: raw }))
}

// Total version : returns Unknown on parse failure (for CSV import compat)
export const parseRarityOrUnknown = (raw: string): Rarity =>
  pipe(
    parseRarity(raw),
    Either.getOrElse(() => Unknown()),
  )

// ---------------------------------------------------------------------------
// Display : Rarity -> string (total function, no fallback)
// ---------------------------------------------------------------------------

export const displayRarity: (r: Rarity) => string = Rarity.$match({
  Standard: ({ base }) => base === "L" ? "Leader" : base,
  Parallel: ({ base }) => `${base === "L" ? "Leader" : base} Parallel`,
  SP: () => "SP",
  Unknown: () => "?",
})

// ---------------------------------------------------------------------------
// Queries (total via match — adding a variant = compile error everywhere)
// ---------------------------------------------------------------------------

export const isParallel: (r: Rarity) => boolean = Rarity.$match({
  Standard: () => false,
  Parallel: () => true,
  SP: () => false,
  Unknown: () => false,
})

export const isSP: (r: Rarity) => boolean = Rarity.$match({
  Standard: () => false,
  Parallel: () => false,
  SP: () => true,
  Unknown: () => false,
})

export const isUnknown: (r: Rarity) => boolean = Rarity.$match({
  Standard: () => false,
  Parallel: () => false,
  SP: () => false,
  Unknown: () => true,
})

/** Get the StandardBase if applicable (Standard or Parallel), None for SP/Unknown */
export const getBase: (r: Rarity) => StandardBase | null = Rarity.$match({
  Standard: ({ base }) => base,
  Parallel: ({ base }) => base,
  SP: () => null,
  Unknown: () => null,
})

// ---------------------------------------------------------------------------
// Colors (for UI badges)
// ---------------------------------------------------------------------------

export const RARITY_COLORS: Record<StandardBase | "SP" | "?", string> = {
  C: "#6b7280",
  UC: "#9ca3af",
  R: "#3b82f6",
  SR: "#a855f7",
  SEC: "#f0c040",
  L: "#14b8a6",
  SP: "#22c55e",
  "?": "#6b7280",
}

export const rarityColor: (r: Rarity) => string = Rarity.$match({
  Standard: ({ base }) => RARITY_COLORS[base],
  Parallel: ({ base }) => RARITY_COLORS[base],
  SP: () => RARITY_COLORS["SP"],
  Unknown: () => RARITY_COLORS["?"],
})

// ---------------------------------------------------------------------------
// Conversion from dotgg format
// ---------------------------------------------------------------------------

export const fromDotgg = (dotggRarity: string, suffix: string): Rarity => {
  if (dotggRarity === "SP CARD") return SP()
  if (dotggRarity === "LR") return suffix !== "" ? Parallel({ base: "L" }) : Standard({ base: "L" })
  const base = dotggRarity.toUpperCase()
  if (isStandardBase(base)) {
    return suffix !== "" ? Parallel({ base }) : Standard({ base })
  }
  return Unknown()
}

/** Build a Rarity from UI picker state */
export const buildRarity = (base: StandardBase | null, isParallelFlag: boolean, isSPFlag: boolean): Rarity => {
  if (isSPFlag) return SP()
  if (base) return isParallelFlag ? Parallel({ base }) : Standard({ base })
  return Unknown()
}

/** Map app rarity base to dotgg format for variant filtering */
export const toDotggBase: (r: Rarity) => string | null = Rarity.$match({
  Standard: ({ base }) => base === "L" ? "L" : base,
  Parallel: ({ base }) => base === "L" ? "L" : base,
  SP: () => "SP CARD",
  Unknown: () => null,
})
