import { Option } from "effect"
import type { AppPage } from "./AppState"
import { AppPage as AP, defaultUIState, getCtx, getUI, withCards, withUI } from "./AppState"
import type { AppAction } from "./AppAction"

// ---------------------------------------------------------------------------
// Reducer : (AppPage, AppAction) -> AppPage
// Pure function, no side effects.
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
        },
        ui: defaultUIState,
      })

    // ----- Navigation -----
    case "Navigate": {
      const ctx = getCtx(state)
      const ui = getUI(state)
      if (!ctx || !ui) return state
      const cleanUI = { ...ui, drawerOpen: false }
      switch (action.page) {
        case "home":
          return AP.Home({ ctx, ui: cleanUI })
        case "characters":
          return AP.Characters({ ctx, ui: cleanUI })
      }
      return state
    }

    case "SelectCard": {
      const ctx = getCtx(state)
      const ui = getUI(state)
      if (!ctx || !ui) return state
      return AP.CardDetail({ ctx, ui, index: action.index })
    }

    case "DeselectCard": {
      const ctx = getCtx(state)
      const ui = getUI(state)
      if (!ctx || !ui) return state
      return AP.Home({ ctx, ui })
    }

    case "ShowAdd": {
      const ctx = getCtx(state)
      const ui = getUI(state)
      if (!ctx || !ui) return state
      return AP.AddCard({ ctx, ui, error: Option.none() })
    }

    case "HideAdd": {
      const ctx = getCtx(state)
      const ui = getUI(state)
      if (!ctx || !ui) return state
      return AP.Home({ ctx, ui })
    }

    // ----- Data updates -----
    case "CardsUpdated":
      return withCards(state, action.cards)

    // ----- Disambiguation -----
    case "StartDisambiguation": {
      const ctx = getCtx(state)
      const ui = getUI(state)
      if (!ctx || !ui) return state
      return AP.Disambiguation({
        ctx,
        ui,
        ambiguous: action.ambiguous,
        resolved: action.resolved,
        mode: action.mode,
      })
    }

    case "FinishDisambiguation":
    case "CancelDisambiguation": {
      const ctx = getCtx(state)
      const ui = getUI(state)
      if (!ctx || !ui) return state
      return AP.Home({ ctx, ui })
    }

    // ----- UI state -----
    case "UpdateUI": {
      const ui = getUI(state)
      if (!ui) return state
      return withUI(state, action.fn(ui))
    }

    // ----- Errors -----
    case "SetError": {
      if (state._tag === "AddCard") {
        return { ...state, error: Option.some(action.error) }
      }
      return state
    }

    case "ClearError": {
      if (state._tag === "AddCard") {
        return { ...state, error: Option.none() }
      }
      return state
    }
  }
}
