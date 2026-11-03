# Game Design — Your Game

> Source of truth for the game's design. Agents read this before building, and
> update it in the same change when the game changes.
>
> **No game is designed yet.** The template ships a skeleton (`src/game/mygame/`):
> the ECS world, the fixed-step loop, input as intent, the agent surface, the
> screens, and a level flow over the active Content Pack. Fill in the sections
> below for the game you build on it. If this doc and the code disagree, the code
> wins for exact numbers and this doc wins for the loop and intent.

## The Game in One Sentence

## Core Loop

## Win and Lose

A level has a `goal` (from its Content Pack entry). Say what it counts and what
ends a run.

## Cadence

Turn-based (resolve a turn on input, no frame loop) or real-time (per-frame
systems on the fixed step).

## Entities

The archetypes in the ECS world (`src/game/mygame/sim/plugin.ts`), one line each.

## Input

What a tap (or swipe, or key) does.

## Levels and Tuning

What a level holds (`schemas/levels/schema.ts`), the bundled levels
(`src/game/content/packs/default.json`), and the constants that never change per
level (`src/game/mygame/sim/rules/`).

## Screens and Feel

Start, game, results; the HUD; the effects that make a hit or a clear feel good.

## Assets

The art, audio and VFX the game needs (published through the wolf-game-kit MCP).
Browsers stay silent until the player's first tap, so the loading screen and the
title have no music or sound. The game loads its art first and its audio last, in
the background: the game opens without waiting for the music, which starts once
its file has arrived (a few seconds late on a slow phone).
