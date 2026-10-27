# agent: the game as states and actions

An agent (a bot, a test harness, an MCP client) reads **states** and calls
**actions** with `db.services.agent.execute(action, input)`.

- `createAgentService.ts` is generic: it turns a declaration into an
  `AgenticService` (@adobe/data). Leave it as is.
- `agentPlugin.ts` is ball sort's declaration (`createGameAgentService`) and
  the plugin that registers it on the world. It ships with the states `role`,
  `phase`, `board` (each tube bottom ball first), `heldTube`, `moves`,
  `undosLeft` and `stuck`, and the actions `tapTube` ({ tube }), `undo` and
  `start` (restart the level).

To add a state for what a player sees, or an action for what a player can do,
in `createGameAgentService`:

```ts
states: {
  // …
  cursor: { schema: { type: 'integer' }, description: 'Keyboard cursor tube, or -1', value: r.cursor },
},
actions: {
  // …
  moveCursor: {
    description: 'Move the keyboard cursor',
    input: dirSchema,                        // `as const satisfies Schema`
    when: Observe.withMap(r.phase, (p) => p === 'playing'),
    run: (d) => db.transactions.moveCursor(d), // `d` is typed from dirSchema
  },
},
```

- A state's `value` is an Observe whose type matches its `schema` (it does not
  compile otherwise). Most are `db.observe.resources.<name>`; derive one with
  `Observe.withMap(...)` (as `board` does from `history`).
- A state that can be empty uses `Schema.Nullable(schema)`: a bare
  `nullable: true` is silently ignored.
- An action takes at most one input object. With no `input` it takes `{}`.
  `when` offers it only while true; outside that `execute` returns an
  ActionError.
- Actions call the same transactions as the player's input, so an agent plays
  by the same rules.

Keep `role` saying what the game is and how to win. Test new states and
actions in `tests/unit/schedule.test.ts` (`createGameAgentWorld()`).
