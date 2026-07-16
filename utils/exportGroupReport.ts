import * as XLSX from "xlsx";
import {
  User,
  Match,
  MatchStatus,
  TournamentPredictions,
  Group,
  PredictionDB,
  ExtraPhasePredictionDB,
  CompetitionDB,
  Team,
} from "../types";
import {
  calculatePoints,
  calculatePointsRegulamento2,
  getMatchPhase,
  getScoreCategoryRegulamento1,
  getScoreCategoryRegulamento2,
  getR1MatchScoringResult,
  getKnockoutAdvancingTeamId,
  calculateExtraPhasePoints,
  getExtraPhaseKey,
  isKnockoutPredictionCoherent,
  type KnockoutPhaseKey,
  POINTS_TOP_SCORER_NAME,
  POINTS_TOP_SCORER_GOALS,
  POINTS_CHAMPION,
  POINTS_BEST_PLAYER,
  POINTS_BEST_GOALKEEPER,
} from "./scoring";

export interface ExportGroupReportInput {
  group: Group;
  users: User[];
  matches: Match[];
  tournamentResults: TournamentPredictions | null;
  dbPredictions: PredictionDB[];
  extraPhasePredictions: ExtraPhasePredictionDB[];
  competitions: CompetitionDB[];
  teams: Team[];
  players: { id: string; name: string }[];
  lockDate: string | null;
}

interface MatchRow {
  date: string;
  phase: string;
  groupName: string;
  homeTeam: string;
  awayTeam: string;
  realHome: number | string;
  realAway: number | string;
  predHome: number | string;
  predAway: number | string;
  resultLabel: string;
  points: number;
  aloneBonus: number;
  underdogBonus: number;
  classifiesBonus: number;
}

interface SpecialRow {
  category: string;
  prediction: string;
  actual: string;
  points: number;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function sanitizeSheetName(name: string): string {
  // Excel sheet names cannot contain: : \ / ? * [ ] and are limited to 31 chars.
  return name
    .replace(/[:\\/?*[\]]/g, "-")
    .slice(0, 31)
    .trim();
}

function formatTeamName(teamId: string | undefined, teams: Team[]): string {
  if (!teamId) return "–";
  return (
    teams.find((t) => t.id === teamId || String(t.externalTeamId) === teamId)
      ?.name || teamId
  );
}

function formatPlayerName(playerId: string | undefined, players: { id: string; name: string }[]): string {
  if (!playerId) return "–";
  return players.find((p) => p.id === playerId)?.name || playerId;
}

function getMatchResultLabel(
  isExact: boolean,
  isOutcomeCorrect: boolean,
  isDiffCorrect: boolean,
  aloneBonus: boolean
): string {
  if (isExact) return aloneBonus ? "Placar exato (só você)" : "Placar exato";
  if (isOutcomeCorrect && isDiffCorrect) return "Diferença certa";
  if (isOutcomeCorrect) return "Resultado certo";
  return "Errou";
}

function buildRankingRows(users: User[], ruleset: "regulamento_1" | "regulamento_2") {
  const sorted = [...users].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (ruleset === "regulamento_2" && a.tieBreakStats && b.tieBreakStats) {
      if (b.tieBreakStats.championHit !== a.tieBreakStats.championHit)
        return b.tieBreakStats.championHit - a.tieBreakStats.championHit;
      if (b.tieBreakStats.exactHits !== a.tieBreakStats.exactHits)
        return b.tieBreakStats.exactHits - a.tieBreakStats.exactHits;
      if (b.tieBreakStats.resultHits !== a.tieBreakStats.resultHits)
        return b.tieBreakStats.resultHits - a.tieBreakStats.resultHits;
      if (b.tieBreakStats.diffHits !== a.tieBreakStats.diffHits)
        return b.tieBreakStats.diffHits - a.tieBreakStats.diffHits;
    }
    return 0;
  });

  let currentRank = 0;

  return sorted.map((user, index) => {
    const isSameAsPrevious =
      index > 0 &&
      user.totalPoints === sorted[index - 1].totalPoints &&
      (ruleset !== "regulamento_2" ||
        !user.tieBreakStats ||
        !sorted[index - 1].tieBreakStats ||
        (user.tieBreakStats.championHit ===
          sorted[index - 1].tieBreakStats!.championHit &&
          user.tieBreakStats.exactHits ===
            sorted[index - 1].tieBreakStats!.exactHits &&
          user.tieBreakStats.resultHits ===
            sorted[index - 1].tieBreakStats!.resultHits &&
          user.tieBreakStats.diffHits ===
            sorted[index - 1].tieBreakStats!.diffHits));

    if (!isSameAsPrevious) {
      currentRank = index + 1;
    }

    const breakdown = user.scoreBreakdown || {
      exactCount: 0,
      diffCount: 0,
      outcomeCount: 0,
      wrongCount: 0,
      underdogBonusCount: 0,
      underdogBonusTotal: 0,
      aloneBonusCount: 0,
      aloneBonusTotal: 0,
    };

    return {
      Posição: currentRank,
      Nome: user.name,
      "Pontos Totais": user.totalPoints,
      "Pontos de Jogos": ruleset === "regulamento_2" ? (user.matchPoints ?? 0) : null,
      "Pontos Especiais": ruleset === "regulamento_2" ? (user.specialPoints ?? 0) : null,
      "Acertos Exatos": breakdown.exactCount,
      "Diferença de Gols": breakdown.diffCount,
      "Resultados Certos": breakdown.outcomeCount,
      Erros: breakdown.wrongCount,
      "Bônus Zebra (R1)": breakdown.underdogBonusTotal ?? 0,
      "Bônus Placar Isolado (R2)": breakdown.aloneBonusTotal ?? 0,
    };
  });
}

