import { Data } from "effect"
import type { Card } from "../domain/Card"
import type { AmbiguousCard, DisambiguationMode } from "../domain/Disambiguation"
import type { SpIndex } from "../services/ImageResolver"
import type { VariantsIndex } from "../services/VariantResolver"
import type { SetLists } from "../domain/SetIndex"
import type { UIState } from "./AppState"

// ---------------------------------------------------------------------------
// AppAction — type somme of all possible actions
// ---------------------------------------------------------------------------

export type AppAction = Data.TaggedEnum<{
  // Initialization
  Loaded: {
    readonly cards: ReadonlyArray<Card>
    readonly spIndex: SpIndex
    readonly variantsIndex: VariantsIndex
    readonly setLists: SetLists
  }

  // Navigation
  Navigate: { readonly page: "home" | "characters" }
  SelectCard: { readonly index: number }
  DeselectCard: {}
  ShowAdd: {}
  HideAdd: {}

  // Data updates
  CardsUpdated: { readonly cards: ReadonlyArray<Card> }

  // Disambiguation
  StartDisambiguation: {
    readonly ambiguous: ReadonlyArray<AmbiguousCard>
    readonly resolved: ReadonlyArray<Card>
    readonly mode: DisambiguationMode
  }
  FinishDisambiguation: {}
  CancelDisambiguation: {}

  // UI state
  UpdateUI: { readonly fn: (ui: UIState) => UIState }

  // Shared view
  SharedLoaded: {
    readonly cards: ReadonlyArray<Card>
    readonly spIndex: SpIndex
    readonly variantsIndex: VariantsIndex
    readonly setLists: SetLists
  }

  // Errors
  SetError: { readonly error: string }
  ClearError: {}
}>

export const AppAction = Data.taggedEnum<AppAction>()
