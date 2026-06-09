import { Friend } from '../types';

/**
 * Sorts users by totalPoints descending and assigns dense ranks
 * (ties share the same rank number).
 */
export const rankUsers = <T extends { totalPoints: number }>(
  users: T[],
): (T & { rank: number })[] => {
  const sorted = [...users].sort((a, b) => b.totalPoints - a.totalPoints);
  let currentRank = 0;
  let lastPoints = -1;

  return sorted.map((user, index) => {
    if (user.totalPoints !== lastPoints) {
      currentRank = index + 1;
      lastPoints = user.totalPoints;
    }
    return { ...user, rank: currentRank };
  });
};

export type RankedFriend = Friend & { rank: number };

export interface RankedLeaderboardSection {
  groupId: string;
  groupName: string;
  competitionCode?: string;
  users: RankedFriend[];
}

/**
 * Applies dense-ranking to each section's user list.
 */
export const rankLeaderboardSections = (
  sections: { groupId: string; groupName: string; competitionCode?: string; users: Friend[] }[],
): RankedLeaderboardSection[] =>
  sections.map((section) => ({
    ...section,
    users: rankUsers(section.users),
  }));
