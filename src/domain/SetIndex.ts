import { Option, pipe } from "effect"
import type { IdCard } from "./Card"
import { IdCard as mkIdCard } from "./Card"
import * as SC from "./SetCode"
import type { VariantsIndex, VariantEntry } from "../services/VariantResolver"

// ---------------------------------------------------------------------------
// SetLists — authoritative card lists per set (from limitlesstcg)
// Keys are normalised set codes, values are arrays of card keys (idcard+suffix)
// ---------------------------------------------------------------------------

export type SetLists = Readonly<Record<string, ReadonlyArray<string>>>

// ---------------------------------------------------------------------------
// SetVariantEntry — one variant in a set, displayed as one grid cell
// ---------------------------------------------------------------------------

export interface SetVariantEntry {
  readonly idcard: IdCard
  readonly name: string
  readonly variant: VariantEntry
  readonly key: string // unique display key: `${idcard}${suffix}`
}

// ---------------------------------------------------------------------------
// SET_NAMES — mapping code → nom d'extension
// Dérivé du champ cs pour la majorité, hardcodé pour les 5 sets manquants.
// ---------------------------------------------------------------------------

export const SET_NAMES: Readonly<Record<string, string>> = {
  OP01: "Romance Dawn",
  OP02: "Paramount War",
  OP03: "Pillars of Strength",
  OP04: "Kingdoms of Intrigue",
  OP05: "Awakening of the New Era",
  OP06: "Wings of the Captain",
  OP07: "500 Years in the Future",
  OP08: "Two Legends",
  OP09: "Emperors in the New World",
  OP10: "Royal Blood",
  OP11: "A Fist of Divine Speed",
  OP12: "Legacy of the Master",
  OP13: "Carrying on His Will",
  OP14: "The Azure Sea's Seven",
  OP15: "Adventure on Kami's Island",
  EB01: "Memorial Collection",
  EB02: "Anime 25th Collection",
  EB03: "One Piece Heroines Edition",
  EB04: "Egghead Crisis",
  ST01: "Straw Hat Crew",
  ST02: "Worst Generation",
  ST03: "The Seven Warlords of the Sea",
  ST04: "Animal Kingdom Pirates",
  ST05: "One Piece Film Edition",
  ST06: "Absolute Justice",
  ST07: "Big Mom Pirates",
  ST08: "Monkey D. Luffy",
  ST09: "Yamato",
  ST10: "The Three Captains",
  ST11: "Uta",
  ST12: "Zoro & Sanji",
  ST13: "The Three Brothers",
  ST14: "3D2Y",
  ST15: "Red Edward.Newgate",
  ST16: "Green Uta",
  ST17: "Blue Donquixote Doflamingo",
  ST18: "Purple Monkey.D.Luffy",
  ST19: "Black Smoker",
  ST20: "Yellow Charlotte Katakuri",
  ST21: "Gear 5",
  ST22: "Ace & Newgate",
  ST23: "Red Shanks",
  ST24: "Green Jewelry Bonney",
  ST25: "Blue Buggy",
  ST26: "Purple/Black Monkey.D.Luffy",
  ST27: "Black Marshall.D.Teach",
  ST28: "Green/Yellow Yamato",
  ST29: "Egghead",
  ST30: "Straw Hat Pirates",
  PRB01: "One Piece Card The Best",
  PRB02: "One Piece Card The Best Vol.2",
  DON: "DON!! Card",
  P: "Promos",
}

// ---------------------------------------------------------------------------
// buildSetIndex — one entry per variant, grouped by normalised set code
// Each variant is assigned to every set mentioned in its `cs` field.
// ---------------------------------------------------------------------------

const setCodesFromCs = (cs: Option.Option<string>): ReadonlyArray<string> =>
  pipe(
    cs,
    Option.match({
      onNone: () => [] as ReadonlyArray<string>,
      onSome: (s) => {
        const codes = SC.extractAllFromCs(s)
        return codes.length > 0
          ? codes.map(SC.normalize)
          : pipe(
              SC.extractFromCs(s),
              Option.map((c) => [SC.normalize(c)]),
              Option.getOrElse((): ReadonlyArray<string> => []),
            )
      },
    }),
  )

