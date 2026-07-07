import { TournamentPredictions, MatchStatus } from '../types';

export const POINTS_EXACT = 10;
export const POINTS_GOAL_DIFF = 7;
export const POINTS_OUTCOME = 5;
export const POINTS_WRONG = 0;
export const POINTS_CLASSIFIES_BONUS = 3;

const UNDERDOG_BONUS_FACTOR = 0.03;
const MAX_UNDERDOG_BONUS = 5;
const FALLBACK_MIN_RANK_DIFF = 0;

export const POINTS_TOP_SCORER_NAME = 100;
export const POINTS_TOP_SCORER_GOALS = 100;
export const POINTS_CHAMPION = 100;
export const POINTS_BEST_PLAYER = 100;
export const POINTS_BEST_GOALKEEPER = 100;

export type MatchPhase = 'groups' | 'ko' | 'third_place' | 'final';

/**
 * Maps a match stage and group to the corresponding tournament phase.
 */
export const getMatchPhase = (stage?: string, group?: string): MatchPhase => {
  const s = (stage || '').toUpperCase();
  const g = (group || '').toUpperCase();

  if (
    s.includes('FINAL') &&
    !s.includes('SEMI') &&
    !s.includes('QUARTER') &&
    !s.includes('ROUND_OF_16') &&
    !s.includes('THIRD')
  ) {
    return 'final';
  }
  if (s.includes('THIRD') || g.includes('TERCEIRO') || g.includes('3º') || g.includes('3O')) {
    return 'third_place';
  }
  if (
    s.includes('LAST_16') ||
    s.includes('ROUND_OF_16') ||
    s.includes('LAST_32') ||
    s.includes('QUARTER') ||
    s.includes('SEMI') ||
    g.includes('OITAVAS') ||
    g.includes('QUARTAS') ||
    g.includes('SEMI')
  ) {
    return 'ko';
  }
  return 'groups';
};

export type PhaseLockKey = 'groups' | 'round_of_32' | 'oitavas' | 'quartas' | 'semis' | 'third_place' | 'final';

/**
 * Maps a match stage and group to the phase-lock key used in Regulamento 2.
 * Each tournament stage gets its own key so that phases lock independently.
 */
export const getPhaseLockKey = (stage?: string, group?: string): PhaseLockKey => {
  const s = (stage || '').toUpperCase();
  const g = (group || '').toUpperCase();

  if (
    s.includes('FINAL') &&
    !s.includes('SEMI') &&
    !s.includes('QUARTER') &&
    !s.includes('ROUND_OF_16') &&
    !s.includes('THIRD')
  ) {
    return 'final';
  }
  if (s.includes('THIRD') || g.includes('TERCEIRO') || g.includes('3º') || g.includes('3O')) {
    return 'third_place';
  }
  if (s.includes('SEMI') || g.includes('SEMI')) return 'semis';
  if (s.includes('QUARTER') || g.includes('QUARTAS')) return 'quartas';
  if (s.includes('ROUND_OF_16') || s.includes('LAST_16') || g.includes('OITAVAS')) return 'oitavas';
  if (
    s.includes('ROUND_OF_32') ||
    s.includes('LAST_32') ||
    /16\s*AVOS/i.test(group || '')
  ) {
    return 'round_of_32';
  }
  return 'groups';
};

export type ExtraPhaseKey = 'groups' | 'round_of_32' | 'oitavas' | 'quartas' | 'semis';

/**
 * Maps the current match's phase to the KnockoutPhaseKey it feeds into (Regulamento 2).
 * Used to auto-fill groupClassifications when the user saves a match prediction.
 *   16 avos match  → classifies into Oitavas
 *   Oitavas match  → classifies into Quartas
 *   Quartas match  → classifies into Semis
 *   Semis match    → no downstream phase tracked (returns null)
 */
export const getKnockoutClassifiesPhase = (stage?: string, group?: string): KnockoutPhaseKey | null => {
  const key = getPhaseLockKey(stage, group);
  if (key === 'round_of_32') return 'Oitavas';
  if (key === 'oitavas') return 'Quartas';
  if (key === 'quartas') return 'Semis';
  return null;
};

/**
 * Maps a match to the "maior diferença de gols por fase" phase key (Regulamento 2).
 * Mirrors the bucketing used in ExtraPhasePredictionsCard so scoring stays consistent.
 * Unlike getMatchPhase, this distinguishes oitavas/quartas/semis (getMatchPhase
 * collapses them all into 'ko').
 */
