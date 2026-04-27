-- Reset completo para ressicronizar do zero (dados operacionais)
-- Mantém usuários, grupos, estádios e configurações.

BEGIN;

TRUNCATE TABLE public.predictions, public.matches, public.tournament_predictions, public.teams RESTART IDENTITY;

-- Limpa referência de última sincronização para forçar percepção de estado "nunca sincronizado"
UPDATE public.competitions
SET last_sync = NULL;

COMMIT;

-- tournament_predictions já está incluída no TRUNCATE acima por conta da FK com teams.
