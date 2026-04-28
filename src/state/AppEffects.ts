import { Effect, Either, Option, pipe } from "effect"
import { CardRepository } from "../services/CardRepository"
import { SpIndexService, VariantsIndexService, SetListsService } from "../services/IndexLoader"
import { parseCsv } from "../services/CsvCodec"
import { resolveVariants } from "../services/VariantResolver"
import type { VariantsIndex } from "../services/VariantResolver"
import { decodeShareUrl } from "../services/ShareUrl"
import type { Card } from "../domain/Card"
import type { CardId } from "../domain/Card"
import { AppAction } from "./AppAction"
import type { AppAction as AppActionType } from "./AppAction"

// Les constructeurs TaggedEnum retournent le type specifique du variant (ex: `Loaded`),
// pas l'union `AppAction`. Ce helper widene le type sans cast `as`.
const action = <A extends AppActionType>(a: A): AppActionType => a

// ---------------------------------------------------------------------------
// Load app — initial fetch of cards + indices
// ---------------------------------------------------------------------------

export const loadApp = Effect.gen(function* () {
  const repo = yield* CardRepository
  const spService = yield* SpIndexService
  const viService = yield* VariantsIndexService
  const slService = yield* SetListsService

  const [cards, spIndex, variantsIndex, setLists] = yield* Effect.all([
    repo.loadAll,
    Effect.orElseSucceed(spService.load, () => new Map() as ReadonlyMap<string, string>),
    Effect.orElseSucceed(viService.load, () => ({}) as VariantsIndex),
    Effect.orElseSucceed(slService.load, () => ({}) as import("../domain/SetIndex").SetLists),
  ], { concurrency: "unbounded" })

  return action(AppAction.Loaded({ cards, spIndex, variantsIndex, setLists }))
})

// ---------------------------------------------------------------------------
// Load shared view — decode URL, no IndexedDB access
// ---------------------------------------------------------------------------

export const loadSharedView = (encoded: string) =>
  Effect.gen(function* () {
    const spService = yield* SpIndexService
    const viService = yield* VariantsIndexService
    const slService = yield* SetListsService

    const [spIndex, variantsIndex, setLists] = yield* Effect.all([
      Effect.orElseSucceed(spService.load, () => new Map() as ReadonlyMap<string, string>),
      Effect.orElseSucceed(viService.load, () => ({}) as VariantsIndex),
      Effect.orElseSucceed(slService.load, () => ({}) as import("../domain/SetIndex").SetLists),
    ], { concurrency: "unbounded" })

    const decoded = decodeShareUrl(encoded, variantsIndex)

    if (Either.isLeft(decoded)) {
      const repo = yield* CardRepository
      const cards = yield* repo.loadAll
      return action(AppAction.Loaded({ cards, spIndex, variantsIndex, setLists }))
    }

    return action(AppAction.SharedLoaded({
      cards: decoded.right,
      spIndex,
      variantsIndex,
      setLists,
    }))
  })

// ---------------------------------------------------------------------------
// Import CSV
// ---------------------------------------------------------------------------

export const importCsv = (
  file: File,
  variantsIndex: VariantsIndex,
) =>
  Effect.gen(function* () {
    const text = yield* Effect.promise(() => file.text())
    const parsed = parseCsv(text)

    if (Either.isLeft(parsed)) {
      return action(AppAction.SetError({ error: `Erreur CSV: ${parsed.left._tag}` }))
    }

    const imported = parsed.right
    const { resolved, ambiguous } = resolveVariants(imported, variantsIndex)

    // Dedup both lists by card id (id includes idcard + rarity + imageSuffix
    // post-PR #27 — so true 100%-identical CSV rows collapse here).
    const dedupedResolved = [...new Map(resolved.map((c: Card) => [c.id, c])).values()]
    const dedupedAmbiguous = [...new Map(ambiguous.map((a) => [a.card.id, a])).values()]

    if (dedupedAmbiguous.length > 0) {
      return action(AppAction.StartDisambiguation({
        ambiguous: dedupedAmbiguous,
        resolved: dedupedResolved,
        mode: "import",
      }))
    }

    const repo = yield* CardRepository
    yield* repo.saveAll(dedupedResolved)

    return action(AppAction.CardsUpdated({ cards: dedupedResolved }))
  })

