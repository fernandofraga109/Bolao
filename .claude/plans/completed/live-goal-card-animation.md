# Plano — Animação ao vivo de Gol / Cartão (modal efêmero)

_Status_: DONE — 2026-06-20

## Context

O app já recebe o minuto-a-minuto da api-sports em `match.liveDetails.events`
(`LiveMatchEvent[]`), atualizado em tempo real (canal realtime em
`DatabaseContext.tsx`). Queremos que, **com o app aberto**, quando chegar um novo
evento:
- **Gol** → mostrar a animação `TriondaGoalAnimation` (v1)
- **Cartão amarelo** → `CardAnimation variant="yellow"`
- **Cartão vermelho** → `CardAnimation variant="red"`

Num **modal que aparece e some sozinho** (~3s). Regra-chave acordada com o
usuário: **nada de retroativo** — só dispara para eventos que chegam **durante a
sessão**. Ao abrir o app no meio de um jogo, os eventos já existentes viram
"baseline" (não disparam); senão apareceria uma enxurrada de animações toda vez.

A v2 (estufar a rede) foi descartada — CSS não chega no fotorrealismo dos frames.
Usaremos só v1 (gol) + cartões, que já estão prontos e aprovados.

## Abordagem

Hook que observa `matches`, detecta eventos **novos** (pós-baseline) e enfileira
animações; um overlay no `App` renderiza a animação atual e some sozinho.

### Novos arquivos

**`utils/liveEvents.ts`** — helpers puros (reuso da lógica que hoje está privada
em `LiveMatchTimeline.tsx`):
- `liveEventKey(ev)` → string estável: `` `${ev.elapsed}|${ev.extra??0}|${ev.type}|${ev.detail}|${ev.player??''}|${ev.teamApiId??''}` ``
- `classifyLiveEvent(ev)` → `"goal" | "yellow" | "red" | null`
  - gol: `ev.type === "Goal" && ev.detail !== "Missed Penalty"`
  - amarelo: `ev.type === "Card" && detail.includes("Yellow")` **e não** "Second Yellow"
  - vermelho: `ev.type === "Card" && (detail.includes("Red") || detail.includes("Second Yellow"))`
  - resto (subst, Var, etc.) → `null`

**`hooks/useLiveEventAnnouncer.ts`** — `useLiveEventAnnouncer(matches: Match[])`:
- `seenRef = useRef<Map<matchId, Set<eventKey>>>()` + `baselinedRef = useRef<Set<matchId>>()`.
- `useEffect([matches])`: para cada match com `liveDetails?.events`:
  - se o match **não** está baselined → registra todos os keys no Set e marca baselined; **não dispara** (anti-retroativo).
  - senão → para cada key ausente do Set: se `classifyLiveEvent(ev)` ≠ null → `enqueue({ kind, match, ev })`; adiciona o key.
- Estado: `current` (animação em exibição) + fila. Ao montar `current`, agenda `setTimeout` (~3s gol / ~2.6s cartão) para limpar e puxar o próximo da fila.
- Retorna `{ current, dismiss, trigger }`, onde `trigger(kind, mockMatch?)` enfileira manualmente (para teste).
- Considera só `match.status === LIVE` ao baseline/disparo (evita disparo tardio em jogo encerrado).

**`components/animation/LiveEventOverlay.tsx`** — `<LiveEventOverlay matches={matches} />`:
- Usa o hook. Renderiza, quando há `current`, um modal centrado (`fixed inset-0 z-[60]`, backdrop leve `bg-black/40`, `animate-fadeIn`) com a animação correspondente (`TriondaGoalAnimation` ou `CardAnimation`), responsiva (`max-w-[640px] w-full`).
- Legenda opcional embaixo quando há evento real: jogador + minuto (`ev.player`, `formatEventMinute`) e nome do time.
- Fade-out antes de desmontar (estado `leaving`).
- Some sozinho via o timeout do hook; sem botão de fechar (efêmero) — clicar no backdrop também dispensa.

### Modificação

**`App.tsx`** — montar `<LiveEventOverlay matches={matches} />` no fim do return
(junto dos outros modais, ~linha 760+). `matches` já está em escopo (hidratado,
com `liveDetails`).

### Reuso
- `TriondaGoalAnimation` (`components/animation/TriondaGoalAnimation.tsx`), `CardAnimation` (idem).
- Lógica de classificação espelha `isGoal`/`isCard`/`cardColor` de `components/LiveMatchTimeline.tsx` (será centralizada em `utils/liveEvents.ts`; opcionalmente a timeline passa a importar de lá depois).
- Realtime que alimenta `matches`: canal em `DatabaseContext.tsx` (já existente).

## Como testar (sem esperar lance real)

Gatilho manual **só em dev** (`import.meta.env.DEV`), embutido no `LiveEventOverlay`:
1. **Botões flutuantes** (canto inferior, `z-[70]`, visíveis só em dev): "⚽ Gol",
   "🟨 Amarelo", "🟥 Vermelho" → chamam `trigger(kind)` e exibem a animação pelo
   caminho real (mesmo overlay/fila do evento de verdade).
2. **Console:** `window.__previewLiveEvent('goal'|'yellow'|'red')` (registrado em dev).

Assim dá pra ver o modal aparecer e sumir exatamente como em produção, sem
depender de um gol acontecer. As rotas de preview `/animation*` continuam para
tunar o visual das animações isoladamente.

## Verificação
1. `npm run dev` → logar no app (aba Jogos).
2. Clicar nos botões dev (Gol/Amarelo/Vermelho) → modal aparece centralizado,
   roda a animação e some sozinho (~3s); disparar os 3 em sequência testa a fila.
3. `window.__previewLiveEvent('goal')` no console → mesmo efeito.
4. Anti-retroativo: confirmar que, ao carregar com jogo ao vivo que já tem
   gols/cartões, **nada** dispara no load (baseline).
5. `tsc --noEmit` limpo nos arquivos novos; build ok.
6. Pós-aprovação: `test-runner` cobrindo `classifyLiveEvent`/`liveEventKey`;
   `changelog-updater` para bump de versão.

## Riscos / Notas
- **VAR:** um gol anulado pelo VAR ainda dispararia a animação do gol (chega como
  `type:"Goal"` antes do `Var`). Aceitável v1; dá pra refinar depois (atrasar X s
  e checar cancelamento).
- **Dedup/realtime:** o Set de keys por match absorve reemissões do realtime e
  re-sync sem disparar duplicado.
- **Gol contra / pênalti:** contam como gol (animação dispara) — desejável.
- **Multi-jogos simultâneos:** a fila serializa as animações (uma por vez).
- Mudança aditiva no frontend; não toca pontuação nem sync.
