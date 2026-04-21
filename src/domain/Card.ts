import { Brand, Option } from "effect"
import type { Rarity } from "./Rarity"
import { displayRarity } from "./Rarity"
import type { Price } from "./Price"
import { SetCode } from "./SetCode"

// ---------------------------------------------------------------------------
// Branded types — Brand.nominal cree un type fantome qui empeche de passer un string
// brut la ou un identifiant type est attendu. Le cout runtime est zero (identity function).
// ---------------------------------------------------------------------------

export type CardId = string & Brand.Brand<"CardId">
export const CardId = Brand.nominal<CardId>()

export type IdCard = string & Brand.Brand<"IdCard">
export const IdCard = Brand.nominal<IdCard>()

export const normalizeIdCard = (raw: string): IdCard =>
  IdCard(raw.trim().toUpperCase())

export type CharacterName = string & Brand.Brand<"CharacterName">
export const CharacterName = Brand.nominal<CharacterName>()

// ---------------------------------------------------------------------------
// Card — the core domain entity
// ---------------------------------------------------------------------------

export interface Card {
  readonly id: CardId
  readonly idcard: IdCard
  readonly serie: SetCode
  readonly character: CharacterName
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
    serie: SetCode(params.serie),
    character: CharacterName(params.character),
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