// ---------------------------------------------------------------------------
// Add card
// ---------------------------------------------------------------------------

export const addCard = (
  card: Card,
  variantsIndex: VariantsIndex,
  existingCards: ReadonlyArray<Card>,
) =>
  Effect.gen(function* () {
    const { resolved, ambiguous } = resolveVariants([card], variantsIndex, Option.some(existingCards))

    if (ambiguous.length > 0) {
      return action(AppAction.StartDisambiguation({
        ambiguous,
        resolved: [],
        mode: "add",
      }))
    }

    if (resolved.length === 0) {
      return action(AppAction.SetError({ error: "Cette carte existe déjà dans la wishlist" }))
    }

    const repo = yield* CardRepository
    const result = yield* Effect.either(repo.add(resolved[0]))

    if (Either.isLeft(result)) {
      const err = result.left
      if (err._tag === "DuplicateCardError") {
        return action(AppAction.SetError({ error: "Cette carte existe déjà dans la wishlist" }))
      }
      return yield* Effect.fail(err)
    }

    return action(AppAction.CardsUpdated({ cards: result.right }))
  })

// ---------------------------------------------------------------------------
// Update card
// ---------------------------------------------------------------------------

export const updateCard = (card: Card, oldId: Option.Option<CardId>) =>
  Effect.gen(function* () {
    const repo = yield* CardRepository
    const updated = yield* repo.update(card, oldId)
    return action(AppAction.CardsUpdated({ cards: updated }))
  })

// ---------------------------------------------------------------------------
// Delete card
// ---------------------------------------------------------------------------

export const deleteCard = (id: CardId) =>
  Effect.gen(function* () {
    const repo = yield* CardRepository
    const updated = yield* repo.remove(id)
    return action(AppAction.CardsUpdated({ cards: updated }))
  })

// ---------------------------------------------------------------------------
// Toggle favorite
// ---------------------------------------------------------------------------

export const toggleFavorite = (cards: ReadonlyArray<Card>, id: CardId) =>
  Effect.gen(function* () {
    return yield* pipe(
      Option.fromNullable(cards.find((c) => c.id === id)),
      Option.match({
        onNone: () => Effect.succeed(action(AppAction.CardsUpdated({ cards }))),
        onSome: (card) => Effect.gen(function* () {
          const updated = { ...card, favorite: !card.favorite }
          const repo = yield* CardRepository
          const newCards = yield* repo.update(updated, Option.none())
          return action(AppAction.CardsUpdated({ cards: newCards }))
        }),
      }),
    )
  })

// ---------------------------------------------------------------------------
// Import by serie — add selected cards to wishlist
// ---------------------------------------------------------------------------

export const importBySerie = (
  selectedCards: ReadonlyArray<Card>,
) =>
  Effect.gen(function* () {
    if (selectedCards.length === 0) {
      const repo = yield* CardRepository
      const current = yield* repo.loadAll
      return action(AppAction.CardsUpdated({ cards: current }))
    }

    const repo = yield* CardRepository
    const current = yield* repo.loadAll
    const existingIds = new Set(current.map((c: Card) => c.id))
    const merged = [...current, ...selectedCards.filter((c: Card) => !existingIds.has(c.id))]
    yield* repo.saveAll(merged)

    return action(AppAction.CardsUpdated({ cards: merged }))
  })

// ---------------------------------------------------------------------------
// Clear all cards
// ---------------------------------------------------------------------------

export const clearCards = Effect.gen(function* () {
  const repo = yield* CardRepository
  yield* repo.saveAll([])
  return action(AppAction.CardsUpdated({ cards: [] }))
})

// ---------------------------------------------------------------------------
// Finish disambiguation
// ---------------------------------------------------------------------------

export const finishDisambiguation = (
  resultCards: ReadonlyArray<Card>,
  mode: "import" | "add",
) =>
  Effect.gen(function* () {
    const repo = yield* CardRepository

    if (mode === "add") {
      const current = yield* repo.loadAll
      const existingIds = new Set(current.map((c: Card) => c.id))
      const merged = [...current, ...resultCards.filter((c) => !existingIds.has(c.id))]
      yield* repo.saveAll(merged)
      return action(AppAction.CardsUpdated({ cards: merged }))
    }

    yield* repo.saveAll(resultCards)
    return action(AppAction.CardsUpdated({ cards: resultCards }))
  })
