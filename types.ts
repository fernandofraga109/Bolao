export enum MatchStatus {
  SCHEDULED = "SCHEDULED",
  TIMED = "TIMED",
  LIVE = "LIVE",
  IN_PLAY = "IN_PLAY",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  POSTPONED = "POSTPONED",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
}

// --- LIVE MATCH DETAILS (api-sports.io — minuto a minuto) ---
// Estes dados NÃO entram em nenhum cálculo de pontos/ranking. Servem apenas
// para enriquecer a UI ao vivo (relógio tickando, eventos, árbitro, estádio).

export type LiveMatchEventType = "Goal" | "Card" | "subst" | "Var" | string;

export interface LiveMatchEvent {
  /** Minuto do evento (status.elapsed da api-sports). */
  elapsed: number;
  /** Acréscimos no momento do evento (status.extra), quando houver. */
  extra: number | null;
  /** externalTeamId NÃO — é o id de time da api-sports (namespace próprio). */
  teamApiId: number | null;
  teamName: string | null;
  player: string | null;
  assist: string | null;
  type: LiveMatchEventType; // "Goal", "Card", "subst", "Var"
  detail: string; // "Normal Goal", "Yellow Card", "Red Card", etc.
  comments: string | null;
}

export interface LiveMatchDetails {
  /** Id do fixture na api-sports (namespace diferente do football-data). */
  apiSportsFixtureId: number;
  /** Código curto do status: 1H, HT, 2H, ET, BT, P, FT, AET, PEN, etc. */
  statusShort: string;
  statusLong?: string | null;
  /** Minuto corrente reportado pela API (fallback quando não dá pra tickar). */
  elapsed: number | null;
  /** Acréscimos correntes reportados pela API. */
  extra: number | null;
  /** Timestamps Unix (segundos) de início de cada tempo — base do relógio. */
  periods: { first: number | null; second: number | null };
  referee: string | null;
  venue: { name: string | null; city: string | null } | null;
  round?: string | null;
  events: LiveMatchEvent[];
  /** Placar ao vivo reportado pela api-sports (goals.home/away). Exibição apenas —
   *  NÃO entra em nenhum cálculo de pontos. Football-data.org sempre sobrescreve
   *  os campos oficiais (resultHome/resultAway). */
  liveScoreHome?: number | null;
  liveScoreAway?: number | null;
  /** ISO do momento em que estes dados foram buscados/persistidos. */
  syncedAt: string;
}

/** Uma estatística de time (api-sports `fixtures/statistics`). */
export interface LiveTeamStat {
  /** Rótulo cru da api-sports (ex.: "Ball Possession", "Total Shots"). */
  type: string;
  /** Valor cru — número, string com "%" ou null quando indisponível. */
  value: number | string | null;
}

/**
 * Estatísticas ao vivo de uma partida (api-sports `fixtures/statistics`).
 * Puramente cosmético — NÃO entra em pontuação. Persistido em `matches.liveStats`.
 */
export interface LiveMatchStats {
  /** Id do fixture na api-sports (mesmo namespace de LiveMatchDetails). */
  apiSportsFixtureId: number;
  /** Estatísticas do mandante (interno) já alinhadas pelo lado casado. */
  home: LiveTeamStat[];
  /** Estatísticas do visitante (interno). */
  away: LiveTeamStat[];
  /** ISO do momento em que estes dados foram buscados/persistidos. */
  syncedAt: string;
}

// --- DATABASE SCHEMAS (Normalized Data) ---

export interface SystemConfigDB {
  id: string; // UUID singleton
  is_auto_sync_enabled: boolean;
  sync_interval_ms: number;
  /** Intervalo (ms) entre buscas do minuto-a-minuto (api-sports). Controla a cota; default 50s. */
  live_details_interval_ms?: number;
  underdog_min_rank_diff: number;
  /** @deprecated Versão única legada (compartilhada entre deploys). Substituída por
   *  `app_versions` keyed por deploy. Mantida para bancos legados. */
  app_version?: string | null;
  /** Versão publicada por deploy: `{ bolao: "1.36.0", miguelfork: "1.35.1" }`.
   *  Cada deploy publica/lê só a sua chave, evitando que um deploy dispare o banner
   *  "Nova versão" para o outro antes do build correspondente subir. Chave ausente
   *  ou NULL = banner não dispara para aquele deploy. */
  app_versions?: Record<string, string> | null;
  /** Kill-switch global das animações ao vivo (gol/cartão), keyed por tipo:
   *  `{ goal, yellow, red }`. Chave ausente = habilitada (default true). */
  live_animations_enabled?: Record<string, boolean> | null;
}

