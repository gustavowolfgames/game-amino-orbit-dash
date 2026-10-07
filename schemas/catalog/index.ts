import type { DynamicDataSchema } from '@wolfgames/shared';
import { defaultData, CatalogDef } from './schema';

/**
 * `version` is a literal (never `Date.now()`) so the module stays deterministic. A deploy
 * only registers a (key, version) pair it has not seen: bump it, and redeploy, whenever the
 * shape changes — an entry change needs neither.
 */
export const catalogSchema = {
  key: 'catalog',
  schema: CatalogDef,
  version: 1,
  defaultData,
  migrations: {},
} satisfies DynamicDataSchema<typeof CatalogDef>;
