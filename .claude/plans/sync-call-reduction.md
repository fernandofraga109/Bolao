# Plano: Redução de Chamadas Externas no Sync (cadências desacopladas + gate por estado)

**Status:** PLANEJADO — Aguardando aprovação do usuário
**Branch sugerida:** `perf/sync-call-reduction`
**Spec de referência:** `docs/architecture/external-api-calls.md` (§9 — Análise de melhoria)

---

## Problema

`syncMatchesAndStandings` (`hooks/useSyncSystem.ts`) dispara **4 chamadas externas
em bloco** (`teams`, `matches`, `standings`, `scorers`) a **cada** execução do
background sync, gateado **apenas por tempo** (`sync_interval_ms`, default 5 min).

Consequências:
- Em dias **sem jogo**, os 4 endpoints retornam dados **idênticos** ao último sync —
  desperdício de cota da Football-Data (plano free, rate-limit por minuto).
- `teams` é o payload mais pesado (WC ≈ 1248 jogadores) e a composição dos elencos
  é praticamente **estática** durante o torneio.
- `scorers` só muda quando há **gol**; `standings` só muda quando um jogo **termina**.
- Risco recorrente de `429` (tratado como `RATE_LIMIT_<segundos>` em
  `fetchExternalMatches`), agravado por múltiplos clientes (mitigado pelo lock,
  mas o lock não reduz o número de chamadas por janela vencida).

> **Não** é o mesmo que `edge-functions-migration.md`. Aquele move o sync para o
> servidor (24/7). Este reduz o **custo por execução** e pode ser feito **antes**,
> no client, sem infra nova. As duas iniciativas são compatíveis: se a migração
> para Edge Function acontecer depois, a lógica de cadência aqui desenhada deve ser
> portada para o servidor.

---

## Objetivo / Resultado esperado

| Cenário | Hoje (chamadas/janela) | Meta |
|---|---|---|
| Dia **sem jogo** | 4 | **0–1** |
| Dia **com jogo** (sem live no momento) | 4 | **1–2** |
| Jogo **ao vivo** | 5 | **2–3** |

Sem regressão funcional: placares, ranking, classificação, artilharia e prêmios
continuam corretos. Apenas a **frequência** de busca de dados de baixa
volatilidade diminui.

---

## Princípio: separar chamadas por volatilidade

| Endpoint | Volatilidade | Cadência proposta |
|---|---|---|
| `/api/matches` | Alta (core) | A cada `sync_interval_ms` (inalterado) |
| `/api/live-matches` | Alta (condicional) | Só com jogo `IN_PLAY/PAUSED` (inalterado) |
| `/api/scorers` | Média | Só após janela com jogo `IN_PLAY/FINISHED`, ou cadência lenta (`scorers_interval_ms`) |
| `/api/standings` | Média | Cadência lenta (`standings_interval_ms`) ou pós-jogo |
| `/api/teams` | Baixa (quase estática) | **Fora** do loop recorrente — só bootstrap + botão "Sync Players" |

---

## Fases de Implementação

### Fase 1 — Tirar `/api/teams` do sync recorrente (maior ganho, menor risco)

- `syncMatchesAndStandings` deixa de chamar `fetchCompetitionTeams` na Fase 1.
- A criação de times passa a depender só dos times referenciados em
  `matches`/`standings` (a Fase 2 já faz isso: cria "TBD"/novos a partir desses
  payloads — ver loop `allReferencedExternalTeams`).
- `teams` (elencos completos → `players`) continua disponível via:
  - **Bootstrap** de competição (primeira criação de grupo);
  - Botão **"Sync Players"** no Admin (`usePlayerSync.syncSquads`).
- **Risco:** se um time novo aparecer só no `teams` e não em `matches`/`standings`,
  ele não é criado no sync recorrente. Para Copa isso não ocorre (todos os times
  jogam). Mitigação: bootstrap + botão manual cobrem o caso de outras competições.

### Fase 2 — Gate de estado para `scorers` e `standings`

