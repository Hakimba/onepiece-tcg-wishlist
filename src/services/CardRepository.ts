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

import { parseRarityOrUnknown } from "../domain/Rarity"
import { parsePrice } from "../domain/Price"
import { makeCard } from "../domain/Card"

// Unwrap a possibly-broken Option<string> back to a plain string|undefined.
// idb-keyval persists via structuredClone, which strips Option's prototype-based _tag.
// Without this, Option.isSome/isNone/getOrElse silently misbehave on loaded cards.
const unwrapOption = (x: unknown): string | undefined => {
  if (x == null) return undefined
  if (typeof x === "string") return x
  if (typeof x === "object") {
    const o = x as { _tag?: string; value?: unknown }
    if (o._tag === "Some") return typeof o.value === "string" ? o.value : undefined
    if (o._tag === "None") return undefined
    // Cloned Option (no _tag): Some has .value, None is empty
    if ("value" in o && typeof o.value === "string") return o.value
  }
  return undefined
}

export const CardRepositoryLive = Layer.succeed(
  CardRepository,
  CardRepository.of({
    loadAll: Effect.tryPromise({
      try: async () => {
        const raw = await get<unknown[]>(CARDS_KEY)
        if (!raw || raw.length === 0) return [] as Card[]

        // Always reconstruct cards via makeCard. Two reasons:
        // 1. Legacy migration: pre-FP-rewrite cards have rarity/price as strings.
        // 2. Effect Option proto loss: structuredClone strips Option's prototype-based
        //    _tag, breaking Option.isSome/getOrElse on every card loaded as-is.
        return raw.map((c) => {
          const o = c as Record<string, unknown>
          const rarity = typeof o.rarity === "string"
            ? parseRarityOrUnknown(o.rarity)
            : (o.rarity as Card["rarity"])
          const price = typeof o.price === "string"
            ? parsePrice(o.price)
            : (o.price as Card["price"])
          return makeCard({
            idcard: typeof o.idcard === "string" ? o.idcard : "",
            serie: typeof o.serie === "string" ? o.serie : "",
            character: typeof o.character === "string" ? o.character : "",
            rarity,
            price,
            image: unwrapOption(o.image),
            buyLink: unwrapOption(o.buyLink),
            favorite: Boolean(o.favorite),
            edition: unwrapOption(o.edition),
            imageSuffix: unwrapOption(o.imageSuffix),
          })
        })
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