function buildSpecialRowsR1(
  user: User,
  actual: TournamentPredictions | null,
  lockDate: string | null,
  teams: Team[]
): SpecialRow[] {
  if (!actual || !lockDate || new Date() < new Date(lockDate)) return [];
  const pred = user.tournamentPredictions;
  if (!pred) return [];

  const rows: SpecialRow[] = [];

  if (pred.topScorer?.player) {
    rows.push({
      category: "Artilheiro (nome)",
      prediction: pred.topScorer.player,
      actual: actual.topScorer?.player || "–",
      points:
        actual.topScorer?.player &&
        pred.topScorer.player.trim().toLowerCase() ===
          actual.topScorer.player.trim().toLowerCase()
          ? POINTS_TOP_SCORER_NAME
          : 0,
    });
  }

  if (pred.topScorer?.goals) {
    rows.push({
      category: "Artilheiro (gols)",
      prediction: String(pred.topScorer.goals),
      actual: actual.topScorer?.goals ? String(actual.topScorer.goals) : "–",
      points:
        actual.topScorer?.goals &&
        pred.topScorer.goals === actual.topScorer.goals
          ? POINTS_TOP_SCORER_GOALS
          : 0,
    });
  }

  if (pred.championTeamId) {
    rows.push({
      category: "Campeão",
      prediction: formatTeamName(pred.championTeamId, teams),
      actual: formatTeamName(actual.championTeamId, teams),
      points:
        actual.championTeamId &&
        pred.championTeamId === actual.championTeamId
          ? POINTS_CHAMPION
          : 0,
    });
  }

  if (pred.bestPlayer) {
    rows.push({
      category: "Melhor Jogador",
      prediction: pred.bestPlayer,
      actual: actual.bestPlayer || "–",
      points:
        actual.bestPlayer &&
        pred.bestPlayer.trim().toLowerCase() ===
          actual.bestPlayer.trim().toLowerCase()
          ? POINTS_BEST_PLAYER
          : 0,
    });
  }

  if (pred.bestGoalkeeper) {
    rows.push({
      category: "Melhor Goleiro",
      prediction: pred.bestGoalkeeper,
      actual: actual.bestGoalkeeper || "–",
      points:
        actual.bestGoalkeeper &&
        pred.bestGoalkeeper.trim().toLowerCase() ===
          actual.bestGoalkeeper.trim().toLowerCase()
          ? POINTS_BEST_GOALKEEPER
          : 0,
    });
  }

  return rows;
}

