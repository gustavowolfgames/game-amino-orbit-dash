// Shaped like the file `wolf-dev schema create` generates, so the CLI can take it over.
// `nucleo game deploy <slug> --release-name <release>` registers every schema listed here
// (`wolf-game-kit.json` → `schemasDir`). See .agents/recipes/dynamic-data.md.
import type { DynamicDataRegistryEntry } from '@wolfgames/shared';
import { blocksSchema } from './blocks';
import { brandSchema } from './brand';
import { catalogSchema } from './catalog';
import { levelsSchema } from './levels';

/**
 * Two concerns, kept apart so one build serves many partner looks and many dated editions:
 *
 *   content — `blocks` (a run of levels: its play order and level keys) + `levels` (one level each)
 *   brand   — `brand` (a partner sheet: colours, type, link), layered over the build's own
 *   schedule — `catalog` (pack key → `YYYY-MM-DD`), read by the manager's Daily Editions harvest
 *
 * Every schema is `bundleSyncEnabled: false`: the server keeps one file per entry and never a
 * file of every entry. The game reads its content out of a Content Pack (`getPack`), which
 * carries its own bundle whatever this flag says, and the one entry read outside a pack
 * (`brand/theme`) is a single `getEntry`.
 */
export const registry = {
  blocks: {
    schema: blocksSchema,
    bundleSyncEnabled: false as const,
  },
  levels: {
    schema: levelsSchema,
    bundleSyncEnabled: false as const,
  },
  brand: {
    schema: brandSchema,
    bundleSyncEnabled: false as const,
  },
  catalog: {
    schema: catalogSchema,
    bundleSyncEnabled: false as const,
  },
} satisfies Record<string, DynamicDataRegistryEntry>;
