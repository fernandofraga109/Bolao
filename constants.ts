import { Match, MatchStatus, Team, User, TournamentPredictions, Group } from './types';

export const TEAMS: Record<string, Team> = {
  bra: { id: 'bra', name: 'Brasil', code: 'BRA', flag: 'https://flagcdn.com/w160/br.png', ranking: 1 },
  arg: { id: 'arg', name: 'Argentina', code: 'ARG', flag: 'https://flagcdn.com/w160/ar.png', ranking: 2 },
  fra: { id: 'fra', name: 'França', code: 'FRA', flag: 'https://flagcdn.com/w160/fr.png', ranking: 3 },
  eng: { id: 'eng', name: 'Inglaterra', code: 'ENG', flag: 'https://flagcdn.com/w160/gb-eng.png', ranking: 4 },
  esp: { id: 'esp', name: 'Espanha', code: 'ESP', flag: 'https://flagcdn.com/w160/es.png', ranking: 5 },
  por: { id: 'por', name: 'Portugal', code: 'POR', flag: 'https://flagcdn.com/w160/pt.png', ranking: 7 },
  ger: { id: 'ger', name: 'Alemanha', code: 'GER', flag: 'https://flagcdn.com/w160/de.png', ranking: 10 },
  usa: { id: 'usa', name: 'EUA', code: 'USA', flag: 'https://flagcdn.com/w160/us.png', ranking: 11 },
  mex: { id: 'mex', name: 'México', code: 'MEX', flag: 'https://flagcdn.com/w160/mx.png', ranking: 15 },
  jpn: { id: 'jpn', name: 'Japão', code: 'JPN', flag: 'https://flagcdn.com/w160/jp.png', ranking: 18 },
};

export const INITIAL_MATCHES: Match[] = [
  {
    id: 'm1',
    homeTeam: TEAMS.bra,
    awayTeam: TEAMS.mex,
    date: '2026-06-11T16:00:00',
    group: 'Grupo A',
    status: MatchStatus.FINISHED,
    result: { home: 3, away: 1 }
  },
  {
    id: 'm2',
    homeTeam: TEAMS.usa,
    awayTeam: TEAMS.eng,
    date: '2026-06-12T14:00:00',
    group: 'Grupo B',
    status: MatchStatus.SCHEDULED,
  },
  {
    id: 'm3',
    homeTeam: TEAMS.arg,
    awayTeam: TEAMS.por,
    date: '2026-06-12T20:00:00',
    group: 'Grupo C',
    status: MatchStatus.SCHEDULED,
  },
  {
    id: 'm4',
    homeTeam: TEAMS.fra,
    awayTeam: TEAMS.ger,
    date: '2026-06-13T18:00:00',
    group: 'Grupo D',
    status: MatchStatus.SCHEDULED,
  },
    {
    id: 'm5',
    homeTeam: TEAMS.esp,
    awayTeam: TEAMS.jpn,
    date: '2026-06-14T15:00:00',
    group: 'Grupo E',
    status: MatchStatus.SCHEDULED,
  }
];

export const OFFICIAL_TOURNAMENT_RESULTS: TournamentPredictions | undefined = undefined; 

export const INITIAL_GROUPS: Group[] = [
  {
    id: 'g1',
    name: 'Amigos da Firma',
    code: 'COPA26',
    adminId: 'f1',
    createdAt: '2025-01-01T10:00:00'
  },
  {
    id: 'g2',
    name: 'Família Silva',
    code: 'FAMILIA',
    adminId: 'me',
    createdAt: '2025-01-02T10:00:00'
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'me',
    name: 'Admin User',
    email: 'admin@gmail.com',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=10b981&color=fff',
    role: 'ADMIN',
    status: 'ACTIVE',
    groupIds: [], // User needs to select a group first
    activeGroupId: undefined,
    predictions: {},
    totalPoints: 0
  },
  {
    id: 'f1',
    name: 'Carlos Silva',
    email: 'carlos@gmail.com',
    avatar: 'https://picsum.photos/seed/carlos/50/50',
    role: 'USER',
    status: 'ACTIVE',
    groupIds: ['g1', 'g2'],
    activeGroupId: 'g1',
    predictions: {
      'm1': { home: 2, away: 1 },
      'm2': { home: 1, away: 1 },
      'm3': { home: 2, away: 0 },
      'm4': { home: 1, away: 2 },
    },
    tournamentPredictions: {
        topScorer: { player: 'Vinicius Jr', goals: 7 },
        championTeamId: 'bra',
        bestPlayer: 'Neymar',
        bestGoalkeeper: 'Alisson'
    },
    totalPoints: 0 
  },
  {
    id: 'f2',
    name: 'Ana Souza',
    email: 'ana@gmail.com',
    avatar: 'https://picsum.photos/seed/ana/50/50',
    role: 'USER',
    status: 'ACTIVE',
    groupIds: ['g1'],
    activeGroupId: 'g1',
    predictions: {
      'm1': { home: 3, away: 1 },
      'm2': { home: 0, away: 2 },
      'm3': { home: 1, away: 1 },
      'm4': { home: 3, away: 2 },
    },
    tournamentPredictions: {
        topScorer: { player: 'Mbappé', goals: 8 },
        championTeamId: 'fra',
        bestPlayer: 'Mbappé',
        bestGoalkeeper: 'Maignan'
    },
    totalPoints: 0
  },
  {
    id: 'f3',
    name: 'Pedro Rocha',
    email: 'pedro@gmail.com',
    avatar: 'https://picsum.photos/seed/pedro/50/50',
    role: 'USER',
    status: 'ACTIVE',
    groupIds: ['g1'],
    activeGroupId: 'g1',
    predictions: {
      'm1': { home: 0, away: 1 },
      'm2': { home: 1, away: 2 },
      'm3': { home: 2, away: 2 },
      'm4': { home: 0, away: 0 },
    },
    tournamentPredictions: {
        topScorer: { player: 'Kane', goals: 6 },
        championTeamId: 'eng',
        bestPlayer: 'Bellingham',
        bestGoalkeeper: 'Pickford'
    },
    totalPoints: 0
  }
];