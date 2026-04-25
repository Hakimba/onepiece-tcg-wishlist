import { Option, pipe } from "effect"
import type { Card, IdCard } from "../domain/Card"
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
//   Manual override -> card.image
//   Explicit imageSuffix -> use directly
//   Standard -> "" (no suffix)
//   Parallel -> "_p1"
//   SP -> lookup in spIndex
//   Unknown -> no suffix
// ---------------------------------------------------------------------------

const cdnUrl = (idcard: IdCard, suffix: string): string =>
  `${CDN_BASE}/${idcard}${suffix}.webp`

export const resolveImageUrl = (
  card: Card,
  spIndex: SpIndex,
): Option.Option<string> =>
  pipe(
    card.image,
    Option.orElse(() =>
      pipe(
        card.imageSuffix,
        Option.map((suffix) => cdnUrl(card.idcard, suffix)),
      ),
    ),
    Option.orElse(() =>
      R.Rarity.$match({
        Standard: () => Option.some(cdnUrl(card.idcard, "")),
        Parallel: () => Option.some(cdnUrl(card.idcard, "_p1")),
        SP: () => pipe(
          Option.fromNullable(spIndex.get(card.idcard)),
          Option.map((suffix) => cdnUrl(card.idcard, suffix)),
        ),
        Promo: () => Option.some(cdnUrl(card.idcard, "")),
        Unknown: () => Option.some(cdnUrl(card.idcard, "")),
      })(card.rarity),
    ),
  )

// ---------------------------------------------------------------------------
// Variant image URL (for disambiguation picker)
// ---------------------------------------------------------------------------

export const variantImageUrl = (idcard: IdCard, suffix: string): string =>
  cdnUrl(idcard, suffix)