export const getExtraPhaseKey = (stage?: string, group?: string): ExtraPhaseKey | null => {
  const s = (stage || '').toUpperCase();
  const g = (group || '').toUpperCase();

  if (s.includes('SEMI') || g.includes('SEMI')) return 'semis';
  if (s.includes('QUARTER') || g.includes('QUARTAS')) return 'quartas';
  if (s.includes('ROUND_OF_16') || s.includes('LAST_16') || g.includes('OITAVAS')) return 'oitavas';
  if (s.includes('ROUND_OF_32') || s.includes('LAST_32') || g.includes('16_AVOS') || g.includes('16AVOS')) return 'round_of_32';
  if (s.includes('REGULAR') || s.includes('GROUP') || g.includes('GRUPO')) return 'groups';
  return null;
};

/**
 * Checks if the tournament final match has finished.
 * Used to determine when to calculate tournament prediction points (Regulamento 1).
 */
export const isTournamentFinalFinished = (matches: { stage?: string; group?: string; status: string }[]): boolean => {
  return matches.some(
    (m) => getMatchPhase(m.stage, m.group) === 'final' && m.status === MatchStatus.FINISHED
  );
};

/**
 * Calculates the potential bonus points if the underdog wins.
 */
export const calculateUnderdogBonus = (
  winnerRank: number | undefined,
  loserRank: number | undefined,
  minRankDiff = FALLBACK_MIN_RANK_DIFF
): number => {
  if (!winnerRank || !loserRank) return 0;

  if (winnerRank > loserRank) {
    const diff = winnerRank - loserRank;
    if (diff <= minRankDiff) return 0;
    const calculatedBonus = Math.floor(diff * UNDERDOG_BONUS_FACTOR);
    return Math.min(calculatedBonus, MAX_UNDERDOG_BONUS);
  }

  return 0;
};

/**
 * REGULAMENTO 1 (Default): Stateless single-prediction points calculator
 */
export const calculatePoints = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  homeRank?: number,
  awayRank?: number,
  minRankDiff = FALLBACK_MIN_RANK_DIFF,
  predWhoClassifiesId?: string,
  realWhoClassifiesId?: string
): number => {
  const cat = getScoreCategoryRegulamento1(predHome, predAway, realHome, realAway, homeRank, awayRank, minRankDiff, predWhoClassifiesId, realWhoClassifiesId);

  if (cat.type === 'exact') return POINTS_EXACT + cat.underdogBonus + cat.classifiesBonus;
  if (cat.type === 'diff') return POINTS_GOAL_DIFF + cat.underdogBonus + cat.classifiesBonus;
  if (cat.type === 'outcome') return POINTS_OUTCOME + cat.underdogBonus + cat.classifiesBonus;
  return POINTS_WRONG;
};

export interface MatchPredictionContext {
  userId: string;
  homeScore: number;
  awayScore: number;
}

export interface ScoreCategoryR1 {
  type: 'exact' | 'diff' | 'outcome' | 'wrong';
  underdogBonus: number;
  classifiesBonus: number;
}

export interface ScoreCategoryR2 {
  type: 'exact' | 'diff' | 'outcome' | 'wrong';
  aloneBonus: boolean;
}

/**
 * REGULAMENTO 1: Returns the score category and underdog bonus without computing total points.
 * predWhoClassifiesId / realWhoClassifiesId: team IDs for who advances (R1, knockout draws).
 * classifiesBonus (+3) is only applied when:
 *   - The predicted score is a draw (predHome === predAway)
 *   - The real result resolves via PENALTY_SHOOTOUT (realWhoClassifiesId is provided)
 *   - The user's predicted team to advance matches the real one
 */
