import { Effect, Context, Layer, Data, Option } from "effect"
import { get, set } from "idb-keyval"
import type { Card, CardId } from "../domain/Card"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly cause: unknown
}> {}

export class DuplicateCardError extends Data.TaggedError("DuplicateCardError")<{
  readonly cardId: CardId
}> {}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export class CardRepository extends Context.Tag("CardRepository")<
  CardRepository,
  {
    readonly loadAll: Effect.Effect<ReadonlyArray<Card>, StorageError>
    readonly saveAll: (cards: ReadonlyArray<Card>) => Effect.Effect<void, StorageError>
    readonly add: (card: Card) => Effect.Effect<ReadonlyArray<Card>, DuplicateCardError | StorageError>
    readonly update: (card: Card, oldId: Option.Option<CardId>) => Effect.Effect<ReadonlyArray<Card>, StorageError>
    readonly remove: (id: CardId) => Effect.Effect<ReadonlyArray<Card>, StorageError>
  }
>() {}

// ---------------------------------------------------------------------------
// Live implementation (idb-keyval)
// ---------------------------------------------------------------------------

const CARDS_KEY = "wishlist-cards"

// Legacy format from the old codebase
interface LegacyCard {
  id: string
  serie: string
  idcard: string
  character: string
  rarity: string
  price: string
  image?: string
  buyLink?: string
  favorite?: boolean
  edition?: string
  imageSuffix?: string
}

const isLegacyCard = (c: unknown): c is LegacyCard =>
  typeof c === "object" && c !== null && "id" in c && "idcard" in c && typeof (c as LegacyCard).rarity === "string"

import { parseRarityOrUnknown } from "../domain/Rarity"
import { parsePrice } from "../domain/Price"
import { makeCard } from "../domain/Card"

export const CardRepositoryLive = Layer.succeed(
  CardRepository,
  CardRepository.of({
    loadAll: Effect.tryPromise({
      try: async () => {
        const raw = await get<unknown[]>(CARDS_KEY)
        if (!raw || raw.length === 0) return [] as Card[]

        // Check if data is in legacy format (string rarity instead of tagged enum)
        if (raw.length > 0 && isLegacyCard(raw[0])) {
          return raw.map((c) => {
            const legacy = c as LegacyCard
            return makeCard({
              idcard: legacy.idcard,
              serie: legacy.serie,
              character: legacy.character,
              rarity: parseRarityOrUnknown(legacy.rarity),
              price: parsePrice(legacy.price),
              image: legacy.image,
              buyLink: legacy.buyLink,
              favorite: legacy.favorite,
              edition: legacy.edition,
              imageSuffix: legacy.imageSuffix,
            })
          })
        }

        return raw as Card[]
      },
      catch: (cause) => new StorageError({ cause }),
    }),

    saveAll: (cards) =>
      Effect.tryPromise({
        try: () => set(CARDS_KEY, cards),
        catch: (cause) => new StorageError({ cause }),
      }),

    add: (card) =>
      Effect.gen(function* () {
        const cards = yield* Effect.tryPromise({
          try: () => get<Card[]>(CARDS_KEY),
          catch: (cause) => new StorageError({ cause }),
        })
        const existing = cards ?? []
        if (existing.some((c: Card) => c.id === card.id)) {
          return yield* Effect.fail(new DuplicateCardError({ cardId: card.id }))
        }
        const updated = [...existing, card]
        yield* Effect.tryPromise({
          try: () => set(CARDS_KEY, updated),
          catch: (cause) => new StorageError({ cause }),
        })
        return updated as ReadonlyArray<Card>
      }),

    update: (card, oldId) =>
      Effect.tryPromise({
        try: async () => {
          const cards = (await get<Card[]>(CARDS_KEY)) ?? []
          const targetId = Option.getOrElse(oldId, () => card.id)
          const updated = cards.map((c: Card) => c.id === targetId ? card : c)
          await set(CARDS_KEY, updated)
          return updated as ReadonlyArray<Card>
        },
        catch: (cause) => new StorageError({ cause }),
      }),

    remove: (id) =>
      Effect.tryPromise({
        try: async () => {
          const cards = (await get<Card[]>(CARDS_KEY)) ?? []
          const updated = cards.filter((c: Card) => c.id !== id)
          await set(CARDS_KEY, updated)
          return updated as ReadonlyArray<Card>
        },
        catch: (cause) => new StorageError({ cause }),
      }),
  }),
)
