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

const setCodesFromCs = (cs: string | null | undefined): ReadonlyArray<string> => {
  if (!cs) return []
  const codes = SC.extractAllFromCs(cs)
  return codes.length > 0
    ? codes.map((c) => SC.normalize(c))
    : pipe(
        cs,
        SC.extractFromCs,
        Option.map((c) => [SC.normalize(c)]),
        Option.getOrElse((): string[] => []),
      )
}

export const buildSetIndex = (
  variantsIndex: VariantsIndex,
  setLists?: SetLists,
): ReadonlyMap<string, ReadonlyArray<SetVariantEntry>> => {
  const map = new Map<string, SetVariantEntry[]>()

  const push = (normalized: string, entry: SetVariantEntry) => {
    let arr = map.get(normalized)
    if (!arr) {
      arr = []
      map.set(normalized, arr)
    }
    arr.push(entry)
  }

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
      const ve: SetVariantEntry = {
        idcard,
        name: indexEntry.name,
        variant,
        key: `${idcard}${variant.s}`,
      }
      const setCodes = setCodesFromCs(variant.cs)
      if (setCodes.length > 0) {
        for (const normalized of setCodes) push(normalized, ve)
      } else if (useIdcardFallback && idcardSet) {
        push(idcardSet, ve)
      }
    }
  }

  for (const [setCode, entries] of map) {
    const hasParallel = new Set<string>()
    for (const e of entries) {
      if (e.variant.s.startsWith("_p")) hasParallel.add(e.idcard as string)
    }
    if (hasParallel.size > 0) {
      map.set(
        setCode,
        entries.filter((e) =>
          !(e.variant.s.startsWith("_r") && hasParallel.has(e.idcard as string)),
        ),
      )
    }
  }

  // Phase 3: authoritative set lists replace cs-based results when available
  if (setLists) {
    for (const [rawCode, cardKeys] of Object.entries(setLists)) {
      const normalized = rawCode.replace(/-/g, "")
      const authoritative: SetVariantEntry[] = []
      const seen = new Set<string>()

      for (const cardKey of cardKeys) {
        if (seen.has(cardKey)) continue
        const underscoreIdx = cardKey.indexOf("_")
        const idcard = underscoreIdx >= 0 ? cardKey.slice(0, underscoreIdx) : cardKey
        const suffix = underscoreIdx >= 0 ? cardKey.slice(underscoreIdx) : ""

        const indexEntry = variantsIndex[idcard]
        if (!indexEntry) continue

        const matchingVariant = indexEntry.variants.find((v) => v.s === suffix)
        if (matchingVariant) {
          authoritative.push({
            idcard: mkIdCard(idcard),
            name: indexEntry.name,
            variant: matchingVariant,
            key: cardKey,
          })
          seen.add(cardKey)
          continue
        }

        const stdVariant = indexEntry.variants.find((v) => v.s === "")
        if (!stdVariant) continue
        const syntheticVariant: VariantEntry = suffix
          ? { s: suffix, r: stdVariant.r, cs: stdVariant.cs }
          : stdVariant
        authoritative.push({
          idcard: mkIdCard(idcard),
          name: indexEntry.name,
          variant: syntheticVariant,
          key: cardKey,
        })
        seen.add(cardKey)
      }

      map.set(normalized, authoritative)
    }
  }

  return map
}

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
  const present = new Set<string>()
  for (const e of entries) {
    const cat = variantCategory(e.variant)
    if (cat === "base") present.add(e.variant.r)
    else present.add(cat)
  }
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
  for (let i = 0; i < PREFIX_ORDER.length; i++) {
    if (code.startsWith(PREFIX_ORDER[i])) return i
  }
  return PREFIX_ORDER.length
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
  const groups = new Map<SetCategory, string[]>()
  for (const code of codes) {
    const cat = setCategory(code)
    let arr = groups.get(cat)
    if (!arr) {
      arr = []
      groups.set(cat, arr)
    }
    arr.push(code)
  }
  const order: ReadonlyArray<SetCategory> = ["Booster Packs", "Extra Booster", "Starter Decks", "Special", "Autres"]
  return order
    .filter((cat) => groups.has(cat))
    .map((category) => ({ category, codes: groups.get(category)! }))
}
