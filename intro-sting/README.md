# Wolf Games intro sting — SVG spike

A renderer-agnostic reproduction of the Wolf Games brand sting (`WG_FINAL_glow.mp4`)
as an **animated SVG** — pure SVG + SMIL animation + a light SVG glow filter, **no JS
and no game renderer**. It can play during the pre-renderer DOM loading phase, before
Pixi (or Phaser / Three.js) has initialized, which is why it is SVG and not a Pixi scene.

The mark's motion is **transferred from the source**: the three bars are filled
**parallelograms** (`<polygon>`, *not* stroked lines — in the source each bar's top and
bottom is a **horizontal** cut, so a slanted bar has horizontal caps and slanted sides).
Each bar's 4 points were measured frame-by-frame (connected-component analysis of the
bright core, 30fps, viewBox 1080×1920) and keyed directly onto `points` via SMIL
`<animate>`. Both the endpoints **and the width** are measured: the bars are **~90px
wide while splayed and shrink to ~14px** in the compact mark. The draw-on, shrink, and
un-splay all fall out of interpolating between the real measured keyframes rather than
being hand-eased.

> Status: **spike / testing.** Not wired into the boot flow. This folder is a scratch
> harness for evaluating the look. Once approved it becomes a reusable component
> (see "Promotion" below).

## Files

| File | What |
|------|------|
| `wolf-sting.svg` | The animation. Self-contained; usable as inline SVG or `<img src>`. |
| `preview.html`   | Local harness — black 9:16 frame, Replay, and a side-by-side toggle against the source mp4. |

## Preview

```bash
open intro-sting/preview.html          # macOS
# or serve the folder and open http://localhost:xxxx/intro-sting/preview.html
```

The source mp4 is referenced by absolute path (`~/Downloads/WG_FINAL_glow (1).mp4`);
edit the `<video src>` in `preview.html` if you move it.

## Motion (reverse-engineered frame-by-frame, 4s loop)

| phase | beat |
|---|------|
| appear      | strokes **draw in from the top** downward (stroke-dashoffset), big + splayed |
| zoom-center | the splayed strokes **shrink + un-splay** into the compact `\I/`, screen-centred |
| push-left   | the compact `\I/` **slides left**… |
| reveal      | …while `olfGames` **slides right out from behind the strokes** — masked split, tail-first (`s → es → mes → ames → Games`), **not** a typewriter |
| hold        | steady glowing lockup |
| fade        | to black |

Geometry is in **true video coordinates** (viewBox 1080×1920). Measured centre-line + width:

| | left `\` | mid `I` | right `/` |
|---|---|---|---|
| **measured core** top→bot | (87,345)→(423,1572) | (540,348)→(537,1575) | (993,348)→(668,1569) |
| **big splayed** (off-screen) top→bot | (−18,−40)→(529,1960) | (541,−40)→(536,1960) | (1096,−40)→(564,1960) |
| **big width** | ~96 | ~90 | ~93 |
| **compact** (centred) top→bot | (472,900)→(501,1017) | (538,900)→(538,1017) | (603,900)→(574,1017) |
| **compact width** | ~18 | ~18 | ~18 (bumped ~4px above measured for a touch more weight) |

Each line **draws in ~0.10s** (measured, crisp + uniform): left f12–15 (0.40–0.50s),
right f18–21 (0.60–0.70s), mid f23–26 (0.77–0.87s).

While splayed the bars **run off the top and bottom edges** (the viewport clips them) —
the measured core is y345…1575 but the visible stroke+glow reaches ~y66 top / ~y1848
bottom, essentially edge-to-edge, so the geometry is extrapolated along each bar's own
slope to y −40 / 1960. They then shrink into the compact band y900…1017. Draw order is
left → right → mid, each top→down (the bottom edge descends from the top). The compact mark is centred at
x≈538, then the whole group is pushed left by **translateX −310** while `olfGames` slides
right from behind it (masked reveal). Each bar's `points` are `topLeft topRight bottomRight
bottomLeft` — horizontal caps, slanted sides.

The SVG **loops** for review. The production component should play **once** (swap each
`repeatCount="indefinite"` to `1` and add `fill="freeze"` so it holds the final frame).

## Tuning knobs

- **Bar width** — the ±half-width baked into each polygon's `points` keyframes (big ~90, compact ~14). Widen/narrow both the big and compact keyframes to taste.
- **Brand yellow** — `.bar` / `.word` `fill` (currently `#E9ED12`; peak bloom in the video is ~`#FCFC00`, which the glow approximates).
- **Split distance** — the `mark` / `textSlide` `translateX` values (`-310` / `-360→0`).
- **Duration** — the `dur` attribute (currently `3.8s`) on every `<animate>`/`<animateTransform>`; keep them equal so the timeline stays in sync. `keyTimes` are fractions of it.
- **Glow strength** — `#glow` is **animated**: strong during the draw/splay, settling lighter on the hold (measured: halo ~1.5× the core while splayed, then drops). The two `<animate>`s drive `feGaussianBlur stdDeviation` (`14→7`) and `feFuncA slope` (`0.95→0.5`). Raise the first value in each for a hotter start, the last for a brighter settle.

## Known gaps (spike, not final)

- **Font** — uses `Arial/Helvetica` as a stand-in. The real lockup needs the brand
  typeface; swap the `font-family` (or convert the wordmark to outlined `<path>` so it
  renders identically without a web-font dependency).
- **Centering** is approximate (hand-placed, not measured against the glyph metrics).
- `prefers-reduced-motion` shows the final frame with no motion.

## Catalog decision

```
// catalog: considered interstitial (surface:dom, full-screen video/image interlude),
// screen-content-loader (branded DOM loader), critical-flash (pixi light-line title reveal)
// — none fit: this is a pre-renderer, hand-authored neon wordmark reveal that must run
// before any game renderer and with real glow (filter), which the DOM candidates don't do
// and the Pixi candidate can't (it needs Pixi up). Build new as an SVG spike; promote once approved.
```

## Promotion (after approval)

Incubate as a game-agnostic DOM module, then promote to `@wolfgames/components`:

1. `src/game/<game>/modules/prefabs/intro-sting/` with the standard shape
   (`index.ts`, `defaults.ts`, `tuning.ts`, a DOM renderer, `README.md`) — the SVG
   becomes the renderer's markup; `defaults.ts` exposes color / duration / play-once.
2. Mount it on the loading screen (`src/game/screens/LoadingScreen.tsx`) ahead of
   `loadBoot()` / `loadTheme()`, or gate the first `goto('start')` behind its completion.
3. Promote to `@wolfgames/components/modules/prefabs/intro-sting` once it has held shape.
