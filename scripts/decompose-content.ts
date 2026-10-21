#!/usr/bin/env bun
/**
 * Split an authored pack into the entries a publish creates.
 *
 *   bun run decompose:content <pack.json> <out-dir>
 *   bun run decompose:content src/game/content/packs/edition-2026-10-08.json local/content-packs/edition-2026-10-08
 *
 * Reads an authored pack (`{ id, blocks: [{ id, name, levels }] }`), checks every entry against
 * its schema, proves it joins back into the same pack, and writes what the publish commands take:
 * `blocks.batch.json` and `levels.batch.json` for `schema data batch-create`, and
 * `pack-entries.json` for `pack entries set`. The publish itself is the recipe's step list
 * (.agents/recipes/dynamic-data.md) — the CLI needs a terminal, so nothing here runs it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { type } from 'arktype';
import { registry } from '../schemas/registry';
import { assemblePack, decomposePack } from '../src/game/content/assemble';
import { ContentPackDef } from '../src/game/content/content-pack';

const SCHEMA_KEYS = ['blocks', 'levels'] as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [packArg, outArg] = process.argv.slice(2);
if (!packArg || !outArg)
  fail('usage: bun run decompose:content <pack.json> <out-dir>');

const raw: unknown = JSON.parse(readFileSync(resolve(packArg), 'utf8'));
const pack = ContentPackDef(raw);
if (pack instanceof type.errors)
  fail(`${packArg} is not a pack: ${pack.summary}`);
if (
  pack.blocks.length === 0 ||
  pack.blocks.some((b) => b.levels.length === 0)
) {
  fail(
    `${packArg} needs at least one block, and every block at least one level`,
  );
}

const bundle = decomposePack(pack);
for (const schema of SCHEMA_KEYS) {
  for (const [key, data] of Object.entries(
    bundle.schemas[schema]?.entries ?? {},
  )) {
    const out = registry[schema].schema.schema(data);
    if (out instanceof type.errors)
      fail(`${schema}/${key} fails its schema: ${out.summary}`);
  }
}

const back = assemblePack(bundle);
if (!isDeepStrictEqual(back, pack))
  fail(
    `round trip failed: ${typeof back === 'string' ? back : 'pack differs'}`,
  );

const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });
const batch = (schema: string) =>
  Object.entries(bundle.schemas[schema]?.entries ?? {}).map(([key, data]) => ({
    key,
    data,
  }));
const pointers = Object.fromEntries(
  SCHEMA_KEYS.map((s) => [s, batch(s).map((e) => e.key)]),
);
for (const schema of SCHEMA_KEYS) {
  writeFileSync(
    join(outDir, `${schema}.batch.json`),
    `${JSON.stringify(batch(schema), null, 2)}\n`,
  );
}
writeFileSync(
  join(outDir, 'pack-entries.json'),
  `${JSON.stringify(pointers, null, 2)}\n`,
);

const counts = SCHEMA_KEYS.map((s) => `${s}=${pointers[s].length}`).join(' ');
console.log(`ok: pack=${pack.id} ${counts} round-trip=match`);
console.log(`wrote ${outArg}/{${SCHEMA_KEYS.join(',')}}.batch.json + pack-entries.json

Publish (release name: the deployed one, usually "main"):

  wolf-dev schema data batch-create --schema-key blocks --release-name <release> --batch ${outArg}/blocks.batch.json --yes
  wolf-dev schema data batch-create --schema-key levels --release-name <release> --batch ${outArg}/levels.batch.json --yes
  wolf-dev pack create --key ${pack.id} --name "${pack.id}"          # note <packUid>; skip if it exists
  wolf-dev pack assign --pack <packUid> --release-name <release>     # note <gamePackUid>
  wolf-dev pack entries set <gamePackUid> --entries "$(cat ${outArg}/pack-entries.json)" --yes
      # to ship a palette with this pack, add "brand": ["<brand entry key>"] to pack-entries.json

Then open the QA build with ?wolfPack=${pack.id}.`);
