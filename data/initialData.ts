
import { UserDB, GroupDB, UserGroupDB, MatchDB, TeamDB, StadiumDB, MatchStatus, TournamentPredictionDB, PredictionDB } from '../types';
import { TEAMS } from './teams';
import { STADIUMS } from './stadiums';
import { OFFICIAL_MATCHES } from './matches';

// Import Normalized Tables
import { DB_USERS } from './users_groups/users';
import { DB_GROUPS } from './users_groups/groups';
import { DB_USER_GROUPS } from './users_groups/user_groups';
import { DB_PREDICTIONS } from './users_groups/predictions';
import { DB_TOURNAMENT_PREDICTIONS } from './users_groups/tournament_predictions';

// --- ADAPTERS TO CONVERT CONSTANTS TO DB FORMAT ---

const teamsList: TeamDB[] = Object.values(TEAMS);
const stadiumsList: StadiumDB[] = Object.values(STADIUMS);

const matchesList: MatchDB[] = OFFICIAL_MATCHES.map(m => ({
    id: m.id,
    homeTeamId: m.homeTeam.id,
    awayTeamId: m.awayTeam.id,
    date: m.date,
    group: m.group,
    competitionCode: 'WC',
    stadiumId: m.stadiumId || 'unknown',
    status: m.status,
    resultHome: m.result?.home,
    resultAway: m.result?.away
}));

// The master object representing the "JSON Files" / Database Seed
export const INITIAL_DB = {
    users: DB_USERS,
    groups: DB_GROUPS,
    userGroups: DB_USER_GROUPS,
    teams: teamsList,
    stadiums: stadiumsList,
    matches: matchesList,
    predictions: DB_PREDICTIONS,
    tournamentPredictions: DB_TOURNAMENT_PREDICTIONS
};
