import { Data, Option, pipe } from "effect"
import type { Card } from "../domain/Card"
import type { FilterState } from "../domain/Filter"
import { defaultFilters } from "../domain/Filter"
import type { AmbiguousCard, DisambiguationMode } from "../domain/Disambiguation"
import type { SpIndex } from "../services/ImageResolver"
import type { VariantsIndex } from "../services/VariantResolver"

// ---------------------------------------------------------------------------
// View modes
// ---------------------------------------------------------------------------

export type ViewMode = "list" | "mosaic"
export type SortPrice = "asc" | "desc" | null

// ---------------------------------------------------------------------------
// App Context — shared data across all page states
// ---------------------------------------------------------------------------

export interface AppContext {
  readonly cards: ReadonlyArray<Card>
  readonly spIndex: SpIndex
  readonly variantsIndex: VariantsIndex
}

// ---------------------------------------------------------------------------
// UI State — orthogonal to page, persists across navigation
// ---------------------------------------------------------------------------

export interface UIState {
  readonly view: ViewMode
  readonly sortPrice: SortPrice
  readonly showFavoritesOnly: boolean
  readonly searchQuery: string
  readonly filters: FilterState
  readonly showFilters: boolean
  readonly drawerOpen: boolean
}

export const defaultUIState: UIState = {
  view: "mosaic",
  sortPrice: null,
  showFavoritesOnly: false,
  searchQuery: "",
  filters: defaultFilters,
  showFilters: false,
  drawerOpen: false,
}

// ---------------------------------------------------------------------------
// AppPage — state machine (type somme)
//
// Each variant carries exactly the data it needs.
// Impossible to be on CardDetail without an index.
// Impossible to be in Disambiguation without ambiguous + mode.
//
// OCaml equivalent:
//   type app_page =
//     | Loading
//     | Home of app_context * ui_state
//     | CardDetail of app_context * ui_state * int
//     | AddCard of app_context * ui_state * string option
//     | Characters of app_context * ui_state
//     | Disambiguation of app_context * ui_state * ambiguous_card list * card list * disambiguation_mode
// ---------------------------------------------------------------------------

export type AppPage = Data.TaggedEnum<{
  Loading: {}
  Home: { readonly ctx: AppContext; readonly ui: UIState }
  CardDetail: { readonly ctx: AppContext; readonly ui: UIState; readonly index: number }
  AddCard: { readonly ctx: AppContext; readonly ui: UIState; readonly error: Option.Option<string> }
  Characters: { readonly ctx: AppContext; readonly ui: UIState }
  Disambiguation: {
    readonly ctx: AppContext
    readonly ui: UIState
    readonly ambiguous: ReadonlyArray<AmbiguousCard>
    readonly resolved: ReadonlyArray<Card>
    readonly mode: DisambiguationMode
  }
}>

export const AppPage = Data.taggedEnum<AppPage>()

// ---------------------------------------------------------------------------
// Helpers to extract context and UI from any non-Loading page
// ---------------------------------------------------------------------------

export const getCtx: (page: AppPage) => Option.Option<AppContext> = AppPage.$match({
  Loading: () => Option.none(),
  Home: ({ ctx }) => Option.some(ctx),
  CardDetail: ({ ctx }) => Option.some(ctx),
  AddCard: ({ ctx }) => Option.some(ctx),
  Characters: ({ ctx }) => Option.some(ctx),
  Disambiguation: ({ ctx }) => Option.some(ctx),
})

export const getUI: (page: AppPage) => Option.Option<UIState> = AppPage.$match({
  Loading: () => Option.none(),
  Home: ({ ui }) => Option.some(ui),
  CardDetail: ({ ui }) => Option.some(ui),
  AddCard: ({ ui }) => Option.some(ui),
  Characters: ({ ui }) => Option.some(ui),
  Disambiguation: ({ ui }) => Option.some(ui),
})

export const getCtxUI = (page: AppPage): Option.Option<readonly [AppContext, UIState]> =>
  pipe(
    getCtx(page),
    Option.flatMap((ctx) => pipe(getUI(page), Option.map((ui) => [ctx, ui] as const))),
  )

export const withCtx = (page: AppPage, ctx: AppContext): AppPage =>
  page._tag === "Loading" ? page : { ...page, ctx } as AppPage

export const withUI = (page: AppPage, ui: UIState): AppPage =>
  page._tag === "Loading" ? page : { ...page, ui } as AppPage

export const withCards = (page: AppPage, cards: ReadonlyArray<Card>): AppPage =>
  pipe(
    getCtx(page),
    Option.map((ctx) => withCtx(page, { ...ctx, cards })),
    Option.getOrElse(() => page),
  )
