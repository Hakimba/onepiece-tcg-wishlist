import { Data } from "effect"
import type { Card } from "./Card"

// ---------------------------------------------------------------------------
// Variant candidate (from the variants index)
// ---------------------------------------------------------------------------

export interface VariantCandidate {
  readonly suffix: string
  readonly rarity: string
  readonly cardSets: string
}

// ---------------------------------------------------------------------------
// AmbiguityReason — type somme replacing 3 optional booleans
//
//   Previously: { multiSelect?: boolean; rarityMismatch?: boolean; serieMismatch?: boolean }
//   8 combinations, most invalid.
//
//   Now: exactly 4 meaningful cases.
//
//   OCaml equivalent:
//     type ambiguity_reason =
//       | MultipleVariants
//       | RarityMismatch
//       | SerieMismatch
//       | UnspecifiedRarity
// ---------------------------------------------------------------------------

export type AmbiguityReason = Data.TaggedEnum<{
  MultipleVariants: {}
  RarityMismatch: {}
  SerieMismatch: {}
  UnspecifiedRarity: {}
}>

export const AmbiguityReason = Data.taggedEnum<AmbiguityReason>()
export const { MultipleVariants, RarityMismatch, SerieMismatch, UnspecifiedRarity } = AmbiguityReason

/** Multi-select mode derives from reason, not a separate field */
export const isMultiSelect: (r: AmbiguityReason) => boolean = AmbiguityReason.$match({
  MultipleVariants: () => false,
  RarityMismatch: () => false,
  SerieMismatch: () => false,
  UnspecifiedRarity: () => true,
})

// ---------------------------------------------------------------------------
// AmbiguousCard
// ---------------------------------------------------------------------------

export interface AmbiguousCard {
  readonly card: Card
  readonly candidates: ReadonlyArray<VariantCandidate>
  readonly canonicalName: string
  readonly chosenIndices: ReadonlyArray<number>
  readonly reason: AmbiguityReason
}

export const makeAmbiguousCard = (params: {
  readonly card: Card
  readonly candidates: ReadonlyArray<VariantCandidate>
  readonly canonicalName: string
  readonly reason: AmbiguityReason
}): AmbiguousCard => ({
  ...params,
  chosenIndices: [],
})

// ---------------------------------------------------------------------------
// Disambiguation mode
// ---------------------------------------------------------------------------

export type DisambiguationMode = "import" | "add"

// ---------------------------------------------------------------------------
// Update chosen indices (immutable)
// ---------------------------------------------------------------------------

export const toggleChoice = (item: AmbiguousCard, candidateIdx: number): AmbiguousCard => {
  if (isMultiSelect(item.reason)) {
    // Multi-select: toggle in/out
    const indices = item.chosenIndices.includes(candidateIdx)
      ? item.chosenIndices.filter((ci) => ci !== candidateIdx)
      : [...item.chosenIndices, candidateIdx]
    return { ...item, chosenIndices: indices }
  }
  // Single-select: replace or deselect
  return {
    ...item,
    chosenIndices: item.chosenIndices[0] === candidateIdx ? [] : [candidateIdx],
  }
}
