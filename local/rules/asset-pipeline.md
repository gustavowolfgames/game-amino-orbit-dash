---
description: Game media comes from the asset-gen MCP and ships from the CDN by default; local assets are a sanctioned fallback for rapid iteration only
alwaysApply: true
---

# Assets: asset-gen MCP + CDN by default

**Game media is never committed to the repo (CDN-first).** Art ships from the
CDN under content-hashed immutable names; the repo commits only the lockfile
(`assets/asset-manifest.cdn.json`) and its typed seed (`assets/registry.ts`). Committed `public/` exceptions: fonts, favicon,
tuning/VFX config JSON, and the boot chrome the template already ships
(existing files only, never new ones).

## Default path: generate via MCP, publish, serve from CDN

Full guide: `docs/recipes/asset-pipeline.md`.

1. **Generate** — all generation goes through the wolf-game-kit MCP
   (`mcp__wolf-game-kit__*`). Check `search_assets` first — art made for this
   game in the prod UI or an earlier session is adopted with `assets_set`, not
   regenerated. Then discover (`list_style_presets`,
   `list_process_templates`; never hardcode preset ids; pass
   `styleContext.imageRole` with any preset). Many assets = ONE
   `create_asset_gen_batch` with N `kind:"pipeline"` items, then poll
   `get_asset_gen_status {batchId, projectId}` until `isTerminal`. Transparent
   sprites ONLY via the `transparent-raster` process template, and an existing
   sheet is cut out with `sheet-cutout` — never magenta plates, never
   `chroma_key`. Audio via `generate_sfx` / `generate_music` /
   `generate_tts` + the audio-sprite process templates. VFX via `generate_vfx`.
2. **Stage** — download results into `assets/src/_staging/`, rename per
   `docs/guides/naming-convention.md`, move approved files up into
   `assets/src/`. Do NOT pre-compress: publish encodes images on the way up,
   and a file you squashed first gets squashed twice. The one time to shrink
   a file yourself is when it is over 8 MiB, since those skip the encoder.
   Packed PNG sheets go in as they are too — publish finds each one through
   its atlas JSON and encodes it lossless at full size instead of the usual
   way (`wolf-dev` 0.2.57 or later); a sheet you
   `assets set` from a local file needs `--role atlas`, since `set` never
   reads the JSON. Pixi-loaded atlas JSON goes under `assets/src/json-data/`;
   DOM atlases and audio-sprite JSON stay at the top level (`assets/README.md`
   has the rule).
3. **Publish** — `bun run assets:publish` (CLI) or the `assets_publish` MCP
   tool: encodes images to optimized delivery files, hashes everything
   in `assets/src/`, rewrites sidecar refs, uploads immutable, verifies at the
   storage origin, then writes the lockfile and regenerates
   `assets/registry.ts` — commit both. Assets land under the
   `gameSlug` from `wolf-game-kit.json`, which is the CDN namespace
   `games/<gameSlug>/` and must equal the game's Nucleo slug; if it's still
   the placeholder `mygame`, stop and set the real one first
   (`docs/factory/newgame.md`, Step 1). The `projectId` argument on the
   asset-gen tools defaults to that same slug — pass it only to reach another
   project's assets. Never build project-local
   publish scripts — the shared contract lives in `wolf-dev`.
4. **Size** — art is optimized on publish; nothing to do in the normal case.
   **Never regenerate art to recover resolution** — the `assets_pull` MCP
   tool with `original: true` (CLI `wolf-dev assets pull --original`) writes
   back each file's original where asset-gen kept one; publish keeps none, so
   keep your own copy. Line art, UI and text must ask for a lossless encode —
   `role: "ui-text"` on the asset-gen tool that makes it, or `assets_set` with
   `role: "ui-text"` (`assets set --role ui-text`) for a file from disk;
   nothing infers it. Pass `role: "ui-text"` to `assets_set` when adopting
   asset-gen line art too. The lockfile records what `assets_set` was given,
   so later publishes and `assets_optimize` keep it (`wolf-dev` 0.2.59 or
   later). `optimize: false`
   (`--no-optimize`) ships art as authored; `max` (`--max <px>`) on
   `assets_set` caps a local file to a known display size; for art asset-gen
   made, use `optimize_image` with `maxDimension` on its original instead.
   `assets_verify` with `budget: true` (`bun run assets:verify`) fails on
   anything over its role's byte budget. The numbers live only in game-sdk's
   `packages/dev/src/modules/assets/budgets.ts`; how a key's name picks its
   role is in `docs/recipes/asset-pipeline.md`.
5. **Load** — register bundles in `src/game/asset-manifest.ts` with lockfile
   keys as `src` values (paths relative to `assets/src/`). CdnManifestProvider
   resolves them at boot; never scatter `media.<env>.wolf.games` URLs through
   `src/` (`check:assets` enforces this).

Asset-gen result `cdnUrl`s are opaque provenance URLs: download from them,
never reference them at runtime. Publish preserves logical names — the
lockfile maps them to the hashed CDN filenames.

## Local fallback (sanctioned, temporary)

Use local assets only when (a) the wolf-game-kit MCP is not available in your
setup, or (b) you're iterating rapidly and a CDN round-trip would slow the
loop down:

- Files go in `public/assets/` with naming-convention names; manifest srcs
  not in the lockfile resolve against `localBase` (`/assets`) automatically.
- The 200KB size budget still applies (`check:assets`) — heavier media goes
  to `assets/src/` + `assets:publish` even during iteration.
- Before release, local media moves to `assets/src/` and the CDN. Local mode
  is an iteration convenience, not a shipping path.

## If the MCP tools are missing

**If `mcp__wolf-game-kit__*` tools are absent or the asset-gen key is unset,
generation is blocked. That is a setup problem to surface, not to code
around.**

1. Tell the user plainly what is missing and how to fix it: MCP config is
   machine-local (provisioned by the workspace setup / Nucleo Studio CLI —
   `.mcp.json` is gitignored); the key goes in that file's `env` block as
   `PROD_ASSET_GEN_API_KEY` (or `QA_ASSET_GEN_API_KEY` for QA), or as a shell
   export — see README → MCP servers. `Invalid API key` is a different
   failure: a key was sent and rejected, so it belongs to another environment
   than the one the tools call — ask the user to run `wolf-dev auth asset-gen`,
   which says which. That CLI is interactive-only; you cannot run it yourself. Do not
   tell the user to put it in `.env`; that does not reliably reach the server,
   and `.mcp.json` or the shell wins over it.
2. Then wait for them — or use the local fallback above if they prefer.
   Do NOT substitute: no procedurally generated or code-drawn art or audio
   (no Pixi `Graphics` / Canvas stand-ins, no WebAudio/oscillator SFX, no
   data-URI media), no images pulled from the web, no new "proxy" files
   (that exception covers only art the template already ships). Don't land
   code that references assets that don't exist yet.
3. Temporary placeholders are allowed only if the user explicitly approves
   after being told, and each one must be flagged for replacement. Shipped
   placeholders are a guardrail violation (`docs/standards/guardrails.md`).

Validate: `bun run check:assets` and `bun run check:manifest` (also run by
pre-commit). After a publish, `assets_verify` with `budget: true`
(`bun run assets:verify`) confirms every lockfile entry exists at the storage
origin and is within its role's byte budget.