- Reordenar internamente: buscar `matches` **primeiro**; a partir dele decidir.
- Calcular flags da janela atual:
  - `hasLiveOrRecentlyFinished` = existe jogo `IN_PLAY/PAUSED`, **ou** algum jogo
    passou a `FINISHED` neste diff.
- Regras:
  - `scorers`: buscar só se `hasLiveOrRecentlyFinished` **ou** se passou
    `scorers_interval_ms` desde o último fetch de scorers.
  - `standings`: idem com `standings_interval_ms`.
- Quando pulado, manter os dados já persistidos (não sobrescrever com vazio).
- **Atenção:** hoje os 4 fetches são `Promise.all` paralelos. Esta fase quebra o
  paralelismo (matches antes, resto condicional). Avaliar manter `matches` +
  (`scorers`/`standings` se aplicável) num `Promise.all` para não perder latência.

### Fase 3 — Config de cadência (admin)

- Adicionar a `system_config` (ou `competitions`): `scorers_interval_ms`,
  `standings_interval_ms`, `teams_sync_mode` (`bootstrap-only` | `manual`).
- Persistir o "último fetch" por endpoint (ex.: `competitions.scorers_last_sync`,
  `standings_last_sync`) — migration nova.
- Defaults conservadores (ex.: scorers 15 min, standings 15 min) para que, mesmo
  sem dia de jogo, os dados não fiquem mais de X minutos defasados.

### Fase 4 — Telemetria leve (validação)

- Log estruturado por sync: quais endpoints foram chamados e por quê (motivo do
  gate). Permite medir a redução real em produção sem instrumentação pesada.

---

## Estratégia de Validação

1. **Local (mock):** simular janelas sem jogo / com jogo ao vivo / pós-jogo e
   asserir a contagem de fetches por cenário.
2. **Funcional:** após um jogo terminar, confirmar que `scorers`/`standings` são
   atualizados na janela seguinte (não ficam presos).
3. **Bootstrap:** criar grupo de competição nova → elencos populam (`teams` ainda
   roda no bootstrap).
4. **Contadores:** comparar nº de chamadas/dia antes vs depois via telemetria.
5. **Testes:** delegar ao `test-runner` os casos de gate (SYNC-03 já existe como
   `it.todo` para `live-matches`; acrescentar gate de `scorers`/`standings`/`teams`).

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Time novo só aparece em `teams` | Médio | Copa: não ocorre. Botão "Sync Players" + bootstrap cobrem outras competições. |
| Artilharia/standings "presos" se o gate falhar | Médio | Cadência lenta de fallback (`*_interval_ms`) garante atualização periódica mesmo sem jogo. |
| Quebra do `Promise.all` aumenta latência | Baixo | Manter os endpoints decididos num único `Promise.all`. |
| Derivar `standings` localmente (tentação) | Alto | **Não** reimplementar desempate FIFA. Preferir cadência lenta a recomputar. |
| Regressão de prêmios (campeão, recordes de gols) | Baixo | Esses derivam de `matches` (Fase 2/2.5), não de `teams` — não afetados pela Fase 1. |

---

## Deferred / Follow-up

- [ ] Portar a lógica de cadência para a Edge Function quando `edge-functions-migration.md` avançar.
- [ ] Circuit-breaker / backoff exponencial no `fetchExternalMatches` (compartilhado com o outro plano).
- [ ] Painel admin mostrando "última atualização" por endpoint (matches/scorers/standings/teams).

---

## Checklist de Conclusão

- [ ] Fase 1: `teams` removido do sync recorrente; bootstrap + botão manual validados
- [ ] Fase 2: gate de `scorers`/`standings` por estado + fallback de cadência
- [ ] Fase 3: config de intervalos + colunas `*_last_sync` (migration)
- [ ] Fase 4: telemetria de motivos de gate
- [ ] Testes de gate (via `test-runner`) verdes
- [ ] `docs/architecture/external-api-calls.md` §9 atualizado para refletir o novo estado
- [ ] Usuário confirma funcionamento (placares/ranking/artilharia OK, contagem de chamadas menor)
