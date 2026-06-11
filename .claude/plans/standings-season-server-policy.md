# Plano: Política de `season` autoritativa no servidor (proxies football-data)

_Status: EM ANDAMENTO — iniciado 2026-06-11_
_Branch: `fix/season-server-policy` (a criar)_

## Problema

Após o deploy do fix de standings (PR #8), os valores corretos eram sobrescritos
por valores zerados "um tempo depois". **Causa confirmada via logs da Vercel:**
ainda chegavam requests `/api/standings?...&season=2026`.

### Root cause

O PR #8 tornou o proxy de standings **opt-in**: ele passou a *confiar* no
`season` enviado pelo cliente. Mas abas antigas (bundle stale, pré-deploy)
continuam rodando o código velho, que manda `season = getCurrentSeason() = "2026"`.
O `useBackgroundSync` roda o pipeline completo de standings para **qualquer
usuário logado** (não é admin-gated), gated só por intervalo de `lastSync`.

Cadeia do bug:
```
Aba stale → fetchExternalStandings(season="2026")
  → /api/standings?competition=WC&season=2026
  → proxy NOVO honra o season explícito ❌
  → football-data devolve snapshot zerado de 2026
  → upsert em team_standings (zeros) → Realtime → telas boas sobrescritas
```

O lock de 60s e o intervalo de `lastSync` não protegem: controlam concorrência/
frequência, não a idade do código do cliente.

### Lição de design

A política de "qual season por competição" estava no **cliente**
(`STANDINGS_SEASON_OVERRIDE` em `liveScoreService`) — justamente a parte que pode
estar desatualizada e fora do nosso controle. **A decisão tem que viver no
servidor (proxy) como fronteira de confiança.**

## Solução

Mover a política de season para o **servidor** e fazer os proxies **ignorarem o
`season` enviado pelo cliente**, decidindo exclusivamente por um mapa server-side.
Assim nenhuma aba (stale ou fresh) consegue injetar season.

### Endpoints afetados (4 football-data, padrão competition+season)

`standings`, `matches`, `scorers`, `teams`. (Os demais — `competitions`,
`live-matches`, `gemini-prediction`, etc. — não são season-scoped.)

## Fases

### Fase 1 — Módulo server-side autoritativo
- Criar `api/_lib/seasonPolicy.ts` (prefixo `_` → Vercel não trata como rota):
  - `SEASON_BY_COMPETITION = { BSA: "2026" }` (WC e demais ausentes = seedless)
  - `resolveSeason(code)` → season ou undefined

### Fase 2 — Endurecer os 4 proxies
- Cada proxy IGNORA `url.searchParams.get("season")` e usa `resolveSeason(code)`.
- Constrói URL com season só quando definida; mantém fallback 404/403 → seedless.
- `standings` mantém `cache: no-store` + `Cache-Control: no-store` (já em prod).

### Fase 3 — Limpeza do cliente (fonte única = servidor)
- `services/liveScoreService.ts`: remover `STANDINGS_SEASON_OVERRIDE` +
  `getStandingsSeason`. Os 4 fetchers param de enviar season (sempre seedless do
  ponto de vista do cliente; servidor decide). Remover blocos de fallback de season.
- `hooks/useSyncSystem.ts`: remover `const season = getCurrentSeason()` e os args
  de season das chamadas.
- `getCurrentSeason` mantido (util inofensivo; pode ser usado por testes/displays).

### Fase 4 — Testes
- Delegar ao `test-runner`: ajustar `useSyncSystem.test.ts` se as assinaturas
  mudarem; adicionar teste de `resolveSeason` (BSA→2026, WC→undefined).

## Validação
- `tsc` sem novos erros (os 5 em `DatabaseContext.tsx` são pré-existentes).
- Pós-deploy: logs da Vercel não devem mais mostrar `season=` para WC vindo de
  clientes; `team_standings` deixa de zerar.

## Risco / rollback
- Mudança concentrada nos proxies + cliente. Rollback = reverter a branch.
- Risco baixo: o servidor passa a ignorar input do cliente (mais restritivo, não
  menos). BSA continua com season 2026 garantida pelo servidor.

## Follow-up / deferido
- Sessão stale pós-deploy (caso geral, código client): banner "Nova versão
  disponível — Atualizar" via `system_config` + Realtime (NÃO auto-reload, risco
  de perder palpite em digitação). Discutido, não planejado em detalhe.
