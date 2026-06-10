# Schema do Banco de Dados

## Tabelas Principais

- **teams** - Informações das seleções/equipes
- **team_standings** - Classificações por competição
- **stadiums** - Estádios e localizações
- **profiles** - Perfis de usuários
- **user_roles** - Roles de usuários (ADMIN/USER)
- **groups** - Grupos de apostadores
- **user_groups** - Relação usuário-grupo
- **matches** - Partidas e resultados
- **predictions** - Palpites de partidas
- **tournament_predictions** - Palpites de torneio (campeão, artilheiro, etc.)
- **extra_phase_predictions** - Palpites extras por fase (Regulamento 2)

## Colunas de Placar em `v2_matches`

| Coluna | Tipo | Descrição |
|---|---|---|
| `resultHome` / `resultAway` | integer | Placar final (tempo normal + prorrogação se houver). Fonte primária para R2. |
| `regularHome` / `regularAway` | integer | Placar apenas no tempo regular (90 min). Fonte primária para R1 em mata-mata. |
| `extraTimeHome` / `extraTimeAway` | integer | Gols marcados **somente** na prorrogação (não cumulativo). `NULL` se o jogo não foi à prorrogação. |
| `penaltiesHome` / `penaltiesAway` | integer | Placar na disputa de pênaltis. `NULL` se não houve pênaltis. |
| `score` | jsonb | Payload completo da API (audit trail). **Não ler diretamente na lógica da app** — usar os campos planos acima. |

### Inferência de duração / vencedor (sem coluna extra)

```
penaltiesHome != null               → PENALTY_SHOOTOUT
extraTimeHome != null, pens == null → EXTRA_TIME
ambos null                          → REGULAR

Vencedor nos pênaltis: penaltiesHome > penaltiesAway → HOME_TEAM
```

## Constraints Importantes

- **TLA uniqueness:** `teams.code` (TLA) não é globalmente único — sempre upsert por `externalTeamId`
- **FK ordering:** `matches.competitionCode` FK é DEFERRABLE — sync upserts competition + matches no mesmo flow

## Schema Isolation

- Supabase schema configurável via `VITE_SUPABASE_SCHEMA`
- Usar `dev` para desenvolvimento para evitar tocar em dados de produção
