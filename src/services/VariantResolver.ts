import { Data, Option, pipe } from "effect"
import type { Card } from "../domain/Card"
import type { IdCard } from "../domain/Card"
import { CharacterName, makeCardId } from "../domain/Card"
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
}>

export const ResolutionResult = Data.taggedEnum<ResolutionResult>()

// ---------------------------------------------------------------------------
// Pipeline de resolution en 4 etapes : rarete → serie → set → dedup.
// Chaque etape est une fonction pure qui filtre les variantes candidates.
// Si le pipeline tombe a 0 candidats, on fallback sans filtre rarete → disambiguation.
// ---------------------------------------------------------------------------

/** Stage 1: Filter variants by rarity */
const filterByRarity = (rarity: Rarity) => (variants: ReadonlyArray<VariantEntry>): ReadonlyArray<VariantEntry> =>
  R.Rarity.$match({
    Unknown: () => variants,
    SP: () => variants.filter((v) => v.r === "SP CARD"),
    Promo: () => variants.filter((v) => v.r === "P"),
    Parallel: () => {
      const base = pipe(R.toDotggBase(rarity), Option.getOrElse(() => ""))
      return variants.filter((v) =>
        v.s !== "" && v.r !== "SP CARD" && (base === "" || v.r === base),
      )
    },
    Standard: () => {
      const base = pipe(R.toDotggBase(rarity), Option.getOrElse(() => ""))
      return variants.filter((v) =>
        v.s === "" && (base === "" || v.r === base),
      )
    },
  })(rarity)

/** Stage 2: Filter by explicit serie */
const filterBySerie = (
  serie: string,
): ((variants: ReadonlyArray<VariantEntry>) => { readonly result: ReadonlyArray<VariantEntry>; readonly matched: boolean }) =>
  (variants) => {
    if (!serie) return { result: variants, matched: true }
    const serieCode = SC.SetCode(serie)
    const matched = variants.filter((v) =>
      SC.extractAllFromCs(v.cs).some((code) => SC.equals(code, serieCode)),
    )
    return matched.length > 0
      ? { result: matched, matched: true }
      : { result: variants, matched: false }
  }

/** Stage 3: Filter by set (for standard rarity — avoid cross-set reprints) */
const filterBySet = (idcard: IdCard) => (variants: ReadonlyArray<VariantEntry>): ReadonlyArray<VariantEntry> =>
  pipe(
    SC.extractFromIdCard(idcard),
    Option.match({
      onNone: () => variants,
      onSome: (origin) => {
        const isFromOrigin = (v: VariantEntry) => SC.extractAllFromCs(v.cs).some((c) => SC.equals(c, origin))
        const isNonExtension = (v: VariantEntry) => SC.extractAllFromCs(v.cs).every((c) => !SC.isExtensionSet(c))
        const hasNoCodes = (v: VariantEntry) => SC.extractAllFromCs(v.cs).length === 0

        const filtered = variants.filter((v) => hasNoCodes(v) || isFromOrigin(v) || isNonExtension(v))
        const fromOriginSet = filtered.filter(isFromOrigin)

        if (filtered.length === 0) return variants
        if (fromOriginSet.length > 0 && fromOriginSet.length < filtered.length) return fromOriginSet
        return filtered
      },
    }),
  )

