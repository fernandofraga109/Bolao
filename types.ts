export enum MatchStatus {
  SCHEDULED = "SCHEDULED",
  LIVE = "LIVE",
  FINISHED = "FINISHED",
}

// --- DATABASE SCHEMAS (Normalized Data) ---

export interface SystemConfigDB {
  id: string; // UUID singleton
  is_auto_sync_enabled: boolean;
  sync_interval_ms: number;
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

export interface MatchDB {
  id: string;
  externalMatchId?: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  group: string; // "Grupo A", "Oitavas", etc.
  stadiumId?: string | null;
  status: MatchStatus;
  resultHome?: number;
  resultAway?: number;
}

export interface PredictionDB {
  userId: string;
  groupId?: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  timestamp: string;
}

export interface TournamentPredictionDB {
  userId: string;
  championTeamId?: string;
  topScorerPlayer?: string;
  topScorerGoals?: number;
  bestPlayer?: string;
  bestGoalkeeper?: string;
}

export interface UserDB {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar: string;
  role: "ADMIN" | "USER";
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
}

export interface UserGroupDB {
  userId: string;
  groupId: string;
  joinedAt: string;
  role?: "MEMBER" | "ADMIN";
  points?: number;
}

// --- UI MODELS (Hydrated Data for Components) ---

// Alias Team to TeamDB for UI simplicity as they are mostly same
export type Team = TeamDB;
export type Stadium = StadiumDB;
export type UserRole = UserDB["role"];
export type UserStatus = UserDB["status"];
export type SystemConfig = SystemConfigDB;

export interface Prediction {
  matchId: string;
  homeScore: number;
  awayScore: number;
  points?: number;
}

export interface TournamentPredictions {
  championTeamId?: string;
  topScorer?: {
    player: string;
    goals: number;
  };
  bestPlayer?: string;
  bestGoalkeeper?: string;
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
  predictions: Record<string, { home: number; away: number }>; // matchId -> score
  tournamentPredictions?: TournamentPredictions;
  totalPoints: number;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  group: string;
  location: string;
  stadiumId?: string;
  status: MatchStatus;
  result?: { home: number; away: number };
}

export type Group = GroupDB;
export type Friend = User; // Legacy alias

export type Tab = "matches" | "leaderboard" | "tournament" | "admin";

export interface AIPredictionResult {
  homeScore: number;
  awayScore: number;
  reasoning: string;
}
