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

## Constraints Importantes

- **TLA uniqueness:** `teams.code` (TLA) não é globalmente único — sempre upsert por `externalTeamId`
- **FK ordering:** `matches.competitionCode` FK é DEFERRABLE — sync upserts competition + matches no mesmo flow

## Schema Isolation

- Supabase schema configurável via `VITE_SUPABASE_SCHEMA`
- Usar `dev` para desenvolvimento para evitar tocar em dados de produção
