#!/usr/bin/env bun
/**
 * Split an authored pack into the entries a publish creates.
 *
 *   bun run decompose:content <pack.json> <out-dir>
 *   bun run decompose:content schemas/pack/examples/edition-2026-10-08.json local/content-packs/edition-2026-10-08
 *
 * Reads an authored pack (`{ id, game, levels }`), checks every level is playable by this game,
 * proves it joins back into the same pack, and writes what the publish commands take:
 * `pack.batch.json` and `level.batch.json` for `schema data batch-create`, and
 * `pack-entries.json` for `pack entries set`. The publish itself is the recipe's step list
 * (docs/recipes/game-packs.md) — the CLI needs a terminal, so nothing here runs it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { type } from 'arktype';
import { PackDef } from '../schemas/pack/schema';
import { assemblePack, decomposePack } from '../src/game/content/assemble';
import { parseLevel } from '../src/game/content/level';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [packArg, outArg] = process.argv.slice(2);
if (!packArg || !outArg) fail('usage: bun run decompose:content <pack.json> <out-dir>');

const raw: unknown = JSON.parse(readFileSync(resolve(packArg), 'utf8'));
const pack = PackDef(raw);
if (pack instanceof type.errors) fail(`${packArg} is not a pack: ${pack.summary}`);
if (pack.levels.length === 0) fail(`${packArg} has no levels`);
const unplayable = pack.levels.flatMap((l, i) => (parseLevel(l) ? [] : [i + 1]));
if (unplayable.length > 0) fail(`${packArg}: level(s) ${unplayable.join(', ')} fail src/game/content/level.ts`);

const bundle = decomposePack(pack);
const back = assemblePack(bundle, pack.game);
if (!isDeepStrictEqual(back, pack)) fail(`round trip failed: ${typeof back === 'string' ? back : 'levels differ'}`);

const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });
const batch = (schema: string) =>
  Object.entries(bundle.schemas[schema]?.entries ?? {}).map(([key, data]) => ({ key, data }));
const pointers = {
  pack: batch('pack').map((e) => e.key),
  level: batch('level').map((e) => e.key),
};
for (const schema of ['pack', 'level']) {
  writeFileSync(join(outDir, `${schema}.batch.json`), `${JSON.stringify(batch(schema), null, 2)}\n`);
}
writeFileSync(join(outDir, 'pack-entries.json'), `${JSON.stringify(pointers, null, 2)}\n`);

console.log(`ok: pack=${pack.id} levels=${pointers.level.length} round-trip=match`);
console.log(`wrote ${outArg}/{pack,level}.batch.json + pack-entries.json

Publish (release name: the deployed one, usually "main"):

  wolf-dev schema data batch-create --schema-key pack  --release-name <release> --batch ${outArg}/pack.batch.json --yes
  wolf-dev schema data batch-create --schema-key level --release-name <release> --batch ${outArg}/level.batch.json --yes
  wolf-dev pack create --key ${pack.id} --name "${pack.id}"          # note <packUid>; skip if it exists
  wolf-dev pack assign --pack <packUid> --release-name <release>     # note <gamePackUid>
  wolf-dev pack entries set <gamePackUid> --entries "$(cat ${outArg}/pack-entries.json)" --yes
      # to ship a palette with this pack, add "brand": ["<brand entry key>"] to pack-entries.json

Then open the QA build with ?wolfPack=${pack.id}.`);
