import { useReducer, useCallback, useEffect, useMemo } from "react"
import { Effect, Option, pipe } from "effect"
import type { AppPage } from "../state/AppState"
import { AppPage as AP, getCtx, getUI } from "../state/AppState"
import type { AppAction as AppActionType } from "../state/AppAction"
import { AppAction } from "../state/AppAction"
import { appReducer } from "../state/AppReducer"
import * as AppEffects from "../state/AppEffects"
import { AppRuntime } from "../runtime"
import type { Card, CardId } from "../domain/Card"
import { toPredicate, hasActiveFilters } from "../domain/Filter"
import { comparePrice } from "../domain/Price"
import { downloadCsv } from "../services/CsvCodec"

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useAppStore() {
  const [state, dispatch] = useReducer(appReducer, AP.Loading() as AppPage)

  // Run an Effect and dispatch the resulting action
  const runEffect = useCallback(
    <E>(effect: Effect.Effect<AppActionType, E, any>) => {
      AppRuntime.runPromise(
        Effect.catchAll(effect, (err) => {
          console.error("Effect error:", err)
          return Effect.succeed(AppAction.SetError({ error: String(err) }) as AppActionType)
        }),
      ).then(dispatch)
    },
    [],
  )

  // ----- Initial load -----
  useEffect(() => {
    runEffect(AppEffects.loadApp)
  }, [runEffect])

  // ----- Derived state -----
  const ctxOpt = getCtx(state)
  const uiOpt = getUI(state)
  const ctx = Option.getOrNull(ctxOpt)
  const ui = Option.getOrNull(uiOpt)
  const cards: ReadonlyArray<Card> = pipe(ctxOpt, Option.map((c) => c.cards), Option.getOrElse((): ReadonlyArray<Card> => []))

  const filteredCards = useMemo(() =>
    pipe(
      uiOpt,
      Option.map((ui) => {
        const predicate = toPredicate(ui.filters, ui.searchQuery, ui.showFavoritesOnly)
        const result = cards.filter(predicate)
        if (ui.sortPrice) {
          const dir = ui.sortPrice === "asc" ? 1 : -1
          return result.sort((a, b) => dir * comparePrice(a.price, b.price))
        }
        return result
      }),
      Option.getOrElse((): ReadonlyArray<Card> => []),
    ), [cards, uiOpt])

  const filtersActive = useMemo(
    () => pipe(uiOpt, Option.map((ui) => hasActiveFilters(ui.filters, ui.searchQuery, ui.showFavoritesOnly)), Option.getOrElse(() => false)),
    [uiOpt],
  )

  const allSeries = useMemo(
    () => [...new Set(cards.map((c) => c.serie))].sort(),
    [cards],
  )

  const allCharacters = useMemo(
    () => [...new Set(cards.map((c) => c.character).filter(Boolean))].sort(),
    [cards],
  )

  // ----- Action dispatchers -----

  const handleImport = useCallback(
    (file: File) => {
      if (!ctx) return
      runEffect(AppEffects.importCsv(file, ctx.variantsIndex))
    },
    [ctx, runEffect],
  )

  const handleExport = useCallback(() => {
    downloadCsv(cards)
  }, [cards])

  const handleAdd = useCallback(
    (card: Card) => {
      if (!ctx) return
      runEffect(AppEffects.addCard(card, ctx.variantsIndex, ctx.cards))
    },
    [ctx, runEffect],
  )

  const handleUpdate = useCallback(
    (card: Card, oldId?: CardId) => {
      runEffect(AppEffects.updateCard(card, Option.fromNullable(oldId)))
    },
    [runEffect],
  )

  const handleDelete = useCallback(
    (id: CardId) => {
      runEffect(AppEffects.deleteCard(id))
      dispatch(AppAction.DeselectCard())
    },
    [runEffect],
  )

  const handleToggleFavorite = useCallback(
    (id: CardId) => {
      runEffect(AppEffects.toggleFavorite(cards, id))
    },
    [cards, runEffect],
  )

  const handleClear = useCallback(() => {
    runEffect(AppEffects.clearCards)
  }, [runEffect])

  const handleDisambiguationFinish = useCallback(
    (resultCards: ReadonlyArray<Card>) => {
      if (state._tag !== "Disambiguation") return
      runEffect(
        Effect.map(
          AppEffects.finishDisambiguation(resultCards, state.mode),
          (action) => {
            dispatch(AppAction.FinishDisambiguation())
            return action
          },
        ),
      )
    },
    [state, runEffect],
  )

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      if (state._tag !== "CardDetail") return
      const next =
        direction === "right"
          ? Math.min(state.index + 1, filteredCards.length - 1)
          : Math.max(state.index - 1, 0)
      dispatch(AppAction.SelectCard({ index: next }))
    },
    [state, filteredCards.length],
  )

  const handleSelectCharacter = useCallback(
    (name: string) => {
      dispatch(AppAction.UpdateUI({ fn: (ui) => ({ ...ui, searchQuery: name }) }))
      dispatch(AppAction.Navigate({ page: "home" }))
    },
    [],
  )

  return {
    state,
    dispatch,
    // Derived
    cards,
    filteredCards,
    filtersActive,
    allSeries,
    allCharacters,
    ctx,
    ui,
    // Action handlers
    handleImport,
    handleExport,
    handleAdd,
    handleUpdate,
    handleDelete,
    handleToggleFavorite,
    handleClear,
    handleDisambiguationFinish,
    handleSwipe,
    handleSelectCharacter,
  }
}
