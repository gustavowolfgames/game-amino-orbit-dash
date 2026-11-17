# Orbit Dash screens and feedback

`gameController.ts` connects the fixed-step ECS world to Pixi. It projects the runner, gates, score, shields, and timer each frame, then drains simulation events through `feedback.ts`. The simulation pauses during settings, the pause menu, and the result card.

`startView.tsx` builds geometric title textures and passes them to Wolf's `DynamicBackground`, `SpriteLogoTitle`, and `SpriteButton` modules. The title and play screen share the template's navigation and accessibility surfaces.

`feedback.ts` maps `switched`, `scored`, `hit`, and `phase` events to the local pop/clear sound effects, screen reader announcements, and Carina-inspired Pixi effects. `gameAudio.ts` and `cues.ts` are reusable helpers. The game has no music channel until a track is published for its own slug.

Gameplay rules belong in `../sim/`, visual geometry in `../render/`, and feel tuning in `../../tuning/`. Keep this controller as integration code.
