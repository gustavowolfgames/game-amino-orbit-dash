/**
 * Content seam — which levels the game plays, from a Content Pack or the build.
 *
 *   level.ts           what one level is for this game (the fork-owned parser) + the bundled pack
 *   active-pack.ts     the pack in play; `levelAt(n)` is how gameplay reads a level
 *   load.ts            resolve the pack key (`?wolfPack=` > Vault `contentId` > default) and fetch
 *   assemble.ts        bundle ⇄ authored pack (also used by `bun run decompose:content`)
 *   catalog.ts         the Daily Editions schedule answered to the manager's harvest (Vault only)
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
export { assemblePack, decomposePack, levelKey, packIsForGame } from './assemble';
export { loadCatalog, toEditions } from './catalog';
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
