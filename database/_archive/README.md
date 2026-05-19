# _archive — Histórico de Migrações

> **NÃO execute nenhum arquivo desta pasta.** Eles estão aqui apenas para rastreabilidade histórica.
> O schema ativo está em `database/migrations/` e as políticas em `database/rls/`.

---

## O que aconteceu (25 de Abril de 2026)

Todo o histórico de caos foi comprimido num único dia de desenvolvimento intenso:

### Fase 1 — Schema inicial
1. `supabase_final.sql` — Schema base com RLS permissivo
2. `supabase_alter_tables_uuid.sql` — Conversão de IDs para UUID
3. `supabase_add_competition_code.sql` — Coluna `competitionCode` em groups/matches/teams
4. `supabase_add_team_standings_columns.sql` — 15 colunas de standings cacheadas em `teams` *(depois removidas)*
5. `supabase_backfill_competition_codes.sql` — Backfill de `competitionCode = 'WC'`
6. `supabase_add_match_grouping_columns.sql` — Colunas `stage` e `matchday` em matches

### Fase 2 — Crise de RLS (tudo no mesmo dia)
7. `supabase_rls_hardening_phase1.sql` — Restringiu writes → causou 403s ❌
8. `supabase_fix_team_ranking_update.sql` — Hotfix de permissão de UPDATE
9. `supabase_rls_hotfix_403.sql` — Restaurou SELECT policies que faltavam
10. `supabase_predictions_group_scope.sql` — Adicionou `groupId` em predictions (text, PK surrogate)
11. `supabase_rls_phase2_group_scoped_reads.sql` — Leituras group-scoped
12. `supabase_rls_phase3_identity_hardening.sql` — Endureceu user_roles → bug uuid/text ❌
13. `supabase_rls_phase3_identity_hotfix_uuid_text.sql` — Tentativa de fix com casting ::text
14. `supabase_rls_recovery_group_predictions_scoped.sql` — Mais uma tentativa de recovery ❌
15. `supabase_rls_phase3_rollback_emergency.sql` — **ROLLBACK DE EMERGÊNCIA** — restaurou políticas permissivas ⚠️
16. `supabase_rls_balanced_lockdown.sql` — Nova tentativa de equilíbrio
17. `supabase_rls_balanced_rollback.sql` — Rollback do balanced lockdown

### Fase 3 — Sync fixes
18. `supabase_rls_sync_teams_matches_authenticated.sql` — Abriu writes para authenticated
19. `supabase_rls_teams_standings_update_only.sql` — Restringiu UPDATE de standings

### Fase 4 — Refatoração de schema (Maio)
20. `02_fix_standings_pk_multigroup.sql` — Criou `team_standings` normalizada, migrou dados, PK composta
21. `01_migration_teams_predictions.sql` — `predictions.groupId` virou UUID NOT NULL, PK mudou para `(userId, matchId, groupId)`

### Fase 5 — RLS moderno
22. `rls_background_sync.sql` — RLS limpo com split admin/usuário → **foi a base para `rls/current.sql`**

### Fase 6 — Reset de dados
23. `supabase_truncate_sync_zero.sql` — Truncou predictions/matches/teams para re-sync do zero

---

## Por que esses arquivos não devem ser re-executados

- Muitos fazem operações que já foram desfeitas por rollbacks posteriores
- A sequência conflita: políticas se cancelam mutuamente
- O schema evoluiu; alguns ALTER TABLE já foram aplicados
- O arquivo `database/migrations/0001_create_tables.sql` representa o estado final correto

---

## Colunas descobertas apenas via DB real (ausentes nos SQL históricos)

| Tabela | Coluna | Tipo | Nota |
|--------|--------|------|------|
| `user_roles` | `activeGroupId` | uuid | FK para groups — adicionada em algum momento sem script |
| `user_roles` | `totalPoints` | integer | Pontuação total do usuário |
| `predictions` | `points` | integer | Pontos ganhos pela predição |

Essas colunas estão incluídas no `migrations/0001_create_tables.sql`.