export interface CompetitionDB {
  code: string;
  name: string;
  emblem?: string;
  type?: "LEAGUE" | "CUP" | string;
  lastSync?: string;
  autoSyncEnabled?: boolean;
  topScorerName?: string;
  topScorerGoals?: number;
  topScorerPlayerIds?: string[];
  championTeamId?: string;
  bestPlayerName?: string;
  bestGoalkeeperName?: string;
  mostGoalsTeamId?: string;
  mostConcededTeamId?: string;
  mostGoalsTeamIds?: string[];
  mostConcededTeamIds?: string[];
  groupClassifications?: Record<string, string[]>;
  knockoutClassifications?: Record<string, string[]>;
  /** @deprecated Usar biggestGoalDiffMatchIds (array por fase) para Regulamento 2. */
  biggestGoalDiffMatches?: Record<string, string>;
  biggestGoalDiffMatchIds?: Record<string, string[]>;
  syncLockedAt?: string;
  /** Último fetch dos detalhes ao vivo (api-sports). Usado para throttle do orçamento de chamadas. */
  liveDetailsLastSync?: string;
}

export interface StadiumDB {
  id: string;
  name: string;
  city: string;
  country: "USA" | "MEX" | "CAN";
  capacity?: number;
}

export interface TeamDB {
  id: string;
  name: string;
  code: string;
  flag: string;
  ranking: number;
  pot?: 1 | 2 | 3 | 4;
  externalTeamId?: number;
}

export interface TeamStandingsDB {
  teamId: string;
  competitionCode: string;
  season?: string;
  stage?: string;
  type?: string;
  group?: string;
  position?: number;
  playedGames?: number;
  form?: string | null;
  won?: number;
  draw?: number;
  lost?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  updatedAt?: string;
}

export interface MatchDB {
  id: string;
  externalMatchId?: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  group: string; // "Grupo A", "Oitavas", etc.
  competitionCode?: string;
  stadiumId?: string | null;
  status: MatchStatus;
  resultHome?: number;
  resultAway?: number;
  stage?: string;
  matchday?: number;
  minute?: number | null;
  lastSyncAt?: string;
  syncLocked?: boolean;
  score?: any; // Payload completo do score da API (duration, regularTime, extraTime, penalties, etc.)
  penaltiesHome?: number;
  penaltiesAway?: number;
  regularHome?: number;
  regularAway?: number;
  extraTimeHome?: number;
  extraTimeAway?: number;
  /** Detalhes ao vivo da api-sports (minuto a minuto). NÃO usado em pontuação. */
  liveDetails?: LiveMatchDetails | null;
  /** Estatísticas ao vivo da api-sports (posse, finalizações…). NÃO usado em pontuação. */
  liveStats?: LiveMatchStats | null;
}

export interface PredictionDB {
  userId: string;
  groupId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  timestamp: string;
  points?: number;
  tieWinnerTeamId?: string | null; // ID da seleção vencedora nos pênaltis (Reg. 1, mata-mata)
}

export interface PlayerDB {
  id: string;
  externalPlayerId: number;
  name: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  dateOfBirth?: string;
  nationality?: string;
}

export interface TournamentPlayerDB {
  id: string;
  playerId: string;
  competitionCode: string;
  externalTeamId: number;
  teamName: string;
  teamCrest?: string;
  goals: number;
  assists: number;
  penalties: number;
  playedMatches: number;
  lastUpdated?: string;
}

export interface PlayerWithContextDB extends PlayerDB {
  tournamentEntry: TournamentPlayerDB;
}

export interface TournamentPredictionDB {
  userId: string;
  groupId: string;
  championTeamId?: string;
  topScorerPlayerId?: string; // UUID FK → v2_players.id
  topScorerGoals?: number;   // user's predicted goal count for the top scorer
  bestPlayerId?: string;
  bestGoalkeeperId?: string;
  mostGoalsTeamId?: string;
  mostConcededTeamId?: string;
  mostGoalsTeamIds?: string[];
  mostConcededTeamIds?: string[];
  groupClassifications?: Record<string, string[]>;
}

export interface ExtraPhasePredictionDB {
  userId: string;
  groupId: string;
  phase: string;
  matchId?: string;
  createdAt?: string;
}

export interface UserDB {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar: string;
  role: "ADMIN" | "USER" | "DEACTIVATED";
  status: "ACTIVE" | "INVITED";
  activeGroupId?: string; // Persists user preference
  totalPoints: number; // Cache for performance, or calculated on fly
  createdAt?: string; // Data de cadastro (user_roles.createdAt) — usada na elegibilidade de enquetes
}

export interface GroupDB {
  id: string;
  name: string;
  code: string;
  adminId: string;
  createdAt: string;
  competitionCode?: string; // e.g., 'WC' (Copa do Mundo), 'PL' (Premier League), 'BSA' (Campeonato Brasileiro)
  underdog_min_rank_diff?: number | null;
  ruleset: "regulamento_1" | "regulamento_2";
}

export interface UserGroupDB {
  userId: string;
  groupId: string;
  joinedAt: string;
  role?: "MEMBER" | "ADMIN";
  points?: number;
}

// --- UI MODELS (Hydrated Data for Components) ---

// "Hydrated" Team including standings dictionary indexed by competition code
export interface Team extends TeamDB {
  standings?: Record<string, TeamStandingsDB>;
  
