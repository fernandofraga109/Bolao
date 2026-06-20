import { Match, MatchStatus, Team } from "../types";
import { getKnockoutAdvancingTeamId } from "./scoring";

export type FormOutcome = "W" | "D" | "L";

export interface TeamFormEntry {
  match: Match;
  outcome: FormOutcome;
  isHome: boolean;
  opponent: Team;
  goalsFor: number;
  goalsAgainst: number;
}

/**
 * Forma recente de um time: até `limit` jogos finalizados da MESMA competição,
 * ordenados do mais recente para o mais antigo.
 *
 * Puramente em memória — opera sobre a lista de matches já hidratada/carregada,
 * sem nenhuma chamada ao banco. Indicado para uso com `useMemo` no card.
 */
export function getTeamRecentForm(
  teamId: string,
  competitionCode: string | undefined,
  allMatches: Match[],
  limit = 5,
): TeamFormEntry[] {
  if (!teamId) return [];

  return allMatches
    .filter((m) => {
      if (m.status !== MatchStatus.FINISHED || !m.result) return false;
      // Só filtra por competição quando ambos os códigos existem.
      if (competitionCode && m.competitionCode && m.competitionCode !== competitionCode) {
        return false;
      }
      return m.homeTeam?.id === teamId || m.awayTeam?.id === teamId;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .map((m) => {
      const isHome = m.homeTeam.id === teamId;
      const opponent = isHome ? m.awayTeam : m.homeTeam;
      const goalsFor = isHome ? m.result!.home : m.result!.away;
      const goalsAgainst = isHome ? m.result!.away : m.result!.home;

      let outcome: FormOutcome;
      if (goalsFor > goalsAgainst) {
        outcome = "W";
      } else if (goalsFor < goalsAgainst) {
        outcome = "L";
      } else {
        // Empate no tempo regular — pode ter sido decidido na prorrogação/pênaltis
        // (mata-mata). Usa o time que avançou para classificar como V/D.
        const advancingId = getKnockoutAdvancingTeamId(m);
        if (advancingId === teamId) {
          outcome = "W";
        } else if (advancingId) {
          outcome = "L";
        } else {
          outcome = "D";
        }
      }

      return { match: m, outcome, isHome, opponent, goalsFor, goalsAgainst };
    });
}
