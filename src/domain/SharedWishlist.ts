import { Data, Either, Option, pipe } from "effect"
import type { Card } from "./Card"
import { IdCard, makeCard } from "./Card"
import type { Rarity, StandardBase } from "./Rarity"
import { Rarity as R, STANDARD_BASES, Standard, Parallel, SP, Promo, Unknown } from "./Rarity"
import { Empty } from "./Price"
import type { VariantsIndex } from "../services/VariantResolver"
import * as SC from "./SetCode"

// ---------------------------------------------------------------------------
// ShareableCard — minimal projection for URL encoding
// ---------------------------------------------------------------------------

export interface ShareableCard {
  readonly idcard: IdCard
  readonly rarity: Rarity
  readonly imageSuffix: string
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ShareDecodeError = Data.TaggedEnum<{
  InvalidHash: { readonly raw: string }
  DecompressionFailed: { readonly cause: unknown }
  MalformedPayload: { readonly detail: string }
}>

export const ShareDecodeError = Data.taggedEnum<ShareDecodeError>()

// ---------------------------------------------------------------------------
// Compact rarity encoding (1-2 chars) — source de verite unique.
// STANDARD_BASES definit l'ordre : C=0 UC=1 R=2 SR=3 SEC=4 L=5. SP=6 P=7 ?=8.
// Parallel : suffixe "p" (ex: "3p" = SR Parallel).
// RARITY_TO_CODE encode via $match exhaustif, codeToRarity decode depuis le meme STANDARD_BASES.
// ---------------------------------------------------------------------------

const BASE_INDEX = Object.fromEntries(STANDARD_BASES.map((b, i) => [b, String(i)])) as Record<StandardBase, string>

const RARITY_TO_CODE: (r: Rarity) => string = R.$match({
  Standard: ({ base }) => BASE_INDEX[base],
  Parallel: ({ base }) => `${BASE_INDEX[base]}p`,
  SP: () => "6",
  Promo: () => "7",
  Unknown: () => "8",
})

const codeToRarity = (code: string): Rarity => {
  const isP = code.endsWith("p")
  const digit = isP ? code.slice(0, -1) : code
  const idx = parseInt(digit, 10)
  if (idx >= 0 && idx < STANDARD_BASES.length) {
    const base = STANDARD_BASES[idx]
    return isP ? Parallel({ base }) : Standard({ base })
  }
  if (idx === 6) return SP()
  if (idx === 7) return Promo()
  return Unknown()
}

// ---------------------------------------------------------------------------
// Card → ShareableCard (lossy projection)
// ---------------------------------------------------------------------------

export const toShareable = (card: Card): ShareableCard => ({
  idcard: card.idcard,
  rarity: card.rarity,
  imageSuffix: Option.getOrElse(card.imageSuffix, () => ""),
})

// ---------------------------------------------------------------------------
// ShareableCard → Card (reconstruct from variants-index)
// ---------------------------------------------------------------------------

export const fromShareable = (
  sc: ShareableCard,
  variantsIndex: VariantsIndex,
): Card => {
  const entry = variantsIndex[sc.idcard as string]
  const character = entry?.name ?? ""
  const serie = pipe(
    SC.extractFromIdCard(sc.idcard),
    Option.map(String),
    Option.getOrElse(() => ""),
  )
  return makeCard({
    idcard: sc.idcard as string,
    serie,
    character,
    rarity: sc.rarity,
    price: Empty(),
    imageSuffix: sc.imageSuffix || undefined,
  })
}

// ---------------------------------------------------------------------------
// Serialize: cards → compact text
// Format: idcard,rarityCode[,suffix]\n  (comma separator, no suffix if empty)
// Example: OP01-013,3p,_p1\nOP09-071,4\nOP05-119,6,_p4
// ---------------------------------------------------------------------------

export const serializeCards = (cards: ReadonlyArray<ShareableCard>): string =>
  cards
    .map((c) => {
      const code = RARITY_TO_CODE(c.rarity)
      return c.imageSuffix
        ? `${c.idcard},${code},${c.imageSuffix}`
        : `${c.idcard},${code}`
    })
    .join("\n")

// ---------------------------------------------------------------------------
// Deserialize: compact text → Either<cards, error>
// ---------------------------------------------------------------------------

export const deserializeCards = (
  text: string,
): Either.Either<ReadonlyArray<ShareableCard>, ShareDecodeError> => {
  const lines = text.split("\n").filter((l) => l.trim() !== "")
  if (lines.length === 0) {
    return Either.left(ShareDecodeError.MalformedPayload({ detail: "empty payload" }))
  }
  const cards: ShareableCard[] = []
  for (const line of lines) {
    const parts = line.split(",")
    if (parts.length < 2) {
      return Either.left(ShareDecodeError.MalformedPayload({ detail: `bad line: ${line}` }))
    }
    cards.push({
      idcard: IdCard(parts[0].trim().toUpperCase()),
      rarity: codeToRarity(parts[1].trim()),
      imageSuffix: parts[2]?.trim() ?? "",
    })
  }
  return Either.right(cards)
}
