import { Data, Option } from "effect"
import type { Card } from "../domain/Card"
import { makeCardId } from "../domain/Card"
import type { Rarity } from "../domain/Rarity"
import * as R from "../domain/Rarity"
import type { AmbiguousCard, VariantCandidate } from "../domain/Disambiguation"
import {
  AmbiguityReason,
  MultipleVariants,
  RarityMismatch,
  SerieMismatch,
  UnspecifiedRarity,
  makeAmbiguousCard,
} from "../domain/Disambiguation"
import * as SC from "../domain/SetCode"

// ---------------------------------------------------------------------------
// Variant index types (from public/variants-index.json)
// ---------------------------------------------------------------------------

export interface VariantEntry {
  readonly s: string   // suffix: "", "_p1", "_p2", ...
  readonly r: string   // dotgg rarity: "R", "SR", "SP CARD", "LR", ...
  readonly cs: string  // CardSets edition name
}

export interface VariantsIndexEntry {
  readonly name: string
  readonly variants: ReadonlyArray<VariantEntry>
}

export type VariantsIndex = Readonly<Record<string, VariantsIndexEntry>>

// ---------------------------------------------------------------------------
// Resolution result — type somme for each card's outcome
// ---------------------------------------------------------------------------

export type ResolutionResult = Data.TaggedEnum<{
  AutoResolved: { readonly card: Card }
  NeedsDisambiguation: {
    readonly card: Card
    readonly candidates: ReadonlyArray<VariantCandidate>
    readonly canonicalName: string
    readonly reason: AmbiguityReason
  }
  AlreadyInWishlist: {}
  NotInIndex: { readonly card: Card }
}>

export const ResolutionResult = Data.taggedEnum<ResolutionResult>()

// ---------------------------------------------------------------------------
// Pipeline stages — each is a pure function
// ---------------------------------------------------------------------------

/** Stage 1: Filter variants by rarity */
const filterByRarity = (rarity: Rarity) => (variants: ReadonlyArray<VariantEntry>): ReadonlyArray<VariantEntry> => {
  if (R.isUnknown(rarity)) return variants

  if (R.isSP(rarity)) {
    return variants.filter((v) => v.r === "SP CARD")
  }

  const dotggBase = R.toDotggBase(rarity)

  if (R.isParallel(rarity)) {
    return variants.filter((v) =>
      v.s !== "" && v.r !== "SP CARD" && (!dotggBase || v.r === dotggBase),
    )
  }

  // Standard rarity
  return variants.filter((v) =>
    v.s === "" && (!dotggBase || v.r === dotggBase),
  )
}

/** Stage 2: Filter by explicit serie */
const filterBySerie = (
  serie: string,
): ((variants: ReadonlyArray<VariantEntry>) => { readonly result: ReadonlyArray<VariantEntry>; readonly matched: boolean }) =>
  (variants) => {
    if (!serie) return { result: variants, matched: true }
    const norm = SC.normalize(serie)
    const matched = variants.filter((v) => {
      const code = Option.getOrNull(SC.extractFromCs(v.cs))
      return code !== null && SC.normalize(code) === norm
    })
    return matched.length > 0
      ? { result: matched, matched: true }
      : { result: variants, matched: false }
  }

/** Stage 3: Filter by set (for standard rarity — avoid cross-set reprints) */
const filterBySet = (idcard: string) => (variants: ReadonlyArray<VariantEntry>): ReadonlyArray<VariantEntry> => {
  const setPrefix = Option.getOrNull(SC.extractFromIdCard(idcard))
  if (!setPrefix) return variants

  const norm = SC.normalize(setPrefix)
  const filtered: VariantEntry[] = []
  const fromOriginSet: VariantEntry[] = []

  for (const v of variants) {
    const code = Option.getOrNull(SC.extractFromCs(v.cs))
    if (!code) { filtered.push(v); continue }
    const normCode = SC.normalize(code)
    if (normCode === norm) { filtered.push(v); fromOriginSet.push(v); continue }
    if (!SC.isExtensionSet(code)) { filtered.push(v) }
  }

  if (filtered.length === 0) return variants as VariantEntry[]
  if (fromOriginSet.length > 0 && fromOriginSet.length < filtered.length) return fromOriginSet
  return filtered
}

/** Stage 4: Deduplicate — remove variants already in the wishlist */
const dedup = (existingSuffixes: ReadonlySet<string> | undefined) =>
  (variants: ReadonlyArray<VariantEntry>): ReadonlyArray<VariantEntry> => {
    if (!existingSuffixes) return variants
    return variants.filter((v) => !existingSuffixes.has(v.s))
  }

/** Convert VariantEntry to VariantCandidate */
const toCandidate = (v: VariantEntry): VariantCandidate => ({
  suffix: v.s,
  rarity: v.r,
  cardSets: v.cs,
})

// ---------------------------------------------------------------------------
// Resolve one card — the composed pipeline
// ---------------------------------------------------------------------------