const groupAppend = (
  groups: ReadonlyMap<string, ReadonlyArray<SetVariantEntry>>,
  key: string,
  entry: SetVariantEntry,
): Map<string, ReadonlyArray<SetVariantEntry>> => {
  const m = new Map(groups)
  m.set(key, [...(m.get(key) ?? []), entry])
  return m
}

const buildCsBasedIndex = (variantsIndex: VariantsIndex): Map<string, ReadonlyArray<SetVariantEntry>> => {
  let groups: Map<string, ReadonlyArray<SetVariantEntry>> = new Map()

  for (const [key, indexEntry] of Object.entries(variantsIndex)) {
    const idcard = mkIdCard(key)
    const idcardSetCodeOpt = SC.extractFromIdCard(idcard)
    const idcardSet = pipe(idcardSetCodeOpt, Option.map(SC.normalize), Option.getOrElse(() => ""))
    const useIdcardFallback = pipe(
      idcardSetCodeOpt,
      Option.map((c) => !SC.isExtensionSet(c)),
      Option.getOrElse(() => false),
    )

    for (const variant of indexEntry.variants) {
      const ve: SetVariantEntry = { idcard, name: indexEntry.name, variant, key: `${idcard}${variant.s}` }
      const setCodes = setCodesFromCs(Option.fromNullable(variant.cs || undefined))
      if (setCodes.length > 0) {
        for (const normalized of setCodes) groups = groupAppend(groups, normalized, ve)
      } else if (useIdcardFallback && idcardSet) {
        groups = groupAppend(groups, idcardSet, ve)
      }
    }
  }
  return groups
}

const pruneRedundantReprints = (
  groups: Map<string, ReadonlyArray<SetVariantEntry>>,
): Map<string, ReadonlyArray<SetVariantEntry>> => {
  const result = new Map<string, ReadonlyArray<SetVariantEntry>>()
  for (const [setCode, entries] of groups) {
    const parallelIds = new Set(
      entries.filter((e) => e.variant.s.startsWith("_p")).map((e) => String(e.idcard)),
    )
    result.set(
      setCode,
      parallelIds.size > 0
        ? entries.filter((e) => !(e.variant.s.startsWith("_r") && parallelIds.has(String(e.idcard))))
        : entries,
    )
  }
  return result
}

const resolveCardKey = (
  cardKey: string,
  variantsIndex: VariantsIndex,
): Option.Option<SetVariantEntry> => {
  const underscoreIdx = cardKey.indexOf("_")
  const idcard = underscoreIdx >= 0 ? cardKey.slice(0, underscoreIdx) : cardKey
  const suffix = underscoreIdx >= 0 ? cardKey.slice(underscoreIdx) : ""
  return pipe(
    Option.fromNullable(variantsIndex[idcard]),
    Option.map((indexEntry) => {
      const variant = indexEntry.variants.find((v) => v.s === suffix)
        ?? pipe(
          Option.fromNullable(indexEntry.variants.find((v) => v.s === "")),
          Option.map((std): VariantEntry => suffix ? { s: suffix, r: std.r, cs: std.cs } : std),
          Option.getOrUndefined,
        )
      return variant
        ? Option.some<SetVariantEntry>({ idcard: mkIdCard(idcard), name: indexEntry.name, variant, key: cardKey })
        : Option.none<SetVariantEntry>()
    }),
    Option.flatten,
  )
}

const applySetLists = (
  groups: Map<string, ReadonlyArray<SetVariantEntry>>,
  setLists: Option.Option<SetLists>,
  variantsIndex: VariantsIndex,
): Map<string, ReadonlyArray<SetVariantEntry>> =>
  pipe(
    setLists,
    Option.match({
      onNone: () => groups,
      onSome: (lists) => {
        const result = new Map(groups)
        for (const [rawCode, cardKeys] of Object.entries(lists)) {
          const normalized = rawCode.replace(/-/g, "")
          const seen = new Set<string>()
          const authoritative = cardKeys.flatMap((cardKey) => {
            if (seen.has(cardKey)) return []
            seen.add(cardKey)
            return pipe(resolveCardKey(cardKey, variantsIndex), Option.match({ onNone: () => [], onSome: (e) => [e] }))
          })
          result.set(normalized, authoritative)
        }
        return result
      },
    }),
  )

