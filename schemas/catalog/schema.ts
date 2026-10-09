import { type } from 'arktype';

/**
 * A game's Daily Editions schedule: Content Pack key → the calendar day it opens (`YYYY-MM-DD`,
 * UTC). One entry per game, keyed by the game slug, read only when the manager harvests
 * (`content_catalog`) — never on a player launch.
 *
 * A flat map, on purpose: object keys cannot repeat, so one pack cannot be scheduled twice; the
 * date is a string, so no `Date` parsing anywhere and the backend's numeric coercion never sees
 * it; and `YYYY-MM-DD` sorts as text. The Vault owns selection and pacing — this is metadata.
 */
export const CatalogDef = type({
  '[string]': /^\d{4}-\d{2}-\d{2}$/,
});

export type CatalogData = typeof CatalogDef.infer;

/** Nothing scheduled: the Vault shows the game with no editions. */
export const defaultData: CatalogData = {};
