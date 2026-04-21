import { Either, pipe } from "effect"
import type { Card } from "../domain/Card"
import type { ShareDecodeError } from "../domain/SharedWishlist"
import { toShareable, serializeCards, deserializeCards, fromShareable } from "../domain/SharedWishlist"
import type { VariantsIndex } from "./VariantResolver"
import * as ShareCodec from "./ShareCodec"

const SHARE_PREFIX = "w="

export const generateShareFragment = (cards: ReadonlyArray<Card>): string => {
  const text = serializeCards(cards.map(toShareable))
  return `#${SHARE_PREFIX}${ShareCodec.encode(text)}`
}

export const extractSharePayload = (hash: string): string | null => {
  if (!hash.startsWith(`#${SHARE_PREFIX}`)) return null
  const payload = hash.slice(1 + SHARE_PREFIX.length)
  return payload || null
}

export const decodeShareUrl = (
  encoded: string,
  variantsIndex: VariantsIndex,
): Either.Either<ReadonlyArray<Card>, ShareDecodeError> =>
  pipe(
    ShareCodec.decode(encoded),
    Either.flatMap(deserializeCards),
    Either.map((shareables) => shareables.map((sc) => fromShareable(sc, variantsIndex))),
  )
