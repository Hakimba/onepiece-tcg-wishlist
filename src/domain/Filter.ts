import { Data, Option } from "effect"
import type { Card } from "./Card"
import * as R from "./Rarity"
import type { StandardBase } from "./Rarity"
import * as P from "./Price"

// ---------------------------------------------------------------------------
// TriState — replaces boolean | null
//
//   OCaml equivalent:
//     type tri_state = Off | Include | Exclude
// ---------------------------------------------------------------------------

export type TriState = Data.TaggedEnum<{
  Off: {}
  Include: {}
  Exclude: {}
}>

export const TriState = Data.taggedEnum<TriState>()
export const { Off, Include, Exclude } = TriState

/** Cycle: Off -> Include -> Exclude -> Off */
export const cycleTriState: (t: TriState) => TriState = TriState.$match({
  Off: () => Include(),
  Include: () => Exclude(),
  Exclude: () => Off(),
})

// ---------------------------------------------------------------------------
// FilterState
// ---------------------------------------------------------------------------

export interface FilterState {
  readonly series: ReadonlyArray<string>
  readonly rarityBases: ReadonlyArray<StandardBase>
  readonly parallel: TriState
  readonly sp: TriState
  readonly priceMin: Option.Option<number>
  readonly priceMax: Option.Option<number>
}

export const defaultFilters: FilterState = {
  series: [],
  rarityBases: [],
  parallel: Off(),
  sp: Off(),
  priceMin: Option.none(),
  priceMax: Option.none(),
}

// ---------------------------------------------------------------------------
// Predicates — each filter = Card -> boolean, composable
// ---------------------------------------------------------------------------

const bySeries = (series: ReadonlyArray<string>) => (card: Card): boolean =>
  series.length === 0 || series.includes(card.serie)

const byRarityBases = (bases: ReadonlyArray<StandardBase>) => (card: Card): boolean => {
  if (bases.length === 0) return true
  const base = R.getBase(card.rarity)
  return base !== null && (bases as readonly string[]).includes(base)
}

const byParallel = (tri: TriState) => (card: Card): boolean =>
  TriState.$match({
    Off: () => true,
    Include: () => R.isParallel(card.rarity),
    Exclude: () => !R.isParallel(card.rarity),
  })(tri)

const bySP = (tri: TriState) => (card: Card): boolean =>
  TriState.$match({
    Off: () => true,
    Include: () => R.isSP(card.rarity),
    Exclude: () => !R.isSP(card.rarity),
  })(tri)

const byPrice = (min: Option.Option<number>, max: Option.Option<number>) => (card: Card): boolean => {
  if (Option.isNone(min) && Option.isNone(max)) return true
  return P.isInRange(
    Option.getOrElse(min, () => null as number | null),
    Option.getOrElse(max, () => null as number | null),
  )(card.price)
}

const bySearch = (query: string) => (card: Card): boolean => {
  if (query === "") return true
  const q = query.toLowerCase()
  return card.character.toLowerCase().includes(q) || card.idcard.toLowerCase().includes(q)
}

const byFavorite = (onlyFavorites: boolean) => (card: Card): boolean =>
  !onlyFavorites || card.favorite

// ---------------------------------------------------------------------------
// Compose all filters into a single predicate
// ---------------------------------------------------------------------------

export const toPredicate = (
  filters: FilterState,
  searchQuery: string,
  showFavoritesOnly: boolean,
): ((card: Card) => boolean) => {
  const predicates = [
    bySeries(filters.series),
    byRarityBases(filters.rarityBases),
    byParallel(filters.parallel),
    bySP(filters.sp),
    byPrice(filters.priceMin, filters.priceMax),
    bySearch(searchQuery),
    byFavorite(showFavoritesOnly),
  ]
  return (card) => predicates.every((p) => p(card))
}

// ---------------------------------------------------------------------------
// hasActiveFilters — check if any filter is non-default
// ---------------------------------------------------------------------------

export const hasActiveFilters = (f: FilterState, searchQuery: string, showFavoritesOnly: boolean): boolean =>
  f.series.length > 0 ||
  f.rarityBases.length > 0 ||
  f.parallel._tag !== "Off" ||
  f.sp._tag !== "Off" ||
  Option.isSome(f.priceMin) ||
  Option.isSome(f.priceMax) ||
  searchQuery.trim() !== "" ||
  showFavoritesOnly