export const getScoreCategoryRegulamento1 = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  homeRank?: number,
  awayRank?: number,
  minRankDiff = FALLBACK_MIN_RANK_DIFF,
  predWhoClassifiesId?: string,
  realWhoClassifiesId?: string
): ScoreCategoryR1 => {
  const isExact = predHome === realHome && predAway === realAway;

  const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
  const realOutcome = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

  let underdogBonus = 0;
  if (realHome !== realAway && homeRank && awayRank) {
    const winnerRank = realHome > realAway ? homeRank : awayRank;
    const loserRank = realHome > realAway ? awayRank : homeRank;
    underdogBonus = calculateUnderdogBonus(winnerRank, loserRank, minRankDiff);
  }

  // classifiesBonus: only when pred is draw AND real game went to shootout
  const predIsDraw = predHome === predAway;
  const classifiesBonus =
    predIsDraw &&
    !!predWhoClassifiesId &&
    !!realWhoClassifiesId &&
    predWhoClassifiesId === realWhoClassifiesId
      ? POINTS_CLASSIFIES_BONUS
      : 0;

  if (isExact) {
    return { type: 'exact', underdogBonus, classifiesBonus };
  }

  if (predOutcome === realOutcome) {
    // Rule 3: no diff bonus when real result is a draw
    if (realHome === realAway) {
      return { type: 'outcome', underdogBonus, classifiesBonus };
    }
    const predDiff = predHome - predAway;
    const realDiff = realHome - realAway;
    if (predDiff === realDiff) {
      return { type: 'diff', underdogBonus, classifiesBonus };
    }
    return { type: 'outcome', underdogBonus, classifiesBonus };
  }

  return { type: 'wrong', underdogBonus: 0, classifiesBonus: 0 };
};

/**
 * REGULAMENTO 2: Returns the score category and alone-bonus flag without computing total points.
 */
export const getScoreCategoryRegulamento2 = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  phase: MatchPhase,
  matchPredictions: MatchPredictionContext[],
  currentUserId: string
): ScoreCategoryR2 => {
  const isExact = predHome === realHome && predAway === realAway;
  const isRealDraw = realHome === realAway;
  const isOutcomeCorrect =
    (realHome > realAway && predHome > predAway) ||
    (realHome < realAway && predHome < predAway) ||
    (realHome === realAway && predHome === predAway);

  const realDiff = realHome - realAway;
  const predDiff = predHome - predAway;
  const isDiffCorrect = realDiff === predDiff;

  if (isExact) {
    const exactHits = matchPredictions.filter(
      (p) => p.homeScore === realHome && p.awayScore === realAway
    );
    const aloneBonus = exactHits.length === 1 && exactHits[0].userId === currentUserId;
    return { type: 'exact', aloneBonus };
  }

  if (isOutcomeCorrect) {
    if (isRealDraw) {
      return { type: 'outcome', aloneBonus: false };
    } else if (isDiffCorrect) {
      return { type: 'diff', aloneBonus: false };
    } else {
      return { type: 'outcome', aloneBonus: false };
    }
  }

  return { type: 'wrong', aloneBonus: false };
};

/**
 * REGULAMENTO 2: State-aware prediction points calculator (with Placar Sozinho +5 bonus)
 */
export const calculatePointsRegulamento2 = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  phase: MatchPhase,
  matchPredictions: MatchPredictionContext[],
  currentUserId: string
): number => {
  const cat = getScoreCategoryRegulamento2(predHome, predAway, realHome, realAway, phase, matchPredictions, currentUserId);

  let pointsExact = 15;
  let pointsDiff = 13;
  let pointsOutcome = 10;

  if (phase === 'third_place') {
    pointsExact = 17;
    pointsDiff = 15;
    pointsOutcome = 12;
  } else if (phase === 'final') {
    pointsExact = 22;
    pointsDiff = 19;
    pointsOutcome = 16;
  }

  if (cat.type === 'exact') {
    return pointsExact + (cat.aloneBonus ? 5 : 0);
  }
  if (cat.type === 'diff') {
    return pointsDiff;
  }
  if (cat.type === 'outcome') {
    return pointsOutcome;
  }
  return 0;
};

/**
 * REGULAMENTO 1 (Default): Stateless tournament predictions calculator
 */
export const calculateTournamentPoints = (
  prediction: TournamentPredictions | undefined,
  actual: TournamentPredictions | undefined
): number => {
  if (!prediction || !actual) return 0;

  let points = 0;

  if (prediction.topScorer?.player && actual.topScorer?.player) {
    if (prediction.topScorer.player.trim().toLowerCase() === actual.topScorer.player.trim().toLowerCase()) {
      points += POINTS_TOP_SCORER_NAME;
    }
  }

  if (prediction.topScorer?.goals && actual.topScorer?.goals) {
    if (prediction.topScorer.goals === actual.topScorer.goals) {
      points += POINTS_TOP_SCORER_GOALS;
    }
  }

  if (prediction.championTeamId && actual.championTeamId) {
    if (prediction.championTeamId === actual.championTeamId) {
      points += POINTS_CHAMPION;
    }
  }

  if (prediction.bestPlayer && actual.bestPlayer) {
    if (prediction.bestPlayer.trim().toLowerCase() === actual.bestPlayer.trim().toLowerCase()) {
      points += POINTS_BEST_PLAYER;
    }
  }

  if (prediction.bestGoalkeeper && actual.bestGoalkeeper) {
    if (prediction.bestGoalkeeper.trim().toLowerCase() === actual.bestGoalkeeper.trim().toLowerCase()) {
      points += POINTS_BEST_GOALKEEPER;
    }
  }

  return points;
};

