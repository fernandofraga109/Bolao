export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  FINISHED = 'FINISHED'
}

export interface Team {
  id: string;
  name: string;
  code: string;
  flag: string; // Emoji or URL
}

export interface Score {
  home: number | '';
  away: number | '';
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  date: string;
  group: string;
  status: MatchStatus;
  result?: { home: number; away: number }; // The actual result (for finished games)
}

export interface Prediction {
  matchId: string;
  homeScore: number;
  awayScore: number;
  points?: number; // Calculated points
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

export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INVITED';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  groupIds: string[]; // List of all groups the user belongs to
  activeGroupId?: string; // The group context currently being viewed
  predictions: Record<string, { home: number; away: number }>; // map matchId to score
  tournamentPredictions?: TournamentPredictions;
  totalPoints: number;
}

export interface Group {
  id: string;
  name: string;
  code: string; // The unique code to join
  adminId: string; // Creator of the group
  createdAt: string;
}

// Alias Friend to User for backward compatibility if needed, 
// though we will migrate to using User everywhere.
export type Friend = User;

export type Tab = 'matches' | 'leaderboard' | 'admin';

export interface AIPredictionResult {
  homeScore: number;
  awayScore: number;
  reasoning: string;
}