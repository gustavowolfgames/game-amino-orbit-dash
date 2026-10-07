/**
 * The schemas a fork registers on its Game Manager release (schemas/registry.ts) and the
 * examples a content person publishes. If an example stops validating, the recipe in
 * docs/recipes/game-packs.md stops working — so every example is checked here.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { BrandDef } from '../../../schemas/brand/schema';
import { CatalogDef } from '../../../schemas/catalog/schema';
import { PackDef } from '../../../schemas/pack/schema';
import { registry } from '../../../schemas/registry';
import { parseLevel } from '~/game/content';

const SCHEMAS = path.resolve(import.meta.dirname, '../../../schemas');
const examples = (schema: string) =>
  readdirSync(path.join(SCHEMAS, schema, 'examples'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(path.join(SCHEMAS, schema, 'examples', f), 'utf8'))] as const);

describe('registry', () => {
  it('registers content, brand and schedule as separate schemas', () => {
    expect(Object.keys(registry).sort()).toEqual(['brand', 'catalog', 'level', 'pack']);
    for (const [key, entry] of Object.entries(registry)) {
      expect(entry.schema.key).toBe(key);
      expect(Number.isInteger(entry.schema.version)).toBe(true);
    }
  });
});

describe('examples', () => {
  it.each(examples('pack'))('pack %s is a pack of playable levels', (_, raw) => {
    const pack = PackDef(raw);
    expect(pack instanceof type.errors ? pack.summary : 'ok').toBe('ok');
    for (const level of (pack as { levels: unknown[] }).levels) expect(parseLevel(level)).not.toBeNull();
  });

  it.each(examples('brand'))('brand %s is a valid sheet', (_, raw) => {
    const out = BrandDef(raw);
    expect(out instanceof type.errors ? out.summary : 'ok').toBe('ok');
  });

  it.each(examples('catalog'))('catalog %s maps pack keys to dates', (_, raw) => {
    const out = CatalogDef(raw);
    expect(out instanceof type.errors ? out.summary : 'ok').toBe('ok');
  });
});
