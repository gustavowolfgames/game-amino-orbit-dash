/**
 * The schemas a fork registers on its Game Manager release (schemas/registry.ts) and the
 * examples a content person publishes. If an example stops validating, the recipe in
 * .agents/recipes/dynamic-data.md stops working — so every example is checked here.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { ContentPackDef, decomposePack } from '~/game/content';
import { BrandDef } from '../../../schemas/brand/schema';
import { registry } from '../../../schemas/registry';

const SCHEMAS = path.resolve(import.meta.dirname, '../../../schemas');
const PACKS = path.resolve(
  import.meta.dirname,
  '../../../src/game/content/packs',
);
const jsonFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) => [f, JSON.parse(readFileSync(path.join(dir, f), 'utf8'))] as const,
    );
const examples = (schema: string) =>
  jsonFiles(path.join(SCHEMAS, schema, 'examples'));

describe('registry', () => {
  it('registers content and brand as separate schemas', () => {
    expect(Object.keys(registry).sort()).toEqual(['blocks', 'brand', 'levels']);
    for (const [key, entry] of Object.entries(registry)) {
      expect(entry.schema.key).toBe(key);
      expect(Number.isInteger(entry.schema.version)).toBe(true);
    }
  });
});

describe('examples', () => {
  it.each(jsonFiles(PACKS))(
    'pack %s splits into valid blocks + levels entries',
    (_, raw) => {
      const pack = ContentPackDef(raw);
      expect(pack instanceof type.errors ? pack.summary : 'ok').toBe('ok');
      const bundle = decomposePack(pack as typeof ContentPackDef.infer);
      for (const schema of ['blocks', 'levels'] as const) {
        for (const data of Object.values(
          bundle.schemas[schema]?.entries ?? {},
        )) {
          const out = registry[schema].schema.schema(data);
          expect(out instanceof type.errors ? out.summary : 'ok').toBe('ok');
        }
      }
    },
  );

  it.each(examples('brand'))('brand %s is a valid sheet', (_, raw) => {
    const out = BrandDef(raw);
    expect(out instanceof type.errors ? out.summary : 'ok').toBe('ok');
  });
});
