import type { AnalyticsService } from '@wolfgames/client';

/**
 * Structural stand-in for an ArkType validator (`{ infer } & callable`). The
 * real `ArkTypeValidator` type is internal to `@wolfgames/client` and not
 * exported, so we describe the minimal shape `AnalyticsService`'s param
 * repository constrains to.
 */
type AnyValidator = { infer: unknown } & ((data: unknown) => unknown);

/**
 * The analytics service as the app actually configures it.
 *
 * `AnalyticsProvider` builds the service with
 * `.addParamsSet({ base }).addParamsDefault({ base: ... })`, so every event
 * automatically merges the `base` param set (game_name, game_slug,
 * game_environment, session_elapsed) and no `base` value is required at the
 * call site.
 *
 * `AnalyticsService` uses a "continuous extension" pattern where that
 * registration widens the instance's generics — but the bare `AnalyticsService`
 * type (which `useAnalyticsService()` and unannotated params resolve to) erases
 * it, leaving `Def` empty. That makes `createTracker(name, schema, ['base'], {})`
 * wrongly demand a `base` value. Annotating the service with `base` present in
 * both the param repository (`T`) and the defaults map (`Def`) restores the real
 * shape: `base` becomes an *optional* override, so `{}` is valid.
 */
export type GameAnalyticsService = AnalyticsService<
  { base: AnyValidator },
  { base: unknown }
>;
