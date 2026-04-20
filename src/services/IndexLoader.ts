import { Effect, Context, Layer, Data } from "effect"
import type { SpIndex } from "./ImageResolver"
import type { VariantsIndex } from "./VariantResolver"
import type { SetLists } from "../domain/SetIndex"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class FetchError extends Data.TaggedError("FetchError")<{
  readonly url: string
  readonly cause: unknown
}> {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseUrl = typeof import.meta !== "undefined" ? import.meta.env.BASE_URL : "/"

const fetchJson = <A>(file: string): Effect.Effect<A, FetchError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${baseUrl}${file}`)
      return (await res.json()) as A
    },
    catch: (cause) => new FetchError({ url: file, cause }),
  })

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
    load: Effect.map(
      fetchJson<Record<string, string>>("sp-index.json"),
      (data) => new Map(Object.entries(data)) as SpIndex,
    ),
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
    load: fetchJson<VariantsIndex>("variants-index.json"),
  }),
)

// ---------------------------------------------------------------------------
// SetLists Service
// ---------------------------------------------------------------------------

export class SetListsService extends Context.Tag("SetListsService")<
  SetListsService,
  {
    readonly load: Effect.Effect<SetLists, FetchError>
  }
>() {}

export const SetListsServiceLive = Layer.succeed(
  SetListsService,
  SetListsService.of({
    load: Effect.catchAll(
      fetchJson<SetLists>("set-lists.json"),
      () => Effect.succeed({} as SetLists),
    ),
  }),
)
