# Assets on the CDN

## When

Open this recipe when you need an image, a spritesheet, music, a sound effect, or VFX.

## Do

Use the wolf-game-kit MCP. If its tools are missing, stop and say which one. Do not draw stand-in art with Pixi Graphics, do not synthesize audio, and do not download stand-ins.

### Find or make

Call `search_assets` first. It lists art made for this game anywhere, including the asset-gen UI and earlier sessions. Adopt a match with `assets_set`, passing `name` as the lockfile key, `source` as its `cdnUrl`, and `asset-id` as its id. Game code references the lockfile key, never a raw `cdnUrl`.

Generate only when nothing fits. Call `list_style_presets` and `list_process_templates` in this environment. Do not hardcode preset ids. A style preset needs `styleContext.imageRole`. Game-facing pictures use `generate_styled_image`. Many assets go in one `create_asset_gen_batch`. Transparent sprites use the `transparent-raster` template. Cut an existing sheet with `sheet-cutout`. Do not use magenta plates or `chroma_key`. Effects use `generate_vfx`. Pass `name` on every call so the file lands in the right budget role.

Line art, UI, and text need `role: "ui-text"` on the tool that makes them. That encode is lossless. Nothing infers it from the picture. Pass `role: "ui-text"` to `assets_set` too when you adopt existing line art. The lockfile records the role, so later publishes and `assets_optimize` keep it lossless.

### Stage and publish

Stage files in `assets/src/`, which is gitignored. Rename them to `docs/reference/asset-naming.md`. Do not compress them first. Publish encodes images on the way up, so a file you squashed first gets squashed twice. Very large files skip the encoder, so shrink those yourself. The size limit is in `docs/reference/asset-pipeline.md`.

Packed PNG sheets go in as they are. Publish finds each sheet through its atlas JSON and keeps it lossless at full size. A sheet you add with `assets_set` from a local file needs `role: "atlas"`, because `assets_set` does not read the JSON. Atlas JSON that Pixi loads goes under `assets/src/json-data/`. DOM atlases and audio-sprite JSON stay at the top level.

Publish with `assets_publish`. `bun run assets:publish` does the same from a terminal. The `wolf-dev` CLI behind the `assets:*` scripts refuses to run without an interactive terminal, so agents use the MCP tools. It writes `assets/asset-manifest.cdn.json` and `assets/registry.ts`. Commit both. Do not commit the media. Publish keeps no originals, so keep your own copy of anything you made.

Assets land under `gameSlug` in `wolf-game-kit.json`. It must equal the Nucleo slug. If it still says `mygame`, stop and set the real slug. The `projectId` argument on asset-gen tools defaults to that slug. Pass it only to reach another project's assets.

Freeze the draft with `assets_release` before a build that players will run.

### Load

Register bundles in `src/game/asset-manifest.ts`, with lockfile keys as the `src` values. The CDN manifest provider resolves them at boot. Never put a `media.<env>.wolf.games` URL in `src/`. `check:assets` fails on one.

Do not land code that references an asset that does not exist yet. A placeholder needs the user's approval, and each one is flagged for replacement.

### Size

Do not regenerate art to get resolution back. `assets_pull` with `original: true` writes the bytes each delivery file came from, where asset-gen kept them. `optimize: false` ships art exactly as authored. `max` on `assets_set` caps a local file's long edge. For asset-gen art, call `optimize_image` with `maxDimension` on its original, then set the result. `assets_optimize` with `dry-run: true` shows what a sweep of older art would save.

### Setup failures

The MCP config is machine-local. `.mcp.json` is gitignored. The key goes in that file's `env` block, or a shell export, as `PROD_ASSET_GEN_API_KEY` or `QA_ASSET_GEN_API_KEY`. Do not tell the user to put it in `.env`. That file does not reliably reach the server.

`Invalid API key` means the key belongs to a different environment than the one the tools call. Ask the user to run `wolf-dev auth asset-gen`, which prints where calls land. You cannot run it yourself.

A CLI flag that returns `unknown option` means `wolf-dev` is too old. `docs/reference/asset-pipeline.md` names the minimum version for each flag. The user updates with `bun install -g @wolfgames/dev@latest`.

The only committed files under `public/assets/` are the ones this template already has, plus fonts, the favicon, and VFX config JSON. Do not add new art there.

Wire music and effects to the settings menu volume and mute. The menu comes from the components recipe.

## Verify

Run `bun run check:assets` and `bun run check:manifest`. After a publish, call `assets_verify` with `budget: true`. From a terminal, `bun run assets:verify` does the same. It fails on a missing file or one over its role's byte budget.

`git status` shows the lockfile and `assets/registry.ts` when you published. It does not show new png, webp, mp3, or wav files.

## Example

The publish and verify scripts are `assets:publish` and `assets:verify` in `package.json`. Naming checks live in `scripts/check-asset-naming.ts`. Budget roles by key name are in `docs/reference/asset-pipeline.md`.
