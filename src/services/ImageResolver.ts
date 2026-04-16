import { Option } from "effect"
import type { Card } from "../domain/Card"
import * as R from "../domain/Rarity"

// ---------------------------------------------------------------------------
// CDN base URL
// ---------------------------------------------------------------------------

const CDN_BASE = "https://static.dotgg.gg/onepiece/card"

// ---------------------------------------------------------------------------
// SpIndex — Map<idcard, suffix> for SP cards
// ---------------------------------------------------------------------------

export type SpIndex = ReadonlyMap<string, string>

// ---------------------------------------------------------------------------
// resolveImageUrl : (Card, SpIndex) -> Option<string>
//
// Pure function. Pattern match on Rarity determines the suffix:
//   Standard -> "" (no suffix)
//   Parallel -> imageSuffix if present, else "_p1"
//   SP       -> lookup in spIndex
//   Unknown  -> imageSuffix if present, else None
// ---------------------------------------------------------------------------

export const resolveImageUrl = (
  card: Card,
  spIndex: SpIndex,
): Option.Option<string> => {
  // Manual image override takes precedence
  if (Option.isSome(card.image)) return card.image

  // If imageSuffix is explicitly set (from disambiguation), use it directly
  if (Option.isSome(card.imageSuffix)) {
    return Option.some(`${CDN_BASE}/${card.idcard}${Option.getOrElse(card.imageSuffix, () => "")}.webp`)
  }

  // Derive suffix from rarity
  return R.Rarity.$match({
    Standard: () => Option.some(`${CDN_BASE}/${card.idcard}.webp`),
    Parallel: () => Option.some(`${CDN_BASE}/${card.idcard}_p1.webp`),
    SP: () => {
      const suffix = spIndex.get(card.idcard)
      return suffix !== undefined
        ? Option.some(`${CDN_BASE}/${card.idcard}${suffix}.webp`)
        : Option.none()
    },
    Unknown: () => Option.some(`${CDN_BASE}/${card.idcard}.webp`),
  })(card.rarity)
}

// ---------------------------------------------------------------------------
// Variant image URL (for disambiguation picker)
// ---------------------------------------------------------------------------

export const variantImageUrl = (idcard: string, suffix: string): string =>
  `${CDN_BASE}/${idcard}${suffix}.webp`