export interface TournamentPredictionContext {
  userId: string;
  championTeamId?: string;
  topScorerPlayerId?: string;
}

export type KnockoutPhaseKey = 'Oitavas' | 'Quartas' | 'Semis';

/**
 * Maps a knockout phase to the stage identifiers of the PREVIOUS round whose
 * winner advances into that phase.
 *   Oitavas ← 16 Avos (ROUND_OF_32 / LAST_32 / 16_AVOS)
 *   Quartas ← Oitavas (ROUND_OF_16 / LAST_16 / OITAVAS)
 *   Semis   ← Quartas (QUARTER / QUARTAS)
 */
const KNOCKOUT_FEEDER_STAGE: Record<KnockoutPhaseKey, (stage: string, group: string) => boolean> = {
  Oitavas: (s, g) =>
    s.includes('ROUND_OF_32') || s.includes('LAST_32') ||
    g.includes('16_AVOS') || g.includes('16AVOS'),
  Quartas: (s, g) =>
    s.includes('ROUND_OF_16') || s.includes('LAST_16') || g.includes('OITAVAS'),
  Semis: (s, g) =>
    s.includes('QUARTER') || g.includes('QUARTAS'),
};

/**
 * Verifica se o palpite especial de "quem avança" para uma fase knockout é
 * coerente com o palpite do jogo da fase anterior para aquele time.
 *
 * Regras:
 * - Se o usuário não palpitou no jogo correspondente → false (obrigatório).
 * - Se o palpite do jogo indica vitória do time adversário → false (incoerente).
 * - Se o palpite do jogo indica vitória do próprio time → true.
 * - Se o palpite do jogo indica empate → true (ambos os times são coerentes;
 *   o usuário não pode prever o vencedor dos pênaltis).
 *
 * @param teamId         ID do time escolhido para avançar.
 * @param phase          Fase knockout cujo palpite especial está sendo validado.
 * @param userMatchPreds Mapa matchId → {home, away} com os palpites do usuário.
 * @param sourceMatches  Lista de jogos que alimentam a fase (toda a competição).
 */
export const isKnockoutPredictionCoherent = (
  teamId: string,
  phase: KnockoutPhaseKey,
  userMatchPreds: Record<string, { home: number; away: number }>,
  sourceMatches: Array<{ id: string; homeTeamId?: string | null; awayTeamId?: string | null; stage?: string; group?: string }>
): boolean => {
  const isFeeder = KNOCKOUT_FEEDER_STAGE[phase];
  const feederMatch = sourceMatches.find((m) => {
    const s = (m.stage || '').toUpperCase();
    const g = (m.group || '').toUpperCase();
    return (
      isFeeder(s, g) &&
      (m.homeTeamId === teamId || m.awayTeamId === teamId)
    );
  });

  if (!feederMatch) return false;

  const pred = userMatchPreds[feederMatch.id];
  if (!pred) return false;

  const { home, away } = pred;
  if (home === away) return true; // empate: qualquer time é coerente

  const predictedWinnerId =
    home > away ? feederMatch.homeTeamId : feederMatch.awayTeamId;
  return predictedWinnerId === teamId;
};

/**
 * REGULAMENTO 2: State-aware tournament predictions calculator (Champion/Top Scorer divided scoring)
 */
