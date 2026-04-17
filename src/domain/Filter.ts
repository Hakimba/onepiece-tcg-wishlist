import { Option, pipe } from "effect"
import type { Card } from "./Card"
import * as R from "./Rarity"
import type { RarityCategory } from "./Rarity"
import * as P from "./Price"

// ---------------------------------------------------------------------------
// FilterState
// ---------------------------------------------------------------------------

export interface FilterState {
  readonly series: ReadonlyArray<string>
  readonly rarityBases: ReadonlyArray<RarityCategory>
  readonly parallel: boolean
  readonly priceMin: Option.Option<number>
  readonly priceMax: Option.Option<number>
}

export const defaultFilters: FilterState = {
  series: [],
  rarityBases: [],
  parallel: false,
  priceMin: Option.none(),
  priceMax: Option.none(),
}

// ---------------------------------------------------------------------------
// Predicates — each filter = Card -> boolean, composable
// ---------------------------------------------------------------------------

const bySeries = (series: ReadonlyArray<string>) => (card: Card): boolean =>
  series.length === 0 || series.includes(card.serie)

const byRarityBases = (bases: ReadonlyArray<RarityCategory>) => (card: Card): boolean => {
  if (bases.length === 0) return true
  return pipe(
    R.toCategory(card.rarity),
    Option.map((cat) => (bases as readonly string[]).includes(cat)),
    Option.getOrElse(() => false),
  )
}

const byParallel = (on: boolean) => (card: Card): boolean =>
  !on || R.isParallel(card.rarity)

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
  f.parallel ||
  Option.isSome(f.priceMin) ||
  Option.isSome(f.priceMax) ||
  searchQuery.trim() !== "" ||
  showFavoritesOnly