/** Stage 4: Deduplicate — remove variants already in the wishlist */
const dedup = (existingSuffixes: Option.Option<ReadonlySet<string>>) =>
  (variants: ReadonlyArray<VariantEntry>): ReadonlyArray<VariantEntry> =>
    pipe(
      existingSuffixes,
      Option.match({
        onNone: () => variants,
        onSome: (suffixes) => variants.filter((v) => !suffixes.has(v.s)),
      }),
    )

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
  existingSuffixes: Option.Option<ReadonlySet<string>>,
): ResolutionResult => {
  const rarity = card.rarity

  // 1. Filter by rarity on ALL variants
  const byRarity = filterByRarity(rarity)(entry.variants)

  // 2. If user explicitly provided a serie, filter by it
  const serieResult = filterBySerie(card.serie)(byRarity)
  const serieMismatch = !serieResult.matched && !R.isSP(rarity)

  // 3. For standard rarity, use set filter to auto-resolve
  const shouldApplySetFilter = !serieMismatch && !R.isSP(rarity) && !R.isParallel(rarity) && !R.isUnknown(rarity)
  const afterSetFilter = shouldApplySetFilter && serieResult.result.length > 1
    ? (() => {
        const bySet = filterBySet(card.idcard)(serieResult.result)
        return bySet.length > 0 && bySet.length < serieResult.result.length ? bySet : serieResult.result
      })()
    : serieResult.result

  const candidatesBeforeDedup = afterSetFilter.length

  // 4. Dedup
  const candidates = dedup(existingSuffixes)(afterSetFilter)

  // 5. Classify result
  if (candidates.length === 0) {
    if (candidatesBeforeDedup > 0) {
      // All variants already in wishlist
      return ResolutionResult.AlreadyInWishlist()
    }

    // No candidates from rarity filter — fallback: retry without rarity filter
    if (!R.isUnknown(rarity)) {
      const fallbackVariants = card.serie
        ? filterBySerie(card.serie)(entry.variants).result
        : entry.variants
      const fallbackCandidates = pipe(
        fallbackVariants.map(toCandidate),
        (cs) => pipe(
          existingSuffixes,
          Option.match({
            onNone: () => cs,
            onSome: (suffixes) => cs.filter((c) => !suffixes.has(c.suffix)),
          }),
        ),
      )
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
    : pipe(
        SC.extractFromIdCard(card.idcard),
        Option.match({
          onNone: () => card,
          onSome: (serie) => ({ ...card, serie }),
        }),
      )

const fillCharacter = (card: Card, name: string): Card =>
  card.character.trim() ? card : { ...card, character: CharacterName(name || card.character) }

const applyResolvedVariant = (card: Card, v: VariantEntry, name: string): Card => {
  const filled = fillCharacter(fillSerie(card), name)
  const needsRarityFill = R.isUnknown(card.rarity)
  const newRarity = needsRarityFill ? R.fromDotgg(v.r, v.s) : card.rarity
  return {
    ...filled,
    edition: Option.some(v.cs),
    imageSuffix: Option.some(v.s),
    rarity: newRarity,
    // Always recompute id: imageSuffix is part of the identity now (Fix 3).
    id: makeCardId(card.idcard, newRarity, v.s),
  }
}

// ---------------------------------------------------------------------------
// Main entry point — resolveVariants
// ---------------------------------------------------------------------------

export interface ResolveResult {
  readonly resolved: ReadonlyArray<Card>
  readonly ambiguous: ReadonlyArray<AmbiguousCard>
}

const buildExistingSuffixes = (
  existingCards: Option.Option<ReadonlyArray<Card>>,
): ReadonlyMap<string, ReadonlySet<string>> =>
  pipe(
    existingCards,
    Option.match({
      onNone: () => new Map<string, ReadonlySet<string>>(),
      onSome: (cards) => {
        const grouped = Map.groupBy(cards, (c) => String(c.idcard))
        return new Map(
          [...grouped.entries()].map(([id, cs]) => [
            id,
            new Set(cs.map((c) => Option.getOrElse(c.imageSuffix, () => ""))),
          ]),
        )
      },
    }),
  )

export const resolveVariants = (
  cards: ReadonlyArray<Card>,
  index: VariantsIndex,
  existingCards: Option.Option<ReadonlyArray<Card>> = Option.none(),
): ResolveResult => {
  const suffixesByIdcard = buildExistingSuffixes(existingCards)

  return cards.reduce<ResolveResult>(
    (acc, card) =>
      pipe(
        Option.fromNullable(index[card.idcard]),
        Option.match({
          onNone: () => ({ ...acc, resolved: [...acc.resolved, fillSerie(card)] }),
          onSome: (entry) => {
            const result = resolveOne(
              card,
              entry,
              Option.fromNullable(suffixesByIdcard.get(String(card.idcard))),
            )
            return ResolutionResult.$match({
              AutoResolved: ({ card: c }) => ({ ...acc, resolved: [...acc.resolved, c] }),
              NeedsDisambiguation: ({ card: c, candidates, canonicalName, reason }) => ({
                ...acc,
                ambiguous: [...acc.ambiguous, makeAmbiguousCard({ card: c, candidates, canonicalName, reason })],
              }),
              AlreadyInWishlist: () => acc,
            })(result)
          },
        }),
      ),
    { resolved: [], ambiguous: [] },
  )
}