export const calculateTournamentPointsRegulamento2 = (
  prediction: TournamentPredictions | undefined,
  actual: TournamentPredictions | undefined,
  allGroupPredictions: TournamentPredictionContext[],
  currentUserId: string,
  userMatchPredictions?: Record<string, { home: number; away: number }>,
  phaseSourceMatches?: Array<{ id: string; homeTeamId?: string | null; awayTeamId?: string | null; stage?: string; group?: string }>
): number => {
  if (!prediction || !actual) return 0;

  let points = 0;

  // 1. Champion points
  if (prediction.championTeamId && actual.championTeamId) {
    if (prediction.championTeamId === actual.championTeamId) {
      const correctChampionUsers = allGroupPredictions.filter(
        (p) => p.championTeamId === actual.championTeamId
      );
      const count = correctChampionUsers.length;
      if (count === 1) {
        points += 100;
      } else if (count === 2) {
        points += 70;
      } else if (count === 3) {
        points += 50;
      } else if (count >= 4) {
        points += 40;
      }
    }
  }

  // 2. Top Scorer points (sempre por UUID dos jogadores — nunca por nome)
  let topScorerCorrect = false;
  let correctCount = 0;

  if (actual.topScorerPlayerIds && actual.topScorerPlayerIds.length > 0) {
    if (prediction.topScorerPlayerId && actual.topScorerPlayerIds.includes(prediction.topScorerPlayerId)) {
      topScorerCorrect = true;
      const correctScorerUsers = allGroupPredictions.filter(
        (p) => p.topScorerPlayerId && actual.topScorerPlayerIds!.includes(p.topScorerPlayerId)
      );
      correctCount = correctScorerUsers.length;
    }
  }

  if (topScorerCorrect) {
    if (correctCount === 1) {
      points += 60;
    } else if (correctCount === 2) {
      points += 40;
    } else if (correctCount === 3) {
      points += 30;
    } else if (correctCount >= 4) {
      points += 25;
    }
  }

  // 3. Pre-cup Extra predictions (Team with most goals / conceded)
  // Prefer arrays; fall back to legacy single UUID for backward compatibility.
  if (prediction.mostGoalsTeamId) {
    const officialMostGoalsIds = actual.mostGoalsTeamIds && actual.mostGoalsTeamIds.length > 0
      ? actual.mostGoalsTeamIds
      : (actual.mostGoalsTeamId ? [actual.mostGoalsTeamId] : []);
    if (officialMostGoalsIds.includes(prediction.mostGoalsTeamId)) {
      points += 20;
    }
  }

  if (prediction.mostConcededTeamId) {
    const officialMostConcededIds = actual.mostConcededTeamIds && actual.mostConcededTeamIds.length > 0
      ? actual.mostConcededTeamIds
      : (actual.mostConcededTeamId ? [actual.mostConcededTeamId] : []);
    if (officialMostConcededIds.includes(prediction.mostConcededTeamId)) {
      points += 20;
    }
  }

  // 4. Group classifications & Knockout qualifiers points: 10 points per correct group team, 5 points per correct knockout team
  // 16 Avos de Final (DezesseisAvos) was removed from Regulamento 2, so skip it entirely.
  if (prediction.groupClassifications && actual.groupClassifications) {
    Object.entries(prediction.groupClassifications).forEach(([groupName, predTeams]) => {
      if (groupName === "DezesseisAvos") return;
      const isKnockout = ["Oitavas", "Quartas", "Semis"].includes(groupName);
      let actualTeams = actual.groupClassifications?.[groupName];
      // Defensive cap: group-stage entries must have at most 2 qualifiers (1st and 2nd place).
      // A 3rd-place qualifier must never score points per the regulation.
      if (!isKnockout && actualTeams) {
        actualTeams = actualTeams.slice(0, 2);
      }
      if (actualTeams && Array.isArray(predTeams) && Array.isArray(actualTeams)) {
        const validPreds = predTeams.filter(Boolean);
        validPreds.forEach((teamId) => {
          if (!actualTeams!.includes(teamId)) return;
          // For knockout phases (Oitavas/Quartas/Semis), enforce coherence between
          // the special pick and the user's match prediction for the feeder round.
          // Only applied when the caller provides match context (backward compat).
          if (isKnockout && userMatchPredictions && phaseSourceMatches) {
            if (!isKnockoutPredictionCoherent(
              teamId,
              groupName as KnockoutPhaseKey,
              userMatchPredictions,
              phaseSourceMatches
            )) return;
          }
          points += isKnockout ? 5 : 10;
        });
      }
    });
  }

  return points;
};

/**
 * R1 knockout scoring base: tempo regular + prorrogação (120 min), igual ao Regulamento 2.
 *
 * Histórico: até 2026-06 o mata-mata do R1 pontuava apenas o tempo regular (90 min).
 * Após enquete com os usuários, a regra passou a contabilizar a prorrogação (120 min),
 * alinhando-se ao Regulamento 2. Os pênaltis continuam fora do placar (resolvem apenas
 * o bônus "quem se classifica").
 *
 * Prefere as colunas planas (regularHome/Away + extraTimeHome/Away); cai para o
 * resultado final pré-computado (fallback) em linhas antigas sem colunas planas.
 */
