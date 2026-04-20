import { Brand, Option } from "effect"
import type { Rarity } from "./Rarity"
import { displayRarity } from "./Rarity"
import type { Price } from "./Price"

// ---------------------------------------------------------------------------
// Branded types — prevent accidental mixing of strings
// ---------------------------------------------------------------------------

export type CardId = string & Brand.Brand<"CardId">
export const CardId = Brand.nominal<CardId>()

export type IdCard = string & Brand.Brand<"IdCard">
export const IdCard = Brand.nominal<IdCard>()

export const normalizeIdCard = (raw: string): IdCard =>
  IdCard(raw.trim().toUpperCase())

// ---------------------------------------------------------------------------
// Card — the core domain entity
// ---------------------------------------------------------------------------

export interface Card {
  readonly id: CardId
  readonly idcard: IdCard
  readonly serie: string
  readonly character: string
  readonly rarity: Rarity
  readonly price: Price
  readonly image: Option.Option<string>
  readonly buyLink: Option.Option<string>
  readonly favorite: boolean
  readonly edition: Option.Option<string>
  readonly imageSuffix: Option.Option<string>
}

// ---------------------------------------------------------------------------
// Smart constructor
// ---------------------------------------------------------------------------

export const makeCardId = (idcard: IdCard, rarity: Rarity): CardId =>
  CardId(`${idcard}__${displayRarity(rarity)}`)

export const makeCard = (params: {
  readonly idcard: string
  readonly serie: string
  readonly character: string
  readonly rarity: Rarity
  readonly price: Price
  readonly image?: string
  readonly buyLink?: string
  readonly favorite?: boolean
  readonly edition?: string
  readonly imageSuffix?: string
}): Card => {
  const idcard = IdCard(params.idcard)
  const rarity = params.rarity
  return {
    id: makeCardId(idcard, rarity),
    idcard,
    serie: params.serie,
    character: params.character,
    rarity,
    price: params.price,
    image: Option.fromNullable(params.image),
    buyLink: Option.fromNullable(params.buyLink),
    favorite: params.favorite ?? false,
    edition: Option.fromNullable(params.edition),
    imageSuffix: Option.fromNullable(params.imageSuffix),
  }
}

// ---------------------------------------------------------------------------
// Update helpers (immutable)
// ---------------------------------------------------------------------------

export const updateCard = (card: Card, fields: Partial<Omit<Card, "id">>): Card => ({
  ...card,
  ...fields,
})

export const withNewId = (card: Card): Card => ({
  ...card,
  id: makeCardId(card.idcard, card.rarity),
})