  // Retrocompatibilidade UI
  standingsCompetitionCode?: string;
  standingsSeason?: string;
  standingsStage?: string;
  standingsType?: string;
  standingsGroup?: string;
  standingsPosition?: number;
  standingsPlayedGames?: number;
  standingsForm?: string | null;
  standingsWon?: number;
  standingsDraw?: number;
  standingsLost?: number;
  standingsPoints?: number;
  standingsGoalsFor?: number;
  standingsGoalsAgainst?: number;
  standingsGoalDifference?: number;
  standingsUpdatedAt?: string;
}
export type Stadium = StadiumDB;
export type UserRole = UserDB["role"];
export type UserStatus = UserDB["status"];
export type SystemConfig = SystemConfigDB;

export interface Prediction {
  matchId: string;
  homeScore: number;
  awayScore: number;
  points?: number;
  whoClassifiesTeamId?: string; // ID da seleção que se classifica (Reg. 1, mata-mata)
}

export interface ScoreBreakdown {
  exactCount: number;
  diffCount: number;
  outcomeCount: number;
  wrongCount: number;
  underdogBonusCount?: number;
  underdogBonusTotal?: number;
  aloneBonusCount?: number;
  aloneBonusTotal?: number;
}

export interface TieBreakStats {
  championHit: number;
  exactHits: number;
  resultHits: number;
  diffHits: number;
}

export interface TournamentPredictions {
  championTeamId?: string;
  topScorer?: {
    player: string; // display name, derived from topScorerPlayerId
    goals: number;
  };
  topScorerPlayerId?: string;   // UUID FK → v2_players.id
  topScorerPlayerIds?: string[]; // Array of UUIDs of top scorers (actual/real results)
  bestPlayer?: string;          // display name, derived from bestPlayerId
  bestPlayerId?: string;        // UUID FK → v2_players.id
  bestGoalkeeper?: string;      // display name, derived from bestGoalkeeperId
  bestGoalkeeperId?: string;    // UUID FK → v2_players.id
  mostGoalsTeamId?: string;
  mostConcededTeamId?: string;
  mostGoalsTeamIds?: string[];
  mostConcededTeamIds?: string[];
  groupClassifications?: Record<string, string[]>;
}

// "Hydrated" User with nested data for easy UI consumption
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  groupIds: string[];
  activeGroupId?: string;
  predictions: Record<string, { home: number; away: number; points?: number; whoClassifiesTeamId?: string }>; // matchId -> score
  tournamentPredictions?: TournamentPredictions;
  totalPoints: number;
  predictionsCount?: number;
  scoreBreakdown?: ScoreBreakdown;
  tieBreakStats?: TieBreakStats;
  matchPoints?: number;
  specialPoints?: number;
}

export interface Match {
  id: string;
  externalMatchId?: string;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  group: string;
  competitionCode?: string;
  location?: string;
  stadiumId?: string;
  status: MatchStatus;
  result?: { home: number; away: number };
  stage?: string;
  matchday?: number;
  minute?: number | null;
  lastSyncAt?: string;
  syncLocked?: boolean;
  score?: any; // Payload completo do score da API (duration, regularTime, extraTime, penalties, etc.)
  penaltiesHome?: number;
  penaltiesAway?: number;
  regularHome?: number;
  regularAway?: number;
  extraTimeHome?: number;
  extraTimeAway?: number;
  /** Detalhes ao vivo da api-sports (minuto a minuto). NÃO usado em pontuação. */
  liveDetails?: LiveMatchDetails | null;
  /** Estatísticas ao vivo da api-sports (posse, finalizações…). NÃO usado em pontuação. */
  liveStats?: LiveMatchStats | null;
}

export type Group = GroupDB;
export type Friend = User; // Legacy alias

export type Tab = "matches" | "leaderboard" | "stats" | "tournament" | "admin" | "specials" | "animations" | "polls";

// =============================================================================
// Enquetes / Polls
// =============================================================================

/** null = todos os usuários; 'both' = quem tem grupo de reg1 OU reg2 (qualquer grupo). */
export type PollTargetRuleset = "regulamento_1" | "regulamento_2" | "both" | null;

export type PollStatus = "active" | "closed";

export interface PollDB {
  id: string;
  question: string;
  options: string[];
  allow_multiple: boolean;
  target_ruleset: PollTargetRuleset;
  status: PollStatus;
  created_at: string;
  closes_at?: string | null;
}

export type Poll = PollDB;

export interface PollResponseDB {
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at?: string;
}

/** Agregado anônimo vindo da RPC get_poll_results. Nunca contém user_id. */
export interface PollOptionResult {
  optionIndex: number;
  label: string;
  votes: number;
  /** votos / total de respondentes (0..1). Em allow_multiple a soma passa de 1. */
  percentage: number;
}

export interface PollResults {
  pollId: string;
  totalRespondents: number;
  /** Usuários elegíveis pelo targeting (não-admin). Denominador da participação. */
  eligibleUsers: number;
  /** totalRespondents / eligibleUsers (0..1). */
  participationRate: number;
  options: PollOptionResult[];
}

export interface AIPredictionResult {
  homeScore: number;
  awayScore: number;
  reasoning: string;
}
