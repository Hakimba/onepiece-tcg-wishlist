import { Data, Either, Option, pipe } from "effect"

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
  Promo: {}
  Unknown: {}
}>

export const Rarity = Data.taggedEnum<Rarity>()
export const { Standard, Parallel, SP, Promo, Unknown } = Rarity

// ---------------------------------------------------------------------------
// RarityCategory — filterable rarity identifiers for UI
// ---------------------------------------------------------------------------

export type RarityCategory = StandardBase | "SP" | "P"
export const RARITY_CATEGORIES: ReadonlyArray<RarityCategory> = [...STANDARD_BASES, "SP", "P"]

export const toCategory: (r: Rarity) => Option.Option<RarityCategory> = Rarity.$match({
  Standard: ({ base }) => Option.some<RarityCategory>(base),
  Parallel: ({ base }) => Option.some<RarityCategory>(base),
  SP: () => Option.some<RarityCategory>("SP"),
  Promo: () => Option.some<RarityCategory>("P"),
  Unknown: () => Option.none(),
})

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

  if (
    lower === "sp" ||
    lower.startsWith("sp ") ||
    lower.startsWith("sp card")
  ) {
    return Either.right(SP())
  }

  if (lower === "p" || lower === "promo") {
    return Either.right(Promo())
  }

  const cleaned = trimmed
    .replace(/\s*(parallel|alt(ernative)?)\s*/gi, "")
    .trim()
    .toUpperCase()

  const normalized = cleaned === "SECRET" ? "SEC" : cleaned === "LEADER" ? "L" : cleaned

  if (isStandardBase(normalized)) {
    return Either.right(hasParallel ? Parallel({ base: normalized }) : Standard({ base: normalized }))
  }

  return Either.left(new RarityParseError({ input: raw }))
}

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
  Promo: () => "P",
  Unknown: () => "?",
})

// ---------------------------------------------------------------------------
// Queries (total via match — adding a variant = compile error everywhere)
// ---------------------------------------------------------------------------

export const isParallel: (r: Rarity) => boolean = Rarity.$match({
  Standard: () => false,
  Parallel: () => true,
  SP: () => false,
  Promo: () => false,
  Unknown: () => false,
})

export const isSP: (r: Rarity) => boolean = Rarity.$match({
  Standard: () => false,
  Parallel: () => false,
  SP: () => true,
  Promo: () => false,
  Unknown: () => false,
})

export const isPromo: (r: Rarity) => boolean = Rarity.$match({
  Standard: () => false,
  Parallel: () => false,
  SP: () => false,
  Promo: () => true,
  Unknown: () => false,
})

export const isUnknown: (r: Rarity) => boolean = Rarity.$match({
  Standard: () => false,
  Parallel: () => false,
  SP: () => false,
  Promo: () => false,
  Unknown: () => true,
})

export const getBase: (r: Rarity) => Option.Option<StandardBase> = Rarity.$match({
  Standard: ({ base }) => Option.some(base),
  Parallel: ({ base }) => Option.some(base),
  SP: () => Option.none(),
  Promo: () => Option.none(),
  Unknown: () => Option.none(),
})

// ---------------------------------------------------------------------------
// Colors (for UI badges)
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<RarityCategory | "?", string> = {
  C: "#6b7280",
  UC: "#9ca3af",
  R: "#3b82f6",
  SR: "#a855f7",
  SEC: "#f0c040",
  L: "#14b8a6",
  SP: "#22c55e",
  P: "#f97316",
  "?": "#6b7280",
}

export const rarityColor: (r: Rarity) => string = Rarity.$match({
  Standard: ({ base }) => CATEGORY_COLORS[base],
  Parallel: ({ base }) => CATEGORY_COLORS[base],
  SP: () => CATEGORY_COLORS["SP"],
  Promo: () => CATEGORY_COLORS["P"],
  Unknown: () => CATEGORY_COLORS["?"],
})

// ---------------------------------------------------------------------------
// Conversion from dotgg format
// ---------------------------------------------------------------------------

export const fromDotgg = (dotggRarity: string, suffix: string): Rarity => {
  if (dotggRarity === "SP CARD") return SP()
  if (dotggRarity === "P") return Promo()
  if (dotggRarity === "LR") return suffix !== "" ? Parallel({ base: "L" }) : Standard({ base: "L" })
  const base = dotggRarity.toUpperCase()
  if (isStandardBase(base)) {
    return suffix !== "" ? Parallel({ base }) : Standard({ base })
  }
  return Unknown()
}

export const toDotggBase: (r: Rarity) => Option.Option<string> = Rarity.$match({
  Standard: ({ base }) => Option.some(base),
  Parallel: ({ base }) => Option.some(base),
  SP: () => Option.some("SP CARD"),
  Promo: () => Option.some("P"),
  Unknown: () => Option.none(),
})