export const buildSetIndex = (
  variantsIndex: VariantsIndex,
  setLists: Option.Option<SetLists> = Option.none(),
): ReadonlyMap<string, ReadonlyArray<SetVariantEntry>> =>
  pipe(
    buildCsBasedIndex(variantsIndex),
    pruneRedundantReprints,
    (groups) => applySetLists(groups, setLists, variantsIndex),
  )

// ---------------------------------------------------------------------------
// availableRarities — raretés présentes dans les variantes du set
// ---------------------------------------------------------------------------

const RARITY_ORDER: ReadonlyArray<string> = ["L", "C", "UC", "R", "SR", "SEC", "SP CARD", "ALT"]

export type VariantCategory = "base" | "SP CARD" | "ALT"

export const variantCategory = (v: VariantEntry): VariantCategory =>
  v.r === "SP CARD" ? "SP CARD" : v.s !== "" ? "ALT" : "base"

export const availableRarities = (
  entries: ReadonlyArray<SetVariantEntry>,
): ReadonlyArray<string> => {
  const present = new Set(
    entries.map((e) => {
      const cat = variantCategory(e.variant)
      return cat === "base" ? e.variant.r : cat
    }),
  )
  return RARITY_ORDER.filter((r) => present.has(r))
}

// ---------------------------------------------------------------------------
// filterByRarities — filtre les variantes par raretés sélectionnées
// ---------------------------------------------------------------------------

export const filterByRarities = (
  entries: ReadonlyArray<SetVariantEntry>,
  selectedRarities: ReadonlySet<string>,
): ReadonlyArray<SetVariantEntry> => {
  if (selectedRarities.size === 0) return entries
  const wantSP = selectedRarities.has("SP CARD")
  const wantAlt = selectedRarities.has("ALT")
  const baseRarities = new Set([...selectedRarities].filter((r) => r !== "SP CARD" && r !== "ALT"))
  return entries.filter((e) => {
    const cat = variantCategory(e.variant)
    if (cat === "SP CARD") return wantSP
    if (cat === "ALT") return wantAlt || (baseRarities.size > 0 && baseRarities.has(e.variant.r))
    return baseRarities.size > 0 && baseRarities.has(e.variant.r)
  })
}

// ---------------------------------------------------------------------------
// sortedSetCodes — tri par catégorie puis numérique
// ---------------------------------------------------------------------------

const PREFIX_ORDER = ["OP", "EB", "ST", "PRB", "DON", "P"] as const

const prefixRank = (code: string): number => {
  const idx = PREFIX_ORDER.findIndex((p) => code.startsWith(p))
  return idx >= 0 ? idx : PREFIX_ORDER.length
}

export const sortedSetCodes = (
  setIndex: ReadonlyMap<string, ReadonlyArray<SetVariantEntry>>,
): ReadonlyArray<string> =>
  [...setIndex.keys()].sort((a, b) => {
    const pa = prefixRank(a)
    const pb = prefixRank(b)
    if (pa !== pb) return pa - pb
    return a.localeCompare(b, undefined, { numeric: true })
  })

// ---------------------------------------------------------------------------
// Groupement par catégorie — pour l'affichage avec <optgroup>
// ---------------------------------------------------------------------------

export type SetCategory = "Booster Packs" | "Extra Booster" | "Starter Decks" | "Special" | "Autres"

export const setCategory = (code: string): SetCategory => {
  if (code.startsWith("OP")) return "Booster Packs"
  if (code.startsWith("EB")) return "Extra Booster"
  if (code.startsWith("ST")) return "Starter Decks"
  if (code.startsWith("PRB") || code === "DON" || code === "P") return "Special"
  return "Autres"
}

export const groupByCategory = (
  codes: ReadonlyArray<string>,
): ReadonlyArray<{ readonly category: SetCategory; readonly codes: ReadonlyArray<string> }> => {
  const grouped = Map.groupBy(codes, setCategory)
  const order: ReadonlyArray<SetCategory> = ["Booster Packs", "Extra Booster", "Starter Decks", "Special", "Autres"]
  return order.flatMap((category) =>
    pipe(
      Option.fromNullable(grouped.get(category)),
      Option.match({
        onNone: () => [],
        onSome: (entries) => [{ category, codes: entries }],
      }),
    ),
  )
}
