# Orbit Dash

Um jogo hipercasual de um toque feito com **Pixi 8**, **SolidJS**, **@adobe/data ECS** e os módulos **@wolfgames/components** do template Amino.

## Como jogar

A nave gira automaticamente em duas pistas. Toque na tela ou pressione **Espaço/Enter** para trocar de pista. Colete os núcleos dourados, evite os obstáculos magenta e alcance a meta antes de perder os três escudos ou acabar o tempo.

São três níveis, com metas de 8, 12 e 16 núcleos. O jogo usa uma semente por nível para repetir as mesmas sequências durante testes e reinícios.

## Desenvolvimento

```bash
cp .env.example .env
bun install
bun run dev
```

Abra `?screen=game` para ir direto ao jogo. Adicione `&carina=0` para comparar o mesmo loop sem os efeitos de Carina.

Checks: `bun run typecheck`, `bun run test:run`, `bun run test:e2e`, `bun run build:frozen`. O script `check:agent` inclui uma verificação de nomes de assets que falha no Windows também no template original por tratar barras invertidas como parte do nome.

## Estrutura

- `src/game/mygame/sim/`: regras e entidades ECS, com passo fixo e RNG determinístico.
- `src/game/mygame/render/`: órbita geométrica, tela inicial e feedback visual dos módulos Wolf.
- `src/game/mygame/screens/`: integração fina entre Pixi, conteúdo, áudio e resultados.
- `docs/GAME-DESIGN.md`: loop, tuning, fontes e pendências.

O jogo foi inicializado a partir de `wolfgames/template-amino` no commit `69eac025c4fcb37a21f362d450583400fa1cec96`. O timing de feedback usa padrões do [Carina](https://github.com/wolfgames/carina), com referências junto aos hooks.

Esta versão publica o **código fonte**. Um release jogável na plataforma Wolf depende de registrar e publicar os assets com o MCP wolf-game-kit e executar o fluxo de deploy do Nucleo.
