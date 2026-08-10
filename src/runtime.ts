import { Layer, ManagedRuntime } from "effect"
import { CardRepositoryLive } from "./services/CardRepository"
import {
  SpIndexServiceLive,
  VariantsIndexServiceLive,
  SetListsServiceLive,
  SetNamesServiceLive,
} from "./services/IndexLoader"

// ---------------------------------------------------------------------------
// App Layer — composes all service implementations
// ---------------------------------------------------------------------------

export const AppLayer = Layer.mergeAll(
  CardRepositoryLive,
  SpIndexServiceLive,
  VariantsIndexServiceLive,
  SetListsServiceLive,
  SetNamesServiceLive,
)

// ---------------------------------------------------------------------------
// Managed Runtime — created once, provided via React Context
// ---------------------------------------------------------------------------

export const AppRuntime = ManagedRuntime.make(AppLayer)

export type AppRuntime = typeof AppRuntime
