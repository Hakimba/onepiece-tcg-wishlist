import { Effect, Either, Option } from "effect"
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

  return AppAction.Loaded({ cards, spIndex, variantsIndex, setLists }) as AppActionType
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
      return AppAction.Loaded({ cards, spIndex, variantsIndex, setLists }) as AppActionType
    }

    return AppAction.SharedLoaded({
      cards: decoded.right,
      spIndex,
      variantsIndex,
      setLists,
    }) as AppActionType
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
      return AppAction.SetError({ error: `Erreur CSV: ${parsed.left._tag}` }) as AppActionType
    }

    const imported = parsed.right
    const { resolved, ambiguous } = resolveVariants(imported, variantsIndex)

    if (ambiguous.length > 0) {
      return AppAction.StartDisambiguation({
        ambiguous,
        resolved,
        mode: "import",
      }) as AppActionType
    }

    const seen = new Set<string>()
    const deduped = resolved.filter((c: Card) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
    const repo = yield* CardRepository
    yield* repo.saveAll(deduped)

    return AppAction.CardsUpdated({ cards: deduped }) as AppActionType
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
    const { resolved, ambiguous } = resolveVariants([card], variantsIndex, existingCards)

    if (ambiguous.length > 0) {
      return AppAction.StartDisambiguation({
        ambiguous,
        resolved: [],
        mode: "add",
      }) as AppActionType
    }

    if (resolved.length === 0) {
      return AppAction.SetError({ error: "Cette carte existe déjà dans la wishlist" }) as AppActionType
    }

    const repo = yield* CardRepository
    const result = yield* Effect.either(repo.add(resolved[0]))

    if (Either.isLeft(result)) {
      const err = result.left
      if (err._tag === "DuplicateCardError") {
        return AppAction.SetError({ error: "Cette carte existe déjà dans la wishlist" }) as AppActionType
      }
      return yield* Effect.fail(err)
    }

    return AppAction.CardsUpdated({ cards: result.right }) as AppActionType
  })

// ---------------------------------------------------------------------------
// Update card
// ---------------------------------------------------------------------------

export const updateCard = (card: Card, oldId: Option.Option<CardId>) =>
  Effect.gen(function* () {
    const repo = yield* CardRepository
    const updated = yield* repo.update(card, Option.getOrUndefined(oldId))
    return AppAction.CardsUpdated({ cards: updated }) as AppActionType
  })

// ---------------------------------------------------------------------------
// Delete card
// ---------------------------------------------------------------------------

export const deleteCard = (id: CardId) =>
  Effect.gen(function* () {
    const repo = yield* CardRepository
    const updated = yield* repo.remove(id)
    return AppAction.CardsUpdated({ cards: updated }) as AppActionType
  })

// ---------------------------------------------------------------------------
// Toggle favorite
// ---------------------------------------------------------------------------

export const toggleFavorite = (cards: ReadonlyArray<Card>, id: CardId) =>
  Effect.gen(function* () {
    const card = cards.find((c) => c.id === id)
    if (!card) return AppAction.CardsUpdated({ cards }) as AppActionType
    const updated = { ...card, favorite: !card.favorite }
    const repo = yield* CardRepository
    const newCards = yield* repo.update(updated)
    return AppAction.CardsUpdated({ cards: newCards }) as AppActionType
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
      return AppAction.CardsUpdated({ cards: current }) as AppActionType
    }

    const repo = yield* CardRepository
    const current = yield* repo.loadAll
    const existingIds = new Set(current.map((c: Card) => c.id))
    const merged = [...current, ...selectedCards.filter((c: Card) => !existingIds.has(c.id))]
    yield* repo.saveAll(merged)

    return AppAction.CardsUpdated({ cards: merged }) as AppActionType
  })

// ---------------------------------------------------------------------------
// Clear all cards
// ---------------------------------------------------------------------------

export const clearCards = Effect.gen(function* () {
  const repo = yield* CardRepository
  yield* repo.saveAll([])
  return AppAction.CardsUpdated({ cards: [] }) as AppActionType
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
      const merged = [...current]
      for (const c of resultCards) {
        if (!merged.some((x) => x.id === c.id)) merged.push(c)
      }
      yield* repo.saveAll(merged)
      return AppAction.CardsUpdated({ cards: merged }) as AppActionType
    }

    // Import mode: full replacement
    yield* repo.saveAll(resultCards)
    return AppAction.CardsUpdated({ cards: resultCards }) as AppActionType
  })
