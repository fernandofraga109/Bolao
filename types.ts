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

// --- DATABASE SCHEMAS (Normalized Data) ---

export interface SystemConfigDB {
  id: string; // UUID singleton
  is_auto_sync_enabled: boolean;
  sync_interval_ms: number;
  underdog_min_rank_diff: number;
  /** @deprecated Versão única legada (compartilhada entre deploys). Substituída por
   *  `app_versions` keyed por deploy. Mantida para bancos legados. */
  app_version?: string | null;
  /** Versão publicada por deploy: `{ bolao: "1.36.0", miguelfork: "1.35.1" }`.
   *  Cada deploy publica/lê só a sua chave, evitando que um deploy dispare o banner
   *  "Nova versão" para o outro antes do build correspondente subir. Chave ausente
   *  ou NULL = banner não dispara para aquele deploy. */
  app_versions?: Record<string, string> | null;
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
  championTeamId?: string;
  bestPlayerName?: string;
  bestGoalkeeperName?: string;
  mostGoalsTeamId?: string;
  mostConcededTeamId?: string;
  groupClassifications?: Record<string, string[]>;
  knockoutClassifications?: Record<string, string[]>;
  biggestGoalDiffMatches?: Record<string, string>;
  syncLockedAt?: string;
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

export interface TournamentPredictions {
  championTeamId?: string;
  topScorer?: {
    player: string; // display name, derived from topScorerPlayerId
    goals: number;
  };
  topScorerPlayerId?: string;   // UUID FK → v2_players.id
  bestPlayer?: string;          // display name, derived from bestPlayerId
  bestPlayerId?: string;        // UUID FK → v2_players.id
  bestGoalkeeper?: string;      // display name, derived from bestGoalkeeperId
  bestGoalkeeperId?: string;    // UUID FK → v2_players.id
  mostGoalsTeamId?: string;
  mostConcededTeamId?: string;
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
}

export type Group = GroupDB;
export type Friend = User; // Legacy alias

export type Tab = "matches" | "leaderboard" | "stats" | "tournament" | "admin" | "specials";

export interface AIPredictionResult {
  homeScore: number;
  awayScore: number;
  reasoning: string;
}
