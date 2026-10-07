# Game Packs & Dynamic Data — content and brand without a redeploy

Every game forked from this template ships already shaped for **Game Packs**: its levels and its
look are data the Game Manager publishes, not code. One build serves the default game, dated
daily editions, and any number of partner reskins.

```
build (ships with)                         Game Manager (publish, no redeploy)
──────────────────                         ────────────────────────────────────
schemas/pack/examples/default.json   ◀──── pack + level entries  → Content Pack "<key>"
src/game/brand/defaults.ts (Wolf)    ◀──── brand entry "theme"  (or one inside a Content Pack)
                                     ◀──── catalog/<slug>        (pack key → YYYY-MM-DD, dailies)
```

**Boot:** the loading screen fetches the Content Pack (`?wolfPack=<key>`, else the Vault's
`contentId`, else `default`) and the brand sheet in parallel with the asset bundles. Anything
missing, failing, or malformed falls back to what the build ships, and the game still plays.
Capped at 4 s (`CONTENT_BUDGET_MS`); a late arrival still applies.

## The four schemas (`schemas/`)

| Schema | Holds | Read by the game as |
|--------|-------|---------------------|
| `pack` | `{ id, game, levels: ["<level key>", …] }` — one edition, levels in play order | `getPack(<key>)` → `src/game/content/load.ts` |
| `level` | `{ "level": <your level> }` — opaque here; the game parses it | `src/game/content/level.ts` (`LevelConfigDef`) |
| `brand` | A partner sheet: grounds, accents, roles, fonts, link | `src/game/brand/load.ts` → theme (CSS vars + Pixi) |
| `catalog` | `{ "<pack key>": "YYYY-MM-DD" }` — the Daily Editions schedule | answered to the manager's harvest (Vault only) |

Content and brand are separate on purpose: any edition can wear any partner's look.
**Changing a schema needs a new `version` + a redeploy; changing an entry needs neither.**

## What a fork changes

- **Its level shape:** edit `LevelConfigDef` in `src/game/content/level.ts` and the bundled pack
  `schemas/pack/examples/default.json`. The gameplay reads `levelAt(n)` (`src/game/content`).
- **Its default look:** edit `BUILD_SHEET` in `src/game/brand/defaults.ts`. Draw with
  `getTheme()` (Pixi) or the `--brand-*` / `--font-*` CSS variables (DOM).
- **Its identity:** `gameSlug` in `wolf-game-kit.json`, `GAME_SLUG` in `src/game/config/identity.ts`
  and `VITE_GAME_KIT_PROJECT_ID` in `.env` must all be the game's Nucleo slug — Dynamic Data paths
  are keyed by it.

Nothing else: the loader, fallback, Vault wiring and completion reporting are template code.

## Publishing (content person)

Needs the `wolf-dev` CLI ≥ `0.2.61` (`pack …` commands) or the wolf-game-kit MCP tools of the
same names (`schema_data_batch-create`, `pack_create`, `pack_assign`, `pack_entries_set`).

### 0. Register the schemas — once per shape change

```bash
nucleo game deploy <slug> --release-name main --source <branch>
```

`wolf-game-kit.json` → `schemasDir` makes the deploy register every schema in
`schemas/registry.ts` on that release. (`wolf-dev schema register` is deprecated: on QA it
reported success and registered nothing.) Daily Editions need the release named **`main`**.

### 1. Create entries

Author a pack (start from `schemas/pack/examples/`), then split it into entries:

```bash
bun run decompose:content schemas/pack/examples/edition-2026-10-08.json local/content-packs/edition-2026-10-08
wolf-dev schema data batch-create --schema-key pack  --release-name main --batch local/content-packs/edition-2026-10-08/pack.batch.json --yes
wolf-dev schema data batch-create --schema-key level --release-name main --batch local/content-packs/edition-2026-10-08/level.batch.json --yes
```

The script refuses a level the game cannot play and proves the round trip first. Entry keys are
shared by every pack on a release — give each edition a fresh `id`.

For a partner look, create a `brand` entry from a sheet (`schemas/brand/examples/us-weekly.json`,
`law-and-crime.json`) — under the key **`theme`** to reskin the whole deployment, or any other key
to ship it with one pack (step 2).

### 2. Bind a Game Pack

```bash
wolf-dev pack create --key edition-2026-10-08 --name "Edition 2026-10-08"   # note <packUid>
wolf-dev pack assign --pack <packUid> --release-name main                   # note <gamePackUid>
wolf-dev pack entries set <gamePackUid> --entries "$(cat local/content-packs/edition-2026-10-08/pack-entries.json)" --yes
```

To ship a palette with the pack, add `"brand": ["<brand key>"]` to the entries JSON. A pack
keyed `default` replaces the bundled levels for every plain launch.

### 3. Verify the CDN bundle

```bash
curl -g -s "https://nucleo.media.qa.wolf.games/dynamic-data/<slug>/packs/edition-2026-10-08[@main].json" | head -c 300
```

It should list `pack` and `level` (and `brand`, if bound). **If it 404s after `entries set`,**
`schema data update` any entry it points at with unchanged data — the bundle is only rebuilt on
an entry change (known Manager quirk, QA 2026-09-29). Then open the QA build with
`?wolfPack=edition-2026-10-08`: the HUD shows its level count; the console stays silent on
success and names the reason on a fallback.

### 4. Daily Editions (optional)

1. Date the packs in the `catalog/<slug>` entry: `{ "edition-2026-10-08": "2026-10-08" }`
   (`schemas/catalog/examples/aminoecspure.json`).
2. Enable Daily Editions for the game on the client, run the manager **Harvest**, and Apply. The
   harvest boots the game hidden; the game answers its catalog as `content_catalog`.
3. The Vault sends the chosen edition as `contentId` = the pack key; the game loads that pack
   (and its brand), plays it from level 1, and reports `reportContentCompleted(contentId)` when its
   last level is won. A Vault "default" drops the edition and its brand.

Known hazard: an active Vault experiment whose PostHog flag does not exist freezes every context
(QA 2026-09-30) — disable the experiment until the flag exists.

## Trying it locally

- `bun run dev` plays the bundled pack in the Wolf brand — nothing to publish.
- To read published data from a dev server, set `VITE_GAME_KIT_PROJECT_ID=<slug>` and
  `VITE_RELEASE_NAME=main` in `.env` (a deployed build reads its release from `_release.json`),
  then open `?wolfPack=<key>`.
- A frozen build (`bun run build:frozen`) never touches Dynamic Data.

## Pack model, mapped

The Game Pack docs (Notion, Pack types) describe four pack types. This template implements the
live shape the Manager serves today:

| Notion pack type | Here |
|------------------|------|
| Content | `pack` + `level` entries, bound as a Content Pack |
| Theme / Brand | `brand` entry (`theme` for the deployment, or bound into a Content Pack) |
| Config | not yet — mechanics constants stay in `src/game/mygame/demo/config.ts` |
| Schedule (not a pack) | `catalog` entry, harvested by the manager |
