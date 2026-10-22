# agent: the game as states and actions

An agent (a bot, a test harness, an MCP client) reads **states** and calls
**actions** with `db.services.agent.execute(action, input)`. The running game's
world has it too: `getGameWorld()` (`../world.ts`) is built from this plugin.

- `createAgentService.ts` is generic: it turns a declaration into an
  `AgenticService` (@adobe/data). Leave it as is.
- `agentPlugin.ts` is this game's declaration (`createGameAgentService`) and the
  plugin that registers it on the world. It ships with the states `role`,
  `phase`, `score`, `goal` and the actions `tap` and `start`.

When the game has a board or pieces, add a state for what a player sees and an
action for what a player can do, in `createGameAgentService`:

```ts
states: {
  // …
  pieces: { schema: piecesSchema, description: 'Every piece on the board', value: piecesObserve },
},
actions: {
  // …
  swap: {
    description: 'Swap two adjacent pieces',
    input: swapSchema,                       // `as const satisfies Schema`
    when: Observe.withMap(r.phase, (p) => p === 'playing'),
    run: (s) => db.transactions.swap(s),     // `s` is typed from swapSchema
  },
},
```

- A state's `value` is an Observe whose type matches its `schema` (it does not
  compile otherwise). Most are `db.observe.resources.<name>`; derive one with
  `Observe.withMap(...)`.
- A state that can be empty uses `Schema.Nullable(schema)`: a bare
  `nullable: true` is silently ignored.
- An action takes at most one input object. With no `input` it takes `{}`.
  `when` offers it only while true; outside that `execute` returns an
  ActionError.
- Actions call the same transactions as the player's input, so an agent plays
  by the same rules.

Rewrite `role` to say what the game is and how to win. Test new states and
actions in `tests/unit/schedule.test.ts` (`createGameAgentWorld()`).