function buildSpecialRowsR2(
  user: User,
  actual: TournamentPredictions | null,
  allUsers: User[],
  group: Group,
  matches: Match[],
  extraPhasePredictions: ExtraPhasePredictionDB[],
  competitions: CompetitionDB[],
  teams: Team[],
  players: { id: string; name: string }[],
  lockDate: string | null
): SpecialRow[] {
  if (!lockDate || new Date() < new Date(lockDate)) return [];
  const pred = user.tournamentPredictions;
  if (!pred) return [];

  const activeCompCode = (group.competitionCode || "WC").toUpperCase();

  const allGroupPredictions = allUsers.map((u) => ({
    userId: u.id,
    championTeamId: u.tournamentPredictions?.championTeamId,
    topScorerPlayerId: u.tournamentPredictions?.topScorerPlayerId,
  }));

  const phaseSourceMatches = matches
    .filter((m) => (m.competitionCode || "WC").toUpperCase() === activeCompCode)
    .map((m) => ({
      id: m.id,
      homeTeamId: m.homeTeam?.id ?? null,
      awayTeamId: m.awayTeam?.id ?? null,
      stage: m.stage,
      group: m.group,
    }));

  const userMatchPreds: Record<string, { home: number; away: number }> = {};
  Object.entries(user.predictions || {}).forEach(([matchId, p]) => {
    userMatchPreds[matchId] = { home: p.home, away: p.away };
  });

  const rows: SpecialRow[] = [];

  // Champion
  if (pred.championTeamId) {
    let pts = 0;
    if (actual?.championTeamId && pred.championTeamId === actual.championTeamId) {
      const count = allGroupPredictions.filter(
        (p) => p.championTeamId === actual.championTeamId
      ).length;
      pts = count === 1 ? 100 : count === 2 ? 70 : count === 3 ? 50 : 40;
    }
    rows.push({
      category: "Campeão",
      prediction: formatTeamName(pred.championTeamId, teams),
      actual: formatTeamName(actual?.championTeamId, teams),
      points: pts,
    });
  }

  // Top scorer
  if (pred.topScorerPlayerId) {
    let pts = 0;
    let isCorrect = false;
    let count = 0;
    if (
      actual?.topScorerPlayerIds &&
      actual.topScorerPlayerIds.length > 0 &&
      actual.topScorerPlayerIds.includes(pred.topScorerPlayerId)
    ) {
      isCorrect = true;
      count = allGroupPredictions.filter(
        (p) =>
          p.topScorerPlayerId &&
          actual.topScorerPlayerIds!.includes(p.topScorerPlayerId)
      ).length;
    } else if (actual?.topScorer?.player) {
      const predName = formatPlayerName(pred.topScorerPlayerId, players);
      if (
        predName.trim().toLowerCase() === actual.topScorer.player.trim().toLowerCase()
      ) {
        isCorrect = true;
        count = allGroupPredictions.filter((p) => {
          if (p.topScorerPlayerId && pred.topScorerPlayerId)
            return p.topScorerPlayerId === pred.topScorerPlayerId;
          return false;
        }).length;
      }
    }
    if (isCorrect) {
      pts = count === 1 ? 60 : count === 2 ? 40 : count === 3 ? 30 : 25;
    }
    rows.push({
      category: "Artilheiro",
      prediction: formatPlayerName(pred.topScorerPlayerId, players),
      actual:
        actual?.topScorerPlayerIds && actual.topScorerPlayerIds.length > 0
          ? actual.topScorerPlayerIds
              .map((id) => formatPlayerName(id, players))
              .join(", ")
          : actual?.topScorer?.player || "–",
      points: pts,
    });
  }

  // Most goals / conceded teams
  if (pred.mostGoalsTeamId) {
    const officialIds =
      actual?.mostGoalsTeamIds && actual.mostGoalsTeamIds.length > 0
        ? actual.mostGoalsTeamIds
        : actual?.mostGoalsTeamId
        ? [actual.mostGoalsTeamId]
        : [];
    rows.push({
      category: "Seleção com mais gols num jogo",
      prediction: formatTeamName(pred.mostGoalsTeamId, teams),
      actual:
        officialIds.length > 0
          ? officialIds.map((id) => formatTeamName(id, teams)).join(", ")
          : "–",
      points: officialIds.includes(pred.mostGoalsTeamId) ? 20 : 0,
    });
  }

  if (pred.mostConcededTeamId) {
    const officialIds =
      actual?.mostConcededTeamIds && actual.mostConcededTeamIds.length > 0
        ? actual.mostConcededTeamIds
        : actual?.mostConcededTeamId
        ? [actual.mostConcededTeamId]
        : [];
    rows.push({
      category: "Seleção que tomou mais gols num jogo",
      prediction: formatTeamName(pred.mostConcededTeamId, teams),
      actual:
        officialIds.length > 0
          ? officialIds.map((id) => formatTeamName(id, teams)).join(", ")
          : "–",
      points: officialIds.includes(pred.mostConcededTeamId) ? 20 : 0,
    });
  }

  // Extra phase predictions
  const userExtraPhasePreds = extraPhasePredictions.filter(
    (ep) => ep.userId === user.id && ep.groupId === group.id
  );
  if (userExtraPhasePreds.length > 0) {
    const activeCompetition = competitions.find(
      (c) => (c.code || "").toUpperCase() === activeCompCode
    );
    const biggestGoalDiffMatchIds: Record<string, string[]> =
      activeCompetition?.biggestGoalDiffMatchIds ||
      Object.fromEntries(
        Object.entries(activeCompetition?.biggestGoalDiffMatches || {}).map(
          ([phase, matchId]) => [phase, matchId ? [matchId] : []]
        )
      );

    const phaseLabels: Record<string, string> = {
      groups: "Fase de Grupos",
      round_of_32: "16 Avos de Final",
      oitavas: "Oitavas de Final",
      quartas: "Quartas de Final",
      semis: "Semifinais",
    };
    const phaseOrder = ["groups", "round_of_32", "oitavas", "quartas", "semis"];

    phaseOrder.forEach((phaseKey) => {
      const ep = userExtraPhasePreds.find((p) => p.phase === phaseKey);
      if (!ep?.matchId) return;

      const phaseMatches = matches
        .filter((m) => getExtraPhaseKey(m.stage, m.group) === phaseKey)
        .map((m) => ({
          id: m.id,
          resultHome: m.result?.home ?? null,
          resultAway: m.result?.away ?? null,
          status: m.status,
        }));

      const officialMatchIds = biggestGoalDiffMatchIds[phaseKey];
      const pts = calculateExtraPhasePoints(
        { phase: phaseKey, matchId: ep.matchId },
        phaseMatches,
        officialMatchIds
      );

      const match = matches.find((m) => m.id === ep.matchId);
      const predictedLabel = match
        ? `${match.homeTeam.name} x ${match.awayTeam.name}`
        : ep.matchId;

      rows.push({
        category: `Maior diferença de gols - ${phaseLabels[phaseKey] || phaseKey}`,
        prediction: predictedLabel,
        actual: officialMatchIds
          ? officialMatchIds
              .map(
                (id) =>
                  matches.find((m) => m.id === id)?.homeTeam.name +
                  " x " +
                  matches.find((m) => m.id === id)?.awayTeam.name
              )
              .join(", ")
          : "–",
        points: pts,
      });
    });
  }

  // Group classifications
  if (pred.groupClassifications && actual?.groupClassifications) {
    Object.entries(pred.groupClassifications).forEach(([groupName, predTeams]) => {
      if (groupName === "DezesseisAvos") return;
      const actualTeams = actual.groupClassifications![groupName];
      if (!actualTeams || !Array.isArray(predTeams)) return;
      const validPreds = predTeams.filter(Boolean);
      if (validPreds.length === 0) return;

      const isKnockout = ["Oitavas", "Quartas", "Semis", "Final"].includes(groupName);
      let pts = 0;
      validPreds.forEach((teamId) => {
        if (!actualTeams.includes(teamId)) return;
        if (isKnockout) {
          if (
            userMatchPreds &&
            phaseSourceMatches.length > 0 &&
            !isKnockoutPredictionCoherent(
              teamId,
              groupName as KnockoutPhaseKey,
              userMatchPreds,
              phaseSourceMatches
            )
          )
            return;
          pts += 5;
        } else {
          pts += 10;
        }
      });

      rows.push({
        category: `Classificados ${groupName === "Oitavas" ? "Oitavas" : groupName}`,
        prediction: validPreds.map((id) => formatTeamName(id, teams)).join(", "),
        actual: actualTeams.map((id) => formatTeamName(id, teams)).join(", "),
        points: pts,
      });
    });
  }

  return rows;
}

