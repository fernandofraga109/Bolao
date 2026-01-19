
import { Match, MatchStatus, Team, User, TournamentPredictions, Group } from './types';
import { TEAMS } from './data/teams';
import { STADIUMS } from './data/stadiums';
import { OFFICIAL_MATCHES } from './data/matches';
import { TOURNAMENT_GROUPS } from './data/groups';

// Import "Database" files
import { DB_USERS } from './data/users_groups/users';
import { DB_GROUPS } from './data/users_groups/groups';
import { DB_USER_GROUPS } from './data/users_groups/user_groups';
import { DB_PREDICTIONS } from './data/users_groups/predictions';
import { DB_TOURNAMENT_PREDICTIONS } from './data/users_groups/tournament_predictions';

// Re-export for compatibility
export { TEAMS, STADIUMS, OFFICIAL_MATCHES, TOURNAMENT_GROUPS };

// Legacy constant for initial state
export const INITIAL_MATCHES = OFFICIAL_MATCHES;

export const OFFICIAL_TOURNAMENT_RESULTS: TournamentPredictions | undefined = undefined; 

// Export Groups directly from DB file
export const INITIAL_GROUPS: Group[] = DB_GROUPS;

// Construct INITIAL_USERS by performing a "JOIN" between DB_USERS and DB_USER_GROUPS
export const INITIAL_USERS: User[] = DB_USERS.map(user => {
    // Find all group IDs for this user in the relation table
    const userGroupRelations = DB_USER_GROUPS.filter(rel => rel.userId === user.id);
    const groupIds = userGroupRelations.map(rel => rel.groupId);

    // Hydrate predictions
    const userPredictions = DB_PREDICTIONS.filter(p => p.userId === user.id);
    const predictionsMap: Record<string, { home: number; away: number }> = {};
    userPredictions.forEach(p => {
        predictionsMap[p.matchId] = { home: p.homeScore, away: p.awayScore };
    });

    // Hydrate tournament predictions
    const userTournPred = DB_TOURNAMENT_PREDICTIONS.find(tp => tp.userId === user.id);
    let tournamentPredictions: TournamentPredictions | undefined = undefined;

    if (userTournPred) {
        tournamentPredictions = {
            championTeamId: userTournPred.championTeamId,
            topScorer: (userTournPred.topScorerPlayer || userTournPred.topScorerGoals) ? {
                player: userTournPred.topScorerPlayer || '',
                goals: userTournPred.topScorerGoals || 0
            } : undefined,
            bestPlayer: userTournPred.bestPlayer,
            bestGoalkeeper: userTournPred.bestGoalkeeper
        };
    }

    return {
        ...user,
        groupIds: groupIds,
        // Ensure activeGroupId is valid (belongs to the user), otherwise default to first group or undefined
        activeGroupId: (user.activeGroupId && groupIds.includes(user.activeGroupId)) 
            ? user.activeGroupId 
            : (groupIds.length > 0 ? groupIds[0] : undefined),
        predictions: predictionsMap,
        tournamentPredictions
    };
});
