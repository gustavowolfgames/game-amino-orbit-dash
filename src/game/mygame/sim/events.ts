/**
 * events — what happened this step, as data (the sim → feedback channel).
 *
 * Systems and transactions `emit(store, event)` when something worth hearing or
 * showing happens (a hit, a landing, a lap). The events sit in the `events`
 * resource, so they are deterministic, replayable and visible in the Inspector.
 * Once per rendered frame the controller calls `drainEvents(db)` and fans the
 * list out to sound, the screen-reader line, the HUD and the views
 * (`../screens/cues.ts`). Nothing outside the sim diffs counters to guess what
 * changed.
 *
 * Several fixed steps can run in one frame: their events pile up in order until
 * the next drain. The queue is bounded (`MAX_EVENTS`): past it the oldest event
 * is dropped and `eventsDropped` counts it, so a frame that never drains cannot
 * grow the world without limit.
 *
 * Generic on purpose: a game declares its own union with `EventOf` (see
 * `GameEvent` in `./plugin.ts`). No Pixi, no DOM.
 */

/** The one field every event has: its kind. */
export interface GameEventBase {
  readonly type: string;
}

/**
 * Build an event union from a map of `type → payload`:
 *
 *   type GameEvent = EventOf<{ hit: { x: number; y: number }; lap: { n: number } }>;
 *   // = { type: 'hit'; x: number; y: number } | { type: 'lap'; n: number }
 */
export type EventOf<M extends Record<string, object>> = {
  [K in keyof M & string]: Readonly<{ type: K } & M[K]>;
}[keyof M & string];

/** The member of union `E` whose `type` is `K`. */
export type EventOfType<E extends GameEventBase, K extends E['type']> = Extract<
  E,
  { type: K }
>;

/** Most events the queue holds between two drains. */
export const MAX_EVENTS = 256;

/** The shared empty list: the resource's default, and what an empty drain returns. */
export const NO_EVENTS: readonly never[] = Object.freeze([]);

/** The two resources the queue lives in (a transaction `store` has both). */
export interface EventQueueStore<E extends GameEventBase> {
  resources: {
    events: readonly E[];
    eventsDropped: number;
  };
}

/** What `drainEvents` needs from the database. */
export interface EventQueueDb<E extends GameEventBase> {
  readonly resources: { readonly events: readonly E[] };
  readonly transactions: { clearEvents: () => void };
}

/**
 * Record `event` for the next drain. Call it inside a transaction, with the
 * transaction's `store`. Past `MAX_EVENTS` the oldest event is dropped.
 */
export function emit<E extends GameEventBase>(
  store: EventQueueStore<E>,
  event: NoInfer<E>,
): void {
  const queue = store.resources.events;
  if (queue.length >= MAX_EVENTS) {
    store.resources.eventsDropped += queue.length - MAX_EVENTS + 1;
    store.resources.events = [
      ...queue.slice(queue.length - MAX_EVENTS + 1),
      event,
    ];
    return;
  }
  store.resources.events = [...queue, event];
}

/**
 * Take every event since the last drain, oldest first, and empty the queue.
 * Call once per rendered frame. Returns `NO_EVENTS` (no write, no allocation)
 * when nothing happened.
 */
export function drainEvents<E extends GameEventBase>(
  db: EventQueueDb<E>,
): readonly E[] {
  const events = db.resources.events;
  if (events.length === 0) return NO_EVENTS;
  db.transactions.clearEvents();
  return events;
}
