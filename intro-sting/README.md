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
| appear      | bars **draw in from the top** downward (~0.10s each), big + splayed, running off both screen edges |
| zoom-center | the splayed bars **shrink + un-splay** into the compact `\I/`, screen-centred |
| push-left   | the compact `\I/` **slides left**… |
| reveal      | …while `olfGames` **slides right out from behind the bars** — masked split, tail-first (`s → es → mes → ames → Games`), **not** a typewriter |
| background  | after the wordmark assembles, an on-brand **background fades in** behind the lockup (default `#bg` gradient stand-in; swap for a generated brand **image**) |
| drop + whiten | the whole **lockup drops to ~75% height (bottom 3/4)** and its fill turns **yellow → white**, leaving the dark brand art behind it — a clean loader end-state |
| hold        | steady white lockup over the brand background — **nothing fades out** |

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

- **Background** — `#bg` radial gradient (the default spotlight/vignette) that fades in after the wordmark assembles. **To use a generated brand image:** replace the `fill="url(#bg)"` rect with an `<image href="…" x="0" y="0" width="1080" height="1920" preserveAspectRatio="xMidYMid slice" opacity="0">` and move the fade-in `<animate>` onto it. Its fade-in timing is `keyTimes="0;0.63;0.75;1"`.
- **White turn** — the lockup ends **white** (`#E9ED12 → #ffffff`). Driven by the `fill` presentation attribute on each `.bar` polygon and the `.word` text plus a per-element `<animate attributeName="fill">` (`keyTimes="0;0.78;0.92;1"`). Fills are attributes, **not** CSS, so the animation wins. Change the final value for a different end colour.
- **Drop distance** — `#lockup` `translate` `0 0 → 0 480` moves the assembled lockup from screen-centre (~50%) down to ~75%. Raise/lower `480` to taste.
- **Bar width** — the ±half-width baked into each polygon's `points` keyframes (big ~90, compact ~18). Widen/narrow both the big and compact keyframes to taste.
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

The sting is a **ContentLoader capability**, not a parallel component. The
`screen-content-loader` prefab in `@wolfgames/components` already owns the loading-phase
lifecycle (progress bar, enter/exit animations, the `exitSignal` → `onExitComplete`
handshake); the sting is a richer branded reveal that slots into that role.

```
// catalog: considered screen-content-loader (ContentLoader — the branded DOM loader;
// CHOSEN as the promotion target), interstitial, critical-flash — the sting is a
// ContentLoader capability, not new. Incubated in-game per the component rules because
// the design is still settling (brand font + the generated background image aren't final).
```

## Status: wired in (ENG-4657)

It is live in the template's loading phase:

- **Component:** `src/game/screens/components/IntroSting.tsx` — imports this SVG via
  `?raw`, converts it to play-once + `fill="freeze"`, reuses ContentLoader's exported
  `LoaderBar`, and **mirrors ContentLoader's contract** (`progress` / `exitSignal` /
  `onExitComplete`) so promotion is a fold-in, not a rewrite.
- **Mount:** `src/game/screens/LoadingScreen.tsx` renders `<IntroSting>` in place of
  `<ContentLoader>`, passing the same `progress` / `exitSignal={assetsReady}` /
  `onExitComplete={goto}`. The sting owns the two-gate exit (plays through once **AND**
  assets ready), then hands off.

This SVG stays the single source of truth while the design settles.

## Promotion target (when the design locks)

Fold into `@wolfgames/components` ContentLoader rather than shipping a standalone prefab:

1. Add a `heroContent` slot (arbitrary hero markup) and/or a `brand-sting` enter variant
   to `screen-content-loader`; move this SVG into that module as its markup.
2. Delete `IntroSting.tsx`; `LoadingScreen` goes back to `<ContentLoader>` with the sting
   variant/slot. The prop contract is already identical, so this is a swap.

Blocked on the design locking first: the **brand font** (not the Arial stand-in) and the
**generated background image** (`wolf-dev auth login` → asset-gen).