export const getR1MatchScoringResult = (
  match: { regularHome?: number | null; regularAway?: number | null; extraTimeHome?: number | null; extraTimeAway?: number | null; penaltiesHome?: number | null; score?: any },
  fallbackHome: number,
  fallbackAway: number
): { home: number; away: number } => {
  if (match.regularHome != null && match.regularAway != null) {
    return {
      home: match.regularHome + (match.extraTimeHome ?? 0),
      away: match.regularAway + (match.extraTimeAway ?? 0),
    };
  }
  // fallback = resultado final (regular + prorrogação) já consolidado em match.result
  return { home: fallbackHome, away: fallbackAway };
};

/**
 * Infers match duration from flat columns.
 * Falls back to score JSONB for rows not yet synced.
 */
export const getMatchDuration = (
  match: { extraTimeHome?: number | null; penaltiesHome?: number | null; score?: any }
): 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' => {
  if (match.penaltiesHome != null) return 'PENALTY_SHOOTOUT';
  if (match.extraTimeHome != null) return 'EXTRA_TIME';
  return match.score?.duration ?? 'REGULAR';
};

/**
 * Returns the id of the team that advanced through the knockout tiebreaker.
 * Covers both EXTRA_TIME (winner from result) and PENALTY_SHOOTOUT (winner from penalties).
 * Returns undefined for REGULAR matches — no tiebreaker, whoClassifiesTeamId bonus not applicable.
 */
export const getKnockoutAdvancingTeamId = (
  match: {
    extraTimeHome?: number | null;
    penaltiesHome?: number | null;
    penaltiesAway?: number | null;
    result?: { home: number; away: number } | null;
    homeTeam?: { id: string } | null;
    awayTeam?: { id: string } | null;
    score?: any;
  }
): string | undefined => {
  const duration = getMatchDuration(match);

  if (duration === 'PENALTY_SHOOTOUT') {
    if (match.penaltiesHome != null && match.penaltiesAway != null) {
      return match.penaltiesHome > match.penaltiesAway ? match.homeTeam?.id : match.awayTeam?.id;
    }
    // JSONB backward compat
    return match.score?.winner === 'HOME_TEAM' ? match.homeTeam?.id : match.awayTeam?.id;
  }

  if (duration === 'EXTRA_TIME' && match.result) {
    return match.result.home > match.result.away ? match.homeTeam?.id : match.awayTeam?.id;
  }

  return undefined;
};

export interface PhaseMatchContext {
  id: string;
  resultHome?: number | null;
  resultAway?: number | null;
  status: string;
}

/**
 * REGULAMENTO 2: Phase extra prediction points calculator (match with biggest goal diff per phase).
 * officialMatchIds: array of matchIds manually set by the admin as the official result for the phase.
 * If provided, the user's prediction scores 20 points when its matchId is included in the array.
 * If not provided, the score is computed automatically from finished matches (ties allowed).
 */
export const calculateExtraPhasePoints = (
  userPrediction: { phase: string; matchId?: string } | undefined,
  phaseMatches: PhaseMatchContext[],
  officialMatchIds?: string[]
): number => {
  if (!userPrediction || !userPrediction.matchId) return 0;

  // Admin override: if the admin set the official match(es) for this phase, use them directly
  if (officialMatchIds && officialMatchIds.length > 0) {
    return officialMatchIds.includes(userPrediction.matchId) ? 20 : 0;
  }

  const finishedMatches = phaseMatches.filter(
    (m) => m.status === 'FINISHED' && m.resultHome != null && m.resultAway != null
  );
  if (finishedMatches.length === 0) return 0;

  let maxDiff = -1;
  const matchDiffs = finishedMatches.map((m) => {
    const diff = Math.abs((m.resultHome ?? 0) - (m.resultAway ?? 0));
    if (diff > maxDiff) maxDiff = diff;
    return { id: m.id, diff };
  });

  if (maxDiff < 0) return 0;

  const correctMatchIds = matchDiffs
    .filter((md) => md.diff === maxDiff)
    .map((md) => md.id);

  if (correctMatchIds.includes(userPrediction.matchId)) {
    return 20; // 20 points for correct guess
  }

  return 0;
};

export const calculateTopScorerPoints = calculateTournamentPoints;
