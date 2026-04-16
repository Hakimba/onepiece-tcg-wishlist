import { Effect, Context, Layer, Data } from "effect"
import type { SpIndex } from "./ImageResolver"
import type { VariantsIndex } from "./VariantResolver"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class FetchError extends Data.TaggedError("FetchError")<{
  readonly url: string
  readonly cause: unknown
}> {}

// ---------------------------------------------------------------------------
// SpIndex Service
// ---------------------------------------------------------------------------

export class SpIndexService extends Context.Tag("SpIndexService")<
  SpIndexService,
  {
    readonly load: Effect.Effect<SpIndex, FetchError>
  }
>() {}

export const SpIndexServiceLive = Layer.succeed(
  SpIndexService,
  SpIndexService.of({
    load: Effect.tryPromise({
      try: async () => {
        const baseUrl = typeof import.meta !== "undefined" ? import.meta.env.BASE_URL : "/"
        const res = await fetch(`${baseUrl}sp-index.json`)
        const data: Record<string, string> = await res.json()
        return new Map(Object.entries(data)) as SpIndex
      },
      catch: (cause) => new FetchError({ url: "sp-index.json", cause }),
    }),
  }),
)

// ---------------------------------------------------------------------------
// VariantsIndex Service
// ---------------------------------------------------------------------------

export class VariantsIndexService extends Context.Tag("VariantsIndexService")<
  VariantsIndexService,
  {
    readonly load: Effect.Effect<VariantsIndex, FetchError>
  }
>() {}

export const VariantsIndexServiceLive = Layer.succeed(
  VariantsIndexService,
  VariantsIndexService.of({
    load: Effect.tryPromise({
      try: async () => {
        const baseUrl = typeof import.meta !== "undefined" ? import.meta.env.BASE_URL : "/"
        const res = await fetch(`${baseUrl}variants-index.json`)
        return (await res.json()) as VariantsIndex
      },
      catch: (cause) => new FetchError({ url: "variants-index.json", cause }),
    }),
  }),
)
