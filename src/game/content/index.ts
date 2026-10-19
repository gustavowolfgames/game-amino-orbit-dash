/**
 * Content seam — which levels the game plays, from a Content Pack or the build.
 *
 *   content-pack.ts    the authored pack shape (blocks of levels) — `packs/*.json`
 *   level.ts           defaults for one level (shape: `schemas/levels`) + the bundled pack
 *   active-pack.ts     the pack in play; `levelAt(n)` is how gameplay reads a level
 *   load.ts            resolve the pack key (`?wolfPack=` > Vault `contentId` > default) and fetch
 *   assemble.ts        bundle (`blocks` + `levels`) ⇄ authored pack (also `decompose:content`)
 *   catalog.ts         the Daily Editions schedule answered to the manager's harvest (Vault only)
 *   served-mode.ts     a Vault selection → default / daily / unlocked + its packs; the edition cursor
 *   dynamic-client.ts  the one shared Dynamic Data client
 *
 * Kept apart from `../brand` (look) on purpose. See docs/recipes/game-packs.md.
 */

export {
  type ActivePack,
  getActivePack,
  isLastLevel,
  levelAt,
  onActivePackChange,
  seedActivePack,
} from './active-pack';
export { assemblePack, decomposePack, levelKey } from './assemble';
export { loadCatalog, toEditions } from './catalog';
export {
  type AssembledPack,
  type ContentPack,
  ContentPackDef,
  packLevels,
} from './content-pack';
export { dynamicClient, isPackNotFound, type KitLike } from './dynamic-client';
export {
  BUNDLED_PACK,
  DEFAULT_PACK_KEY,
  LEVEL_DEFAULTS,
  type LevelConfig,
  LevelConfigDef,
  parseLevel,
  type ResolvedLevel,
} from './level';
export { loadActivePack, resolvePackKey } from './load';
export {
  createEditionCursor,
  resolveServedMode,
  scheduleDay,
  UNLOCKED_EDITIONS_CONTENT_ID,
  unlockedPacks,
} from './served-mode';
