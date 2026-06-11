/**
 * POLÍTICA DE SEASON — SERVER-SIDE (AUTORITATIVA)
 * ----------------------------------------------
 * Arquivo prefixado com `_` → a Vercel NÃO o trata como rota/função; é só um
 * módulo compartilhado pelos proxies de `api/`.
 *
 * Os proxies football-data (standings, matches, scorers, teams) usam EXCLUSIVAMENTE
 * este mapa e IGNORAM o `season` enviado pelo cliente. Esta é uma fronteira de
 * confiança: abas antigas (bundle stale) não conseguem injetar uma season e
 * envenenar os dados (ex.: WC `?season=2026` devolve um snapshot zerado).
 *
 * Ausência no mapa = seedless → a football-data.org devolve a temporada CORRENTE,
 * que é o que queremos para um torneio ao vivo. Pinne uma season apenas quando a
 * API exigir (ex.: ligas) ou para uma edição histórica específica.
 */
const SEASON_BY_COMPETITION: Record<string, string> = {
  BSA: "2026", // Brasileirão Série A: a API exige season fixa para standings/matches
};

/** Resolve a season server-side de uma competição. `undefined` = seedless. */
export const resolveSeason = (competitionCode?: string): string | undefined =>
  SEASON_BY_COMPETITION[(competitionCode || "WC").toUpperCase()];
