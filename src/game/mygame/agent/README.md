# agent: the game as states and actions

`agentPlugin.ts` exposes the game to an agent (a bot, a test harness, an MCP
client): **states** it can read and **actions** it can call with
`db.services.agent.execute(action, input)`. It ships with `phase`, `score`,
`goal`, `tap` and `start`.

When the game has a board or pieces, add a state for what a player sees and an
action for what a player can do. Both go in `createGameAgentService`:

```ts
// in agentPlugin.ts: interface
pieces: { type: 'state', schema: piecesSchema, description: 'Every piece on the board' },
swap: { type: 'action', description: 'Swap two adjacent pieces', parameters: [swapParamSchema] },

// implementation
pieces: Observe.withMap(db.observe.resources.score, () => readPieces(db)),
swap: async (input: { a: number; b: number }) => db.transactions.submitSwap(input),
```

Rewrite `roleText` to say what the game is and how to win. Actions queue
intents like the player's input does, so an agent plays by the same rules.
Offer an action only when it is legal (`conditional`), and use
`Schema.Nullable(schema)` for a state that can be empty: a bare
`nullable: true` is silently ignored.
