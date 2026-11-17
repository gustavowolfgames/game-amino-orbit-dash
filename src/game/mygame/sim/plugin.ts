/** Orbit Dash's deterministic ECS world. Moving actors and gates are entities. */
import { Database, F32, I32, Observe } from '~/core/systems/ecs';
import { type EventOf, emit, NO_EVENTS } from './events';
import { nextRng, rngFloat } from './rng';
import {
  BASE_SPEED,
  GATE_COUNT,
  orbitPoint,
  RUN_MS,
  SPEED_PER_LEVEL,
  START_SHIELDS,
  TAU,
} from './rules/orbit';

export type GamePhase = 'idle' | 'playing' | 'won' | 'lost';
export type GameEvent = EventOf<{
  switched: { x: number; y: number; lane: number };
  scored: { x: number; y: number; score: number };
  hit: { x: number; y: number; shields: number };
  phase: { phase: GamePhase };
}>;

export const gamePlugin = Database.Plugin.create({
  components: {
    spriteKey: { type: 'string', default: '' } as const,
    runner: { type: 'boolean', default: false } as const,
    gate: { type: 'boolean', default: false } as const,
    angle: F32.schema,
    lane: I32.schema,
    nextPass: I32.schema,
  },
  resources: {
    level: { default: 0 as number },
    packId: { default: '' as string },
    goal: { default: 0 as number },
    score: { default: 0 as number },
    phase: { default: 'idle' as GamePhase },
    shields: { default: START_SHIELDS as number },
    remainingMs: { default: RUN_MS as number },
    runId: { default: 0 as number },
    elapsedMs: { default: 0 as number },
    frameDeltaMs: { default: 0 as number },
    rng: { default: 0 as number },
    events: { default: NO_EVENTS as readonly GameEvent[] },
    eventsDropped: { default: 0 as number },
  },
  archetypes: {
    Runner: ['runner', 'angle', 'lane', 'spriteKey'],
    Gate: ['gate', 'angle', 'lane', 'nextPass', 'spriteKey'],
  },
  computed: {
    finished: (db) =>
      Observe.withMap(
        db.observe.resources.phase,
        (p) => p === 'won' || p === 'lost',
      ),
  },
  transactions: {
    startRun(
      store,
      {
        seed,
        goal = 8,
        level = 0,
        packId = '',
      }: {
        seed: number;
        goal?: number;
        level?: number;
        packId?: string;
      },
    ) {
      for (const e of [...store.select(['runner'])]) store.delete(e);
      for (const e of [...store.select(['gate'])]) store.delete(e);
      store.resources.level = level;
      store.resources.packId = packId;
      store.resources.goal = goal;
      store.resources.score = 0;
      store.resources.phase = 'playing';
      store.resources.shields = START_SHIELDS;
      store.resources.remainingMs = RUN_MS;
      store.resources.runId += 1;
      store.resources.elapsedMs = 0;
      store.resources.frameDeltaMs = 0;
      store.resources.rng = seed >>> 0;
      store.resources.events = NO_EVENTS;
      store.resources.eventsDropped = 0;
      store.archetypes.Runner.insert({
        runner: true,
        angle: 0,
        lane: 0,
        spriteKey: 'pulse',
      });
      for (let i = 0; i < GATE_COUNT; i++) {
        store.resources.rng = nextRng(store.resources.rng);
        const lane = i === 0 ? 0 : rngFloat(store.resources.rng) < 0.5 ? 0 : 1;
        store.archetypes.Gate.insert({
          gate: true,
          angle: ((i + 1) * TAU) / (GATE_COUNT + 1),
          lane,
          nextPass: 0,
          spriteKey: `gate-${i}`,
        });
      }
    },
    /** A pointer-down or keyboard action changes the runner's lane immediately. */
    tap(store, _point: { x: number; y: number }) {
      if (store.resources.phase !== 'playing') return;
      for (const e of store.select(['runner'])) {
        const player = store.read(e, ['angle', 'lane']);
        if (
          typeof player?.angle !== 'number' ||
          typeof player.lane !== 'number'
        )
          return;
        const lane = 1 - player.lane;
        store.update(e, { lane });
        emit(store, {
          type: 'switched',
          ...orbitPoint(player.angle, lane),
          lane,
        });
        return;
      }
    },
    /** One fixed step: move, resolve gates, then end on goal, shields or clock. */
    advanceOrbit(store) {
      if (store.resources.phase !== 'playing') return;
      const dt = store.resources.frameDeltaMs;
      if (dt <= 0) return;
      store.resources.remainingMs = Math.max(
        0,
        store.resources.remainingMs - dt,
      );
      for (const runner of store.select(['runner'])) {
        const player = store.read(runner, ['angle', 'lane']);
        if (
          typeof player?.angle !== 'number' ||
          typeof player.lane !== 'number'
        )
          return;
        const nextAngle =
          player.angle +
          ((BASE_SPEED + store.resources.level * SPEED_PER_LEVEL) * dt) / 1000;
        store.update(runner, { angle: nextAngle });
        for (const gate of store.select(['gate'])) {
          const item = store.read(gate, ['angle', 'lane', 'nextPass']);
          if (
            typeof item?.angle !== 'number' ||
            typeof item.lane !== 'number' ||
            typeof item.nextPass !== 'number'
          )
            continue;
          const crossing = item.angle + item.nextPass * TAU;
          if (player.angle >= crossing || nextAngle < crossing) continue;
          const point = orbitPoint(item.angle, player.lane);
          if (player.lane === item.lane) {
            store.resources.score += 1;
            emit(store, {
              type: 'scored',
              ...point,
              score: store.resources.score,
            });
          } else {
            store.resources.shields -= 1;
            emit(store, {
              type: 'hit',
              ...point,
              shields: store.resources.shields,
            });
          }
          store.resources.rng = nextRng(store.resources.rng);
          store.update(gate, {
            nextPass: item.nextPass + 1,
            lane: rngFloat(store.resources.rng) < 0.5 ? 0 : 1,
          });
          if (
            store.resources.score >= store.resources.goal ||
            store.resources.shields <= 0
          )
            break;
        }
        break;
      }
      if (store.resources.score >= store.resources.goal) {
        store.resources.phase = 'won';
        emit(store, { type: 'phase', phase: 'won' });
      } else if (
        store.resources.shields <= 0 ||
        store.resources.remainingMs <= 0
      ) {
        store.resources.phase = 'lost';
        emit(store, { type: 'phase', phase: 'lost' });
      }
    },
    setPhase(store, phase: GamePhase) {
      if (store.resources.phase === phase) return;
      store.resources.phase = phase;
      emit(store, { type: 'phase', phase });
    },
    advanceTime(store, { dt }: { dt: number }) {
      store.resources.frameDeltaMs = dt;
      store.resources.elapsedMs += dt;
    },
    clearEvents(store) {
      store.resources.events = NO_EVENTS;
    },
  },
});

export type GamePlugin = typeof gamePlugin;
export type GameDatabase = Database.Plugin.ToDatabase<GamePlugin>;
export type GameStore = Database.Plugin.ToStore<GamePlugin>;
export function createGameWorld(): GameDatabase {
  return Database.create(gamePlugin) as GameDatabase;
}
