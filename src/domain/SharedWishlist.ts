import { Data, Either, Option, pipe } from "effect"
import type { Card } from "./Card"
import { IdCard, makeCard } from "./Card"
import type { Rarity, StandardBase } from "./Rarity"
import { Rarity as R, STANDARD_BASES, Standard, Parallel, SP, Promo, Unknown } from "./Rarity"
import { Empty, parsePrice, displayPrice } from "./Price"
import type { VariantsIndex } from "../services/VariantResolver"
import * as SC from "./SetCode"

// ---------------------------------------------------------------------------
// ShareableCard — minimal projection for URL encoding
// ---------------------------------------------------------------------------

export interface ShareableCard {
  readonly idcard: IdCard
  readonly rarity: Rarity
  readonly imageSuffix: string
  readonly favorite: boolean
  readonly price: string
  readonly buyLink: string
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
  favorite: card.favorite,
  price: displayPrice(card.price),
  buyLink: Option.getOrElse(card.buyLink, () => ""),
})

// ---------------------------------------------------------------------------
// ShareableCard → Card (reconstruct from variants-index)
// ---------------------------------------------------------------------------

export const fromShareable = (
  sc: ShareableCard,
  variantsIndex: VariantsIndex,
): Card => {
  const character = pipe(
    Option.fromNullable(variantsIndex[String(sc.idcard)]),
    Option.map((e) => e.name),
    Option.getOrElse(() => ""),
  )
  const serie = pipe(
    SC.extractFromIdCard(sc.idcard),
    Option.map(String),
    Option.getOrElse(() => ""),
  )
  return makeCard({
    idcard: String(sc.idcard),
    serie,
    character,
    rarity: sc.rarity,
    price: sc.price.length > 0 ? parsePrice(sc.price) : Empty(),
    imageSuffix: sc.imageSuffix.length > 0 ? sc.imageSuffix : undefined,
    favorite: sc.favorite,
    buyLink: sc.buyLink.length > 0 ? sc.buyLink : undefined,
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
      const fav = c.favorite ? "1" : "0"
      return `${c.idcard},${code},${c.imageSuffix},${fav},${c.price},${c.buyLink}`
    })
    .join("\n")

// ---------------------------------------------------------------------------
// Deserialize: compact text → Either<cards, error>
// ---------------------------------------------------------------------------

const parseLine = (line: string): Either.Either<ShareableCard, ShareDecodeError> => {
  const parts = line.split(",")
  if (parts.length < 2) {
    return Either.left(ShareDecodeError.MalformedPayload({ detail: `bad line: ${line}` }))
  }
  const at = (i: number): string => parts[i]?.trim() ?? ""
  return Either.right({
    idcard: IdCard(at(0).toUpperCase()),
    rarity: codeToRarity(at(1)),
    imageSuffix: at(2),
    favorite: at(3) === "1",
    price: at(4),
    buyLink: at(5),
  })
}

export const deserializeCards = (
  text: string,
): Either.Either<ReadonlyArray<ShareableCard>, ShareDecodeError> => {
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return Either.left(ShareDecodeError.MalformedPayload({ detail: "empty payload" }))
  }
  return Either.all(lines.map(parseLine))
}