function buildMatchRows(
  user: User,
  allUsers: User[],
  group: Group,
  matches: Match[],
  minRankDiff: number
): MatchRow[] {
  const activeCompCode = (group.competitionCode || "WC").toUpperCase();
  const ruleset = group.ruleset || "regulamento_1";
  const groupUserIds = new Set(allUsers.map((u) => u.id));

  const groupMatches = matches.filter(
    (m) => (m.competitionCode || "WC").toUpperCase() === activeCompCode
  );

  const sortedMatches = [...groupMatches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return sortedMatches.map((match) => {
    const pred = user.predictions?.[match.id];
    const hasResult = !!match.result;
    const isFinished = match.status === "FINISHED";

    const row: MatchRow = {
      date: formatDate(match.date),
      phase: getMatchPhase(match.stage, match.group),
      groupName: match.group || "–",
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      realHome: isFinished && hasResult ? match.result!.home : "–",
      realAway: isFinished && hasResult ? match.result!.away : "–",
      predHome: pred ? pred.home : "–",
      predAway: pred ? pred.away : "–",
      resultLabel: "–",
      points: 0,
      aloneBonus: 0,
      underdogBonus: 0,
      classifiesBonus: 0,
    };

    if (!pred || !isFinished || !hasResult) {
      return row;
    }

    if (ruleset === "regulamento_2") {
      const phase = getMatchPhase(match.stage, match.group);
      const matchPredictions = allUsers
        .filter(
          (u) =>
            groupUserIds.has(u.id) && u.predictions && u.predictions[match.id]
        )
        .map((u) => ({
          userId: u.id,
          homeScore: u.predictions[match.id].home,
          awayScore: u.predictions[match.id].away,
        }));

      const cat = getScoreCategoryRegulamento2(
        pred.home,
        pred.away,
        match.result.home,
        match.result.away,
        phase,
        matchPredictions,
        user.id
      );

      const pts = calculatePointsRegulamento2(
        pred.home,
        pred.away,
        match.result.home,
        match.result.away,
        phase,
        matchPredictions,
        user.id
      );

      row.resultLabel = getMatchResultLabel(
        cat.type === "exact",
        cat.type !== "wrong",
        cat.type === "diff",
        cat.aloneBonus
      );
      row.points = pts;
      row.aloneBonus = cat.aloneBonus ? 5 : 0;
    } else {
      const realWhoClassifiesId = getKnockoutAdvancingTeamId(match);
      const predWhoClassifiesId = pred.whoClassifiesTeamId;
      const r1Result = getR1MatchScoringResult(
        match,
        match.result.home,
        match.result.away
      );

      const cat = getScoreCategoryRegulamento1(
        pred.home,
        pred.away,
        r1Result.home,
        r1Result.away,
        match.homeTeam.ranking,
        match.awayTeam.ranking,
        minRankDiff,
        predWhoClassifiesId,
        realWhoClassifiesId
      );

      const pts = calculatePoints(
        pred.home,
        pred.away,
        r1Result.home,
        r1Result.away,
        match.homeTeam.ranking,
        match.awayTeam.ranking,
        minRankDiff,
        predWhoClassifiesId,
        realWhoClassifiesId
      );

      row.resultLabel = getMatchResultLabel(
        cat.type === "exact",
        cat.type !== "wrong",
        cat.type === "diff",
        false
      );
      row.points = pts;
      row.underdogBonus = cat.underdogBonus;
      row.classifiesBonus = cat.classifiesBonus;
    }

    return row;
  });
}

export function exportGroupReport(input: ExportGroupReportInput): ArrayBuffer {
  const {
    group,
    users,
    matches,
    tournamentResults,
    extraPhasePredictions,
    competitions,
    teams,
    players,
    lockDate,
  } = input;

  const ruleset = group.ruleset || "regulamento_1";
  const minRankDiff =
    group.underdog_min_rank_diff ?? 0;

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `Relatório ${group.name}`,
    CreatedDate: new Date(),
  };

  // 1. Ranking sheet
  const rankingRows = buildRankingRows(users, ruleset);
  const rankingSheet = XLSX.utils.json_to_sheet(rankingRows);
  XLSX.utils.book_append_sheet(wb, rankingSheet, "Ranking");

  // 2. One sheet per user
  users.forEach((user) => {
    const specialRows: SpecialRow[] =
      ruleset === "regulamento_2"
        ? buildSpecialRowsR2(
            user,
            tournamentResults,
            users,
            group,
            matches,
            extraPhasePredictions,
            competitions,
            teams,
            players,
            lockDate
          )
        : buildSpecialRowsR1(user, tournamentResults, lockDate, teams);

    const matchRows = buildMatchRows(user, users, group, matches, minRankDiff);

    const sheetData: unknown[] = [
      { section: "PALPITES ESPECIAIS" },
      ...specialRows.map((r) => ({
        Categoria: r.category,
        Palpite: r.prediction,
        Resultado: r.actual,
        Pontos: r.points,
      })),
      {}, // empty row separator
      { section: "JOGOS" },
      ...matchRows.map((r) => ({
        Data: r.date,
        Fase: r.phase,
        Grupo: r.groupName,
        Mandante: r.homeTeam,
        Visitante: r.awayTeam,
        "Placar Real": `${r.realHome} x ${r.realAway}`,
        Palpite: `${r.predHome} x ${r.predAway}`,
        Resultado: r.resultLabel,
        Pontos: r.points,
        "Bônus Placar Isolado": r.aloneBonus,
        "Bônus Zebra": r.underdogBonus,
        "Bônus Quem Classifica": r.classifiesBonus,
      })),
    ];

    const sheet = XLSX.utils.json_to_sheet(sheetData);
    const sheetName = sanitizeSheetName(user.name);
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  });

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function downloadGroupReport(
  input: ExportGroupReportInput,
  filename?: string
): void {
  const data = exportGroupReport(input);
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ||
    `bolao-${input.group.name.replace(/\s+/g, "_")}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
