import { Option, pipe } from "effect"
import type { AppPage } from "./AppState"
import { AppPage as AP, defaultUIState, getCtxUI, getUI, withCards, withUI } from "./AppState"
import type { AppAction } from "./AppAction"

// ---------------------------------------------------------------------------
// Helper — apply a transition only when ctx+ui are available
// ---------------------------------------------------------------------------

const withCtxUI = (state: AppPage, f: (ctx: Parameters<typeof AP.Home>[0]["ctx"], ui: Parameters<typeof AP.Home>[0]["ui"]) => AppPage): AppPage =>
  pipe(
    getCtxUI(state),
    Option.map(([ctx, ui]) => f(ctx, ui)),
    Option.getOrElse(() => state),
  )

// ---------------------------------------------------------------------------
// Reducer pur : (AppPage, AppAction) -> AppPage. Aucun side effect.
// Les side effects sont geres dans AppEffects via Effect.gen.
// Le switch est exhaustif — ajouter un variant a AppAction sans le traiter ici = erreur compile.
// ---------------------------------------------------------------------------

export const appReducer = (state: AppPage, action: AppAction): AppPage => {
  switch (action._tag) {
    // ----- Initialization -----
    case "Loaded":
      return AP.Home({
        ctx: {
          cards: action.cards,
          spIndex: action.spIndex,
          variantsIndex: action.variantsIndex,
          setLists: action.setLists,
        },
        ui: defaultUIState,
      })

    // ----- Navigation -----
    case "Navigate":
      return withCtxUI(state, (ctx, ui) => {
        const cleanUI = { ...ui, drawerOpen: false }
        switch (action.page) {
          case "home":
            return AP.Home({ ctx, ui: cleanUI })
          case "characters":
            return AP.Characters({ ctx, ui: cleanUI })
        }
        return state
      })

    case "SelectCard":
      return withCtxUI(state, (ctx, ui) =>
        AP.CardDetail({ ctx, ui, index: action.index }),
      )

    case "DeselectCard":
      return withCtxUI(state, (ctx, ui) => AP.Home({ ctx, ui }))

    case "ShowAdd":
      return withCtxUI(state, (ctx, ui) =>
        AP.AddCard({ ctx, ui, error: Option.none() }),
      )

    case "HideAdd":
      return withCtxUI(state, (ctx, ui) => AP.Home({ ctx, ui }))

    // ----- Data updates -----
    case "CardsUpdated": {
      const updated = withCards(state, action.cards)
      if (state._tag === "AddCard") {
        return withCtxUI(updated, (ctx, ui) => AP.Home({ ctx, ui }))
      }
      return updated
    }

    // ----- Disambiguation -----
    case "StartDisambiguation":
      return withCtxUI(state, (ctx, ui) =>
        AP.Disambiguation({
          ctx,
          ui,
          ambiguous: action.ambiguous,
          resolved: action.resolved,
          mode: action.mode,
        }),
      )

    case "FinishDisambiguation":
    case "CancelDisambiguation":
      return withCtxUI(state, (ctx, ui) => AP.Home({ ctx, ui }))

    // ----- Shared view -----
    case "SharedLoaded":
      return AP.SharedView({
        ctx: {
          cards: action.cards,
          spIndex: action.spIndex,
          variantsIndex: action.variantsIndex,
          setLists: action.setLists,
        },
        ui: defaultUIState,
      })

    // ----- UI state -----
    case "UpdateUI":
      return pipe(
        getUI(state),
        Option.map((ui) => withUI(state, action.fn(ui))),
        Option.getOrElse(() => state),
      )

    // ----- Errors -----
    case "SetError":
      return state._tag === "AddCard"
        ? { ...state, error: Option.some(action.error) }
        : state

    case "ClearError":
      return state._tag === "AddCard"
        ? { ...state, error: Option.none() }
        : state

    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