const resolveOne = (
  card: Card,
  entry: VariantsIndexEntry,
  existingSuffixes: ReadonlySet<string> | undefined,
): ResolutionResult => {
  const rarity = card.rarity

  // 1. Filter by rarity on ALL variants
  const byRarity = filterByRarity(rarity)(entry.variants)

  // 2. If user explicitly provided a serie, filter by it
  const serieResult = filterBySerie(card.serie)(byRarity)
  let candidates = serieResult.result
  const serieMismatch = !serieResult.matched

  // 3. For standard rarity, use set filter to auto-resolve
  if (!serieMismatch && !R.isSP(rarity) && !R.isParallel(rarity) && !R.isUnknown(rarity)) {
    if (candidates.length > 1) {
      const bySet = filterBySet(card.idcard)(candidates)
      if (bySet.length > 0 && bySet.length < candidates.length) {
        candidates = bySet
      }
    }
  }

  const candidatesBeforeDedup = candidates.length

  // 4. Dedup
  candidates = dedup(existingSuffixes)(candidates)

  // 5. Classify result
  if (candidates.length === 0) {
    if (candidatesBeforeDedup > 0) {
      // All variants already in wishlist
      return ResolutionResult.AlreadyInWishlist()
    }

    // No candidates from rarity filter — fallback: retry without rarity filter
    if (!R.isUnknown(rarity)) {
      let fallbackVariants: ReadonlyArray<VariantEntry> = entry.variants
      if (card.serie) {
        fallbackVariants = filterBySerie(card.serie)(fallbackVariants).result
      }
      let fallbackCandidates = fallbackVariants.map(toCandidate)
      if (existingSuffixes) {
        fallbackCandidates = fallbackCandidates.filter((c) => !existingSuffixes.has(c.suffix))
      }
      if (fallbackCandidates.length > 0) {
        return ResolutionResult.NeedsDisambiguation({
          card: fillSerie(card),
          candidates: fallbackCandidates,
          canonicalName: entry.name,
          reason: RarityMismatch(),
        })
      }
    }

    // Truly no candidates — return card as-is
    return ResolutionResult.AutoResolved({
      card: fillCharacter(fillSerie(card), entry.name),
    })
  }

  if (candidates.length === 1 && !serieMismatch) {
    // Single match, no issues — auto-resolve
    const c = candidates[0]
    const updatedCard = applyResolvedVariant(card, c, entry.name)
    return ResolutionResult.AutoResolved({ card: updatedCard })
  }

  // Multiple candidates or serie mismatch — needs disambiguation
  const reason = serieMismatch
    ? SerieMismatch()
    : R.isUnknown(rarity)
      ? UnspecifiedRarity()
      : MultipleVariants()

  return ResolutionResult.NeedsDisambiguation({
    card: fillSerie(card),
    candidates: candidates.map(toCandidate),
    canonicalName: entry.name,
    reason,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fillSerie = (card: Card): Card =>
  card.serie
    ? card
    : { ...card, serie: Option.getOrElse(SC.extractFromIdCard(card.idcard), () => "") }

const fillCharacter = (card: Card, name: string): Card =>
  card.character.trim() ? card : { ...card, character: name || card.character }

const applyResolvedVariant = (card: Card, v: VariantEntry, name: string): Card => {
  const filled = fillCharacter(fillSerie(card), name)
  const needsRarityFill = R.isUnknown(card.rarity)
  const newRarity = needsRarityFill ? R.fromDotgg(v.r, v.s) : card.rarity
  return {
    ...filled,
    edition: Option.some(v.cs),
    imageSuffix: Option.some(v.s),
    rarity: newRarity,
    id: needsRarityFill ? makeCardId(card.idcard, newRarity) : card.id,
  }
}

// ---------------------------------------------------------------------------
// Main entry point — resolveVariants
// ---------------------------------------------------------------------------

export const resolveVariants = (
  cards: ReadonlyArray<Card>,
  index: VariantsIndex,
  existingCards?: ReadonlyArray<Card>,
): { readonly resolved: ReadonlyArray<Card>; readonly ambiguous: ReadonlyArray<AmbiguousCard> } => {
  // Build set of existing suffixes per idcard
  const existingSuffixesByIdcard = new Map<string, Set<string>>()
  if (existingCards) {
    for (const c of existingCards) {
      let set = existingSuffixesByIdcard.get(c.idcard)
      if (!set) {
        set = new Set()
        existingSuffixesByIdcard.set(c.idcard, set)
      }
      set.add(Option.getOrElse(c.imageSuffix, () => ""))
    }
  }

  const resolved: Card[] = []
  const ambiguous: AmbiguousCard[] = []

  for (const card of cards) {
    const entry = index[card.idcard]

    if (!entry) {
      resolved.push(fillSerie(card))
      continue
    }

    const result = resolveOne(
      card,
      entry,
      existingSuffixesByIdcard.get(card.idcard),
    )

    ResolutionResult.$match({
      AutoResolved: ({ card: c }) => { resolved.push(c) },
      NeedsDisambiguation: ({ card: c, candidates, canonicalName, reason }) => {
        ambiguous.push(makeAmbiguousCard({ card: c, candidates, canonicalName, reason }))
      },
      AlreadyInWishlist: () => { /* skip */ },
      NotInIndex: ({ card: c }) => { resolved.push(c) },
    })(result)
  }

  return { resolved, ambiguous }
}
