/**
 * Game identity constants — single source of truth for game naming.
 * When forking for a new game, update these values and all references follow.
 * CI reads GAME_SLUG from this file via grep (see .github/workflows/deploy-infra-gcs.yml),
 * so keep the `export const GAME_SLUG = "..."` line on one line.
 *
 * These must stay in sync with wolf-game-kit.json (projectId / gameSlug / gameName),
 * which the asset pipeline uses for the CDN projectId.
 */

/** Analytics event tag and GameKit project ID (snake_case, e.g. "jungle_zuma") */
export const GAME_ID = "amino_ecs_pure";

/** URL-safe slug used in CDN paths, asset names, storage keys (e.g. "junglezuma") */
export const GAME_SLUG = "aminoecspure";

/** Human-readable display name (e.g. "Jungle Zuma") */
export const GAME_NAME = "Your Game";

/** CDN path segment for this game's assets and data */
export const GAME_CDN_PATH = `games/${GAME_SLUG}/data`;

/** localStorage key prefix for analytics (survey cooldown, feature flags, etc.) */
export const GAME_STORAGE_PREFIX = `${GAME_SLUG}_`;
