import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import {
  UserDB,
  UserRole,
  GroupDB,
  UserGroupDB,
  MatchDB,
  Team,
  TeamDB,
  StadiumDB,
  PredictionDB,
  TournamentPredictionDB,
  ExtraPhasePredictionDB,
  SystemConfigDB,
  CompetitionDB,
  TeamStandingsDB,
  PlayerWithContextDB,
  PlayerDB,
} from "../types";
import { usePlayerSync } from "../hooks/usePlayerSync";
import { INITIAL_DB } from "../data/initialData";
import { supabase, isSupabaseEnabled, SUPABASE_SCHEMA } from "../services/supabase";
import { maskValue, unmaskValue } from "../utils/storageMask";

const SYSTEM_CONFIG_ID = "00000000-0000-0000-0000-000000000001";

type UserRoleRow = {
  userId: string;
  displayName: string;
  email?: string;
  avatar?: string | null;
  role: UserDB["role"];
  createdAt?: string | null;
};

type ProfileRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  status?: UserDB["status"] | null;
  activeGroupId?: string | null;
  totalPoints?: number | null;
};

type LegacyUserRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  role?: UserDB["role"] | null;
  status?: UserDB["status"] | null;
  activeGroupId?: string | null;
  totalPoints?: number | null;
};

const mapUserRoleToUser = (row: UserRoleRow): UserDB => ({
  id: row.userId,
  name: row.displayName,
  email: row.email || "",
  avatar: row.avatar ?? "",
  role: row.role,
  status: "ACTIVE",
  activeGroupId: undefined,
  totalPoints: 0,
  createdAt: row.createdAt ?? undefined,
});

const mapProfileToUser = (row: ProfileRow): UserDB => ({
  id: row.id,
  name: row.name || "Usuário",
  email: row.email || "",
  avatar: row.avatar ?? "",
  role: "USER",
  status: row.status || "ACTIVE",
  activeGroupId: row.activeGroupId || undefined,
  totalPoints: row.totalPoints || 0,
});

const mapLegacyUserToUser = (row: LegacyUserRow): UserDB => ({
  id: row.id,
  name: row.name || "Usuário",
  email: row.email || "",
  avatar: row.avatar ?? "",
  role: row.role || "USER",
  status: row.status || "ACTIVE",
  activeGroupId: row.activeGroupId || undefined,
  totalPoints: row.totalPoints || 0,
});

interface DatabaseContextType {
  // Tables
  competitions: CompetitionDB[];
  users: UserDB[];
  groups: GroupDB[];
  userGroups: UserGroupDB[];
  teams: TeamDB[];
  stadiums: StadiumDB[];
  matches: MatchDB[];
  predictions: PredictionDB[];
  tournamentPredictions: TournamentPredictionDB[];
  extraPhasePredictions: ExtraPhasePredictionDB[];
  teamStandings: TeamStandingsDB[];
  systemConfig: SystemConfigDB;

  // Actions (CRUD)
  addUser: (user: UserDB) => Promise<void>;
  updateUser: (id: string, data: Partial<UserDB>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  addGroup: (group: GroupDB) => Promise<void>;
  updateGroup: (id: string, data: Partial<GroupDB>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  addUserToGroup: (relation: UserGroupDB) => Promise<void>;
  removeUserFromGroup: (userId: string, groupId: string) => Promise<void>;

  upsertCompetitions: (competitionsList: CompetitionDB[]) => Promise<void>;
  updateCompetitionSync: (code: string, timestamp: string) => Promise<void>;
  updateCompetitionLiveDetailsSync: (code: string, timestamp: string) => Promise<void>;
  updateCompetitionAutoSync: (code: string, enabled: boolean) => Promise<void>;
  acquireSyncLock: (code: string) => Promise<boolean>;
  releaseSyncLock: (code: string) => Promise<void>;
  updateCompetitionAwards: (code: string, awards: { 
    championTeamId?: string | null;
    topScorerName?: string | null;
    topScorerGoals?: number | null;
    topScorerPlayerIds?: string[] | null;
    bestPlayerName?: string | null;
    bestGoalkeeperName?: string | null;
    mostGoalsTeamId?: string | null;
    mostConcededTeamId?: string | null;
    mostGoalsTeamIds?: string[] | null;
    mostConcededTeamIds?: string[] | null;
    groupClassifications?: Record<string, string[]> | null;
    knockoutClassifications?: Record<string, string[]> | null;
    /** @deprecated usar biggestGoalDiffMatchIds */
    biggestGoalDiffMatches?: Record<string, string> | null;
    biggestGoalDiffMatchIds?: Record<string, string[]> | null;
  }) => Promise<void>;
  upsertTeam: (team: Team) => Promise<TeamDB>;
  upsertMatch: (match: MatchDB) => Promise<void>;
  updateMatch: (id: string, data: Partial<MatchDB>) => Promise<void>;

  upsertPrediction: (pred: PredictionDB | PredictionDB[]) => Promise<void>;
  upsertTournamentPrediction: (pred: TournamentPredictionDB) => Promise<void>;
  upsertExtraPhasePrediction: (pred: ExtraPhasePredictionDB) => Promise<void>;

  updateSystemConfig: (data: Partial<SystemConfigDB>) => Promise<void>;
  updateLocalUserGroups: (updates: UserGroupDB[]) => void;
  refetchMatches: () => Promise<void>;
  refetchTeamStandings: () => Promise<void>;
  refetchPredictions: () => Promise<void>;
  refetchUserGroups: () => Promise<void>;
  refetchSystemConfig: () => Promise<void>;
  players: PlayerWithContextDB[];
  isSyncingPlayers: boolean;
  syncSquads: (competitionCodes: string[]) => Promise<{ synced: number; errors: string[] }>;
  syncScorers: (competitionCodes: string[]) => Promise<{ synced: number; errors: string[] }>;
  searchPlayers: (query: string, competitionCode?: string) => Promise<PlayerWithContextDB[]>;
  getTopScorers: (competitionCode: string, limit?: number) => Promise<PlayerWithContextDB[]>;
  getPlayersByIds: (ids: string[]) => Promise<PlayerDB[]>;
  isInitialFetchComplete: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
);

// Default config if DB is not ready
const DEFAULT_CONFIG: SystemConfigDB = {
  id: SYSTEM_CONFIG_ID,
  is_auto_sync_enabled: false,
  sync_interval_ms: 20000,
  live_details_interval_ms: 300000,
  underdog_min_rank_diff: 0,
  live_animations_enabled: { goal: true, yellow: true, red: true },
};

const mergeMatchIntoList = (list: MatchDB[], incoming: MatchDB): MatchDB[] => {
  const idx = list.findIndex(
    (m) =>
      m.id === incoming.id ||
      (!!incoming.externalMatchId &&
        m.externalMatchId === incoming.externalMatchId),
  );

  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  }

  return [...list, incoming];
};

const mergeUserIntoList = (list: UserDB[], incoming: UserDB): UserDB[] => {
  const idx = list.findIndex((u) => u.id === incoming.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  }
  return [...list, incoming];
};

const mergeGroupIntoList = (list: GroupDB[], incoming: GroupDB): GroupDB[] => {
  const idx = list.findIndex((g) => g.id === incoming.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  }
  return [...list, incoming];
};

const mapCompetitionRow = (row: any): CompetitionDB => ({
  code: row.code,
  name: row.name,
  emblem: row.emblem || undefined,
  type: row.type || undefined,
  lastSync:
    row.last_sync ||
    row.lastSync ||
    row.last_updated ||
    row.lastUpdated ||
    undefined,
  autoSyncEnabled:
    row.autoSyncEnabled !== undefined
      ? row.autoSyncEnabled
      : row.auto_sync_enabled !== undefined
        ? row.auto_sync_enabled
        : true,
  topScorerName: row.topScorerName || undefined,
  topScorerGoals: row.topScorerGoals || undefined,
  topScorerPlayerIds: row.topScorerPlayerIds || undefined,
  championTeamId: row.championTeamId || undefined,
  bestPlayerName: row.bestPlayerName || undefined,
  bestGoalkeeperName: row.bestGoalkeeperName || undefined,
  mostGoalsTeamId: row.mostGoalsTeamId || undefined,
  mostConcededTeamId: row.mostConcededTeamId || undefined,
  mostGoalsTeamIds: row.mostGoalsTeamIds || undefined,
  mostConcededTeamIds: row.mostConcededTeamIds || undefined,
  groupClassifications: row.groupClassifications || undefined,
  knockoutClassifications: row.knockoutClassifications || undefined,
  biggestGoalDiffMatches: row.biggestGoalDiffMatches || undefined,
  biggestGoalDiffMatchIds: row.biggestGoalDiffMatchIds || undefined,
  liveDetailsLastSync:
    row.liveDetailsLastSync || row.live_details_last_sync || undefined,
});

const mergeCompetitionIntoList = (
  list: CompetitionDB[],
  incoming: CompetitionDB,
): CompetitionDB[] => {
  const idx = list.findIndex((c) => c.code === incoming.code);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  }
  return [...list, incoming];
};

const mergeUserGroupIntoList = (
  list: UserGroupDB[],
  incoming: UserGroupDB,
): UserGroupDB[] => {
  const idx = list.findIndex(
    (ug) => ug.userId === incoming.userId && ug.groupId === incoming.groupId,
  );
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  }
  return [...list, incoming];
};

const predictionIdentityKey = (pred: PredictionDB): string =>
  `${pred.userId}:${pred.groupId || ""}:${pred.matchId}`;

// Função de paginação para buscar todos os registros (Supabase limita a 1000 por query)
const fetchAllRecords = async <T,>(
  tableName: string,
): Promise<T[]> => {
  const PAGE_SIZE = 1000;
  let allRecords: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(from, to);

    if (error) {
      console.error(`❌ [${tableName}] erro na paginação:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allRecords = [...allRecords, ...data];
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ [${tableName}] carregada via paginação, total de registros:`, allRecords.length);
  return allRecords;
};

export const DatabaseProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // --- State Initialization ---
  // Safe loader to prevent app crash if LocalStorage is corrupted
  const loadTable = <T,>(key: string, seed: T[]): T[] => {
    try {
      const saved = localStorage.getItem(`bolao_db_${key}`);
      if (!saved) return seed;
      const unmasked = unmaskValue(saved);
      return JSON.parse(unmasked) as T[];
    } catch (e) {
      console.error(
        `Erro ao carregar ${key} do cache local. Usando dados padrão.`,
        e,
      );
      localStorage.removeItem(`bolao_db_${key}`);
      return seed;
    }
  };

  const [competitions, setCompetitions] = useState<CompetitionDB[]>(() =>
    loadTable("competitions", []),
  );
  const [users, setUsers] = useState<UserDB[]>(() =>
    loadTable("users", INITIAL_DB.users),
  );
  const [groups, setGroups] = useState<GroupDB[]>(() =>
    loadTable("groups", INITIAL_DB.groups),
  );
  const [userGroups, setUserGroups] = useState<UserGroupDB[]>(() =>
    loadTable("userGroups", INITIAL_DB.userGroups),
  );

  // Static data usually doesn't change, but we allow fetching updates
  const [teams, setTeams] = useState<TeamDB[]>(() => {
    const loaded = loadTable("teams", INITIAL_DB.teams);
    const flagProvider = import.meta.env.VITE_FLAG_PROVIDER;
    
    // Fix broken flag URLs from crests.football-data.org on initial load from cache
    // Only if using flagcdn provider
    if (flagProvider === 'flagcdn') {
      return loaded.map((t: TeamDB) => {
        if (t.flag && t.flag.includes("crests.football-data.org")) {
          const codeToCountry: Record<string, string> = {
            'USA': 'us', 'MEX': 'mx', 'CAN': 'ca', 'ESP': 'es', 'ARG': 'ar',
            'FRA': 'fr', 'ENG': 'gb-eng', 'BRA': 'br', 'POR': 'pt', 'NED': 'nl',
            'BEL': 'be', 'GER': 'de', 'CRO': 'hr', 'MAR': 'ma', 'COL': 'co',
            'URU': 'uy', 'SUI': 'ch', 'JPN': 'jp', 'SEN': 'sn', 'IRN': 'ir',
            'KOR': 'kr', 'ECU': 'ec', 'AUT': 'at', 'AUS': 'au', 'NOR': 'no',
            'PAN': 'pa', 'EGY': 'eg', 'ALG': 'dz', 'SCO': 'gb-sct', 'PAR': 'py',
            'TUN': 'tn', 'CIV': 'ci', 'UZB': 'uz', 'QAT': 'qa', 'KSA': 'sa',
            'RSA': 'za', 'JOR': 'jo', 'CPV': 'cv', 'GHA': 'gh', 'CUW': 'cw',
            'HAI': 'ht', 'NZL': 'nz', 'CZE': 'cz', 'ITA': 'it', 'DEN': 'dk',
            'SWE': 'se', 'POL': 'pl', 'WAL': 'gb-wls', 'SRB': 'rs', 'CMR': 'cm',
            'NGA': 'ng', 'IRQ': 'iq',
          };
          const cc = codeToCountry[(t.code || '').toUpperCase()];
          if (cc) return { ...t, flag: `https://flagcdn.com/w160/${cc}.png` };
        }
        return t;
      });
    }
    return loaded;
  });
  const [stadiums, setStadiums] = useState<StadiumDB[]>(() =>
    loadTable("stadiums", INITIAL_DB.stadiums),
  );

  // Dynamic data
  const [matches, setMatches] = useState<MatchDB[]>(() =>
    loadTable("matches", INITIAL_DB.matches),
  );
  const [predictions, setPredictions] = useState<PredictionDB[]>(() =>
    loadTable("predictions", INITIAL_DB.predictions),
  );
  const [tournamentPredictions, setTournamentPredictions] = useState<
    TournamentPredictionDB[]
  >(() => loadTable("tournamentPredictions", INITIAL_DB.tournamentPredictions));
  const [extraPhasePredictions, setExtraPhasePredictions] = useState<
    ExtraPhasePredictionDB[]
  >(() => loadTable("extraPhasePredictions", []));
  const [teamStandings, setTeamStandings] = useState<TeamStandingsDB[]>(() =>
    loadTable("teamStandings", []),
  );

  // System Config
  const [systemConfig, setSystemConfig] =
    useState<SystemConfigDB>(DEFAULT_CONFIG);

  // Initial fetch state to prevent showing stale data during sync
  const [isInitialFetchComplete, setIsInitialFetchComplete] = useState(false);

  const {
    players,
    isSyncingPlayers,
    syncSquads,
    syncScorers,
    searchPlayers,
    getTopScorers,
    getPlayersByIds,
  } = usePlayerSync();

  // --- Supabase Realtime & Sync Effect ---
  useEffect(() => {
    if (!isSupabaseEnabled() || !supabase) {
      setIsInitialFetchComplete(true);
      return;
    }

    let isMounted = true;

    // Safety net: se o fetch travar (sem internet, timeout), desbloqueia após 10s
    const fetchFallbackTimer = setTimeout(() => {
      if (isMounted && !isInitialFetchComplete) {
        console.warn("[db] fetch fallback timeout — forçando isInitialFetchComplete");
        setIsInitialFetchComplete(true);
      }
    }, 10000);

    // 1. Initial Fetch
    const fetchData = async () => {
      console.log("🔄 Sincronizando dados com o Supabase...");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const isAuthenticated = !!session?.user;

      const [
        rolesRes,
        teamsRes,
        stadiumsRes,
        groupsRes,
        userGroupsRes,
        matchesRes,
        predsData,
        tournPredsData,
        configRes,
        competitionsRes,
        teamStandingsRes,
        extraPhasePredsData,
      ] = await Promise.all([
        isAuthenticated
          ? supabase.from("user_roles").select("*")
          : Promise.resolve({ data: null, error: null } as any),
        supabase.from("teams").select("*"),
        supabase.from("stadiums").select("*"),
        isAuthenticated
          ? supabase.from("groups").select("*")
          : Promise.resolve({ data: null, error: null } as any),
        isAuthenticated
          ? supabase.from("user_groups").select("*")
          : Promise.resolve({ data: null, error: null } as any),
        fetchAllRecords<MatchDB>("matches"),
        isAuthenticated
          ? fetchAllRecords<PredictionDB>("predictions")
          : Promise.resolve(null),
        isAuthenticated
          ? fetchAllRecords<TournamentPredictionDB>("tournament_predictions")
          : Promise.resolve(null),
        supabase.from("system_config").select("*").single(),
        supabase.from("competitions").select("*"),
        supabase.from("team_standings").select("*"),
        isAuthenticated
          ? fetchAllRecords<ExtraPhasePredictionDB>("extra_phase_predictions")
          : Promise.resolve(null),
      ]);

      // Converter dados de paginação para o formato esperado
      const predsRes = { data: predsData, error: null };
      const tournPredsRes = { data: tournPredsData, error: null };
      const extraPhasePredsRes = { data: extraPhasePredsData, error: null };
      
      console.log("🔍 [Supabase Debug] Status das Tabelas no schema", SUPABASE_SCHEMA);
      if (rolesRes.error) console.error("❌ [user_roles] erro:", rolesRes.error);
      else console.log("✅ [user_roles] carregada, total de registros:", rolesRes.data?.length);
      if (teamsRes.error) console.error("❌ [teams] erro:", teamsRes.error);
      else console.log("✅ [teams] carregada, total de registros:", teamsRes.data?.length);
      if (stadiumsRes.error) console.error("❌ [stadiums] erro:", stadiumsRes.error);
      else console.log("✅ [stadiums] carregada, total de registros:", stadiumsRes.data?.length);
      if (groupsRes.error) console.error("❌ [groups] erro:", groupsRes.error);
      else console.log("✅ [groups] carregada, total de registros:", groupsRes.data?.length);
      if (userGroupsRes.error) console.error("❌ [user_groups] erro:", userGroupsRes.error);
      else console.log("✅ [user_groups] carregada, total de registros:", userGroupsRes.data?.length);
      if (matchesRes.error) console.error("❌ [matches] erro:", matchesRes.error);
      else console.log("✅ [matches] carregada, total de registros:", matchesRes.data?.length);
      if (predsRes.error) console.error("❌ [predictions] erro:", predsRes.error);
      else console.log("✅ [predictions] carregada, total de registros:", predsRes.data?.length);
      if (tournPredsRes.error) console.error("❌ [tournament_predictions] erro:", tournPredsRes.error);
      else console.log("✅ [tournament_predictions] carregada, total de registros:", tournPredsRes.data?.length);
      if (configRes.error) console.error("❌ [system_config] erro:", configRes.error);
      else console.log("✅ [system_config] carregada:", configRes.data);
      if (competitionsRes.error) console.error("❌ [competitions] erro:", competitionsRes.error);
      else console.log("✅ [competitions] carregada, total de registros:", competitionsRes.data?.length);
      if (teamStandingsRes.error) console.error("❌ [team_standings] erro:", teamStandingsRes.error);
      else console.log("✅ [team_standings] carregada, total de registros:", teamStandingsRes.data?.length);
      if (extraPhasePredsRes.error) console.error("❌ [extra_phase_predictions] erro:", extraPhasePredsRes.error);
      else console.log("✅ [extra_phase_predictions] carregada, total de registros:", extraPhasePredsRes.data?.length);

      if (!isMounted) return;

      const usersById = new Map<string, UserDB>();

      if (Array.isArray(rolesRes.data)) {
        (rolesRes.data as UserRoleRow[]).forEach((row) => {
          usersById.set(row.userId, mapUserRoleToUser(row));
        });
      }

      if (usersById.size > 0) {
        setUsers(Array.from(usersById.values()));
      }
      if (teamsRes.data) {
        const flagProvider = import.meta.env.VITE_FLAG_PROVIDER;
        
        // Fix broken flag URLs from crests.football-data.org by replacing with flagcdn.com
        // Only if using flagcdn provider
        if (flagProvider === 'flagcdn') {
          const fixedTeams = (teamsRes.data as TeamDB[]).map((t) => {
            if (t.flag && t.flag.includes("crests.football-data.org")) {
              const codeToCountry: Record<string, string> = {
                'USA': 'us', 'MEX': 'mx', 'CAN': 'ca', 'ESP': 'es', 'ARG': 'ar',
                'FRA': 'fr', 'ENG': 'gb-eng', 'BRA': 'br', 'POR': 'pt', 'NED': 'nl',
                'BEL': 'be', 'GER': 'de', 'CRO': 'hr', 'MAR': 'ma', 'COL': 'co',
                'URU': 'uy', 'SUI': 'ch', 'JPN': 'jp', 'SEN': 'sn', 'IRN': 'ir',
                'KOR': 'kr', 'ECU': 'ec', 'AUT': 'at', 'AUS': 'au', 'NOR': 'no',
                'PAN': 'pa', 'EGY': 'eg', 'ALG': 'dz', 'SCO': 'gb-sct', 'PAR': 'py',
                'TUN': 'tn', 'CIV': 'ci', 'UZB': 'uz', 'QAT': 'qa', 'KSA': 'sa',
                'RSA': 'za', 'JOR': 'jo', 'CPV': 'cv', 'GHA': 'gh', 'CUW': 'cw',
                'HAI': 'ht', 'NZL': 'nz', 'CZE': 'cz', 'ITA': 'it', 'DEN': 'dk',
                'SWE': 'se', 'POL': 'pl', 'WAL': 'gb-wls', 'SRB': 'rs', 'CMR': 'cm',
                'NGA': 'ng', 'IRQ': 'iq',
              };
              const cc = codeToCountry[(t.code || '').toUpperCase()];
              if (cc) {
                return { ...t, flag: `https://flagcdn.com/w160/${cc}.png` };
              }
            }
            return t;
          });
          setTeams(fixedTeams);
        } else {
          setTeams(teamsRes.data);
        }
      }
      if (stadiumsRes.data) setStadiums(stadiumsRes.data);
      if (groupsRes.data) {
        const deduped = (groupsRes.data as GroupDB[]).reduce(
          (acc, item) => mergeGroupIntoList(acc, item),
          [] as GroupDB[],
        );
        setGroups(deduped);
      }
      if (userGroupsRes.data) {
        const deduped = (userGroupsRes.data as UserGroupDB[]).reduce(
          (acc, item) => mergeUserGroupIntoList(acc, item),
          [] as UserGroupDB[],
        );
        setUserGroups(deduped);
      }
      if (matchesRes.data) {
        const deduped = (matchesRes.data as MatchDB[]).reduce(
          (acc, item) => mergeMatchIntoList(acc, item),
          [] as MatchDB[],
        );
        setMatches(deduped);
      }
      if (predsRes.data) setPredictions(predsRes.data);
      if (tournPredsRes.data) setTournamentPredictions(tournPredsRes.data);
      if (extraPhasePredsRes.data) setExtraPhasePredictions(extraPhasePredsRes.data);
      if (configRes.data) setSystemConfig(configRes.data);
      if (competitionsRes.data) {
        const mapped = (competitionsRes.data as any[]).map(mapCompetitionRow);
        setCompetitions(mapped);
      }
      if (teamStandingsRes.data) setTeamStandings(teamStandingsRes.data);

      if (!isAuthenticated) {
        setUsers([]);
        setGroups([]);
        setUserGroups([]);
        setPredictions([]);
        setTournamentPredictions([]);
        setExtraPhasePredictions([]);
      }

      // Quando autenticado e Supabase responde, descartar cache local para
      // impedir que manipulacoes no localStorage burlem o app.
      if (isAuthenticated && isSupabaseEnabled()) {
        const keys = [
          "bolao_db_users",
          "bolao_db_groups",
          "bolao_db_userGroups",
          "bolao_db_matches",
          "bolao_db_predictions",
          "bolao_db_tournamentPredictions",
          "bolao_db_extraPhasePredictions",
        ];
        keys.forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {
            /* ignorar erros de localStorage */
          }
        });
      }

      if (isMounted) {
        setIsInitialFetchComplete(true);
      }
    };

    fetchData();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void fetchData();
    });

    // 2. Realtime Subscriptions Handler
    const handleRealtimeEvent = (payload: any) => {
      const { table: rawTable, eventType, new: newRecord, old: oldRecord } = payload;
      const prefix = import.meta.env.VITE_DB_TABLE_PREFIX || "";
      const table = prefix && rawTable.startsWith(prefix)
        ? rawTable.slice(prefix.length)
        : rawTable;

      if (eventType !== "UPDATE") {
        console.log(`⚡ Realtime Event: ${eventType} on ${table} (raw: ${rawTable})`, payload);
      }

      switch (table) {
        // --- SYSTEM CONFIG ---
        case "system_config":
          if (eventType === "UPDATE" || eventType === "INSERT") {
            console.log("⚡ Config atualizada via Realtime:", newRecord);
            setSystemConfig(newRecord);
          }
          break;

        // --- MATCHES ---
        case "matches":
          if (eventType === "UPDATE") {
            setMatches((prev) =>
              prev.map((m) =>
                m.id === newRecord.id ? { ...m, ...newRecord } : m,
              ),
            );
          } else if (eventType === "INSERT") {
            setMatches((prev) =>
              mergeMatchIntoList(prev, newRecord as MatchDB),
            );
          }
          break;

        // --- PREDICTIONS ---
        case "predictions":
          if (eventType === "INSERT" || eventType === "UPDATE") {
            setPredictions((prev) => {
              const idx = prev.findIndex(
                (p) =>
                  predictionIdentityKey(p) ===
                  predictionIdentityKey(newRecord as PredictionDB),
              );
              if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...newRecord };
                return newArr;
              }
              return [...prev, newRecord];
            });
          } else if (eventType === "DELETE") {
            if (oldRecord.userId && oldRecord.matchId) {
              const oldKey = predictionIdentityKey(oldRecord as PredictionDB);
              setPredictions((prev) =>
                prev.filter((p) => predictionIdentityKey(p) !== oldKey),
              );
            }
          }
          break;

        // --- TOURNAMENT PREDICTIONS ---
        case "tournament_predictions":
          if (eventType === "INSERT" || eventType === "UPDATE") {
            setTournamentPredictions((prev) => {
              const idx = prev.findIndex(
                (p) =>
                  p.userId === newRecord.userId &&
                  p.groupId === newRecord.groupId,
              );
              if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...newRecord };
                return newArr;
              }
              return [...prev, newRecord];
            });
          } else if (eventType === "DELETE") {
            setTournamentPredictions((prev) =>
              prev.filter(
                (p) =>
                  !(
                    p.userId === oldRecord.userId &&
                    p.groupId === oldRecord.groupId
                  ),
              ),
            );
          }
          break;

        // --- EXTRA PHASE PREDICTIONS ---
        case "extra_phase_predictions":
          if (eventType === "INSERT" || eventType === "UPDATE") {
            setExtraPhasePredictions((prev) => {
              const idx = prev.findIndex(
                (p) =>
                  p.userId === newRecord.userId &&
                  p.groupId === newRecord.groupId &&
                  p.phase === newRecord.phase,
              );
              if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...newRecord };
                return newArr;
              }
              return [...prev, newRecord];
            });
          } else if (eventType === "DELETE") {
            setExtraPhasePredictions((prev) =>
              prev.filter(
                (p) =>
                  !(
                    p.userId === oldRecord.userId &&
                    p.groupId === oldRecord.groupId &&
                    p.phase === oldRecord.phase
                  ),
              ),
            );
          }
          break;

        // --- USERS (user_roles) ---
        case "user_roles":
          if (eventType === "INSERT") {
            setUsers((prev) =>
              mergeUserIntoList(
                prev,
                mapUserRoleToUser(newRecord as UserRoleRow),
              ),
            );
          } else if (eventType === "UPDATE") {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === newRecord.userId
                  ? { ...u, ...mapUserRoleToUser(newRecord as UserRoleRow) }
                  : u,
              ),
            );
          } else if (eventType === "DELETE") {
            const deletedId = oldRecord.userId;
            setUsers((prev) => prev.filter((u) => u.id !== deletedId));
            setPredictions((prev) =>
              prev.filter((p) => p.userId !== deletedId),
            );
            setTournamentPredictions((prev) =>
              prev.filter((tp) => tp.userId !== deletedId),
            );
            setUserGroups((prev) =>
              prev.filter((ug) => ug.userId !== deletedId),
            );
          }
          break;

        // --- GROUPS ---
        case "groups":
          if (eventType === "INSERT") {
            setGroups((prev) => mergeGroupIntoList(prev, newRecord as GroupDB));
          } else if (eventType === "UPDATE") {
            setGroups((prev) =>
              prev.map((g) =>
                g.id === newRecord.id ? { ...g, ...newRecord } : g,
              ),
            );
          } else if (eventType === "DELETE") {
            const deletedId = oldRecord.id;
            setGroups((prev) => prev.filter((g) => g.id !== deletedId));
            setUserGroups((prev) =>
              prev.filter((ug) => ug.groupId !== deletedId),
            );
          }
          break;

        // --- COMPETITIONS ---
        case "competitions":
          if (eventType === "INSERT" || eventType === "UPDATE") {
            setCompetitions((prev) =>
              mergeCompetitionIntoList(prev, mapCompetitionRow(newRecord)),
            );
          } else if (eventType === "DELETE") {
            const deletedCode = oldRecord.code;
            setCompetitions((prev) =>
              prev.filter((c) => c.code !== deletedCode),
            );
          }
          break;

        // --- USER_GROUPS ---
        case "user_groups":
          if (eventType === "INSERT" || eventType === "UPDATE") {
            setUserGroups((prev) =>
              mergeUserGroupIntoList(prev, newRecord as UserGroupDB),
            );
          } else if (eventType === "DELETE") {
            if (oldRecord.userId && oldRecord.groupId) {
              setUserGroups((prev) =>
                prev.filter(
                  (ug) =>
                    !(
                      ug.userId === oldRecord.userId &&
                      ug.groupId === oldRecord.groupId
                    ),
                ),
              );
            }
          }
          break;
        // --- TEAM STANDINGS ---
        case "team_standings":
          if (eventType === "INSERT" || eventType === "UPDATE") {
            setTeamStandings((prev) => {
              const idx = prev.findIndex(
                (ts) =>
                  ts.teamId === newRecord.teamId &&
                  ts.competitionCode === newRecord.competitionCode,
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...newRecord };
                return next;
              }
              return [...prev, newRecord];
            });
          }
          break;

        default:
          break;
      }
    };

    const prefix = import.meta.env.VITE_DB_TABLE_PREFIX || "";
    const channel = supabase
      .channel("db-realtime-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}matches` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}predictions` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}tournament_predictions` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}extra_phase_predictions` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}user_roles` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}groups` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}user_groups` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}system_config` },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table: `${prefix}competitions` },
        handleRealtimeEvent,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.log("✅ Conectado ao Realtime do Banco de Dados");
      });

    return () => {
      isMounted = false;
      clearTimeout(fetchFallbackTimer);
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // --- Persistence Effects (LocalStorage Fallback) ---
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_competitions",
        maskValue(JSON.stringify(competitions)),
      ),
    [competitions],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_users",
        maskValue(JSON.stringify(users)),
      ),
    [users],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_groups",
        maskValue(JSON.stringify(groups)),
      ),
    [groups],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_userGroups",
        maskValue(JSON.stringify(userGroups)),
      ),
    [userGroups],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_matches",
        maskValue(JSON.stringify(matches)),
      ),
    [matches],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_predictions",
        maskValue(JSON.stringify(predictions)),
      ),
    [predictions],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_tournamentPredictions",
        maskValue(JSON.stringify(tournamentPredictions)),
      ),
    [tournamentPredictions],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_extraPhasePredictions",
        maskValue(JSON.stringify(extraPhasePredictions)),
      ),
    [extraPhasePredictions],
  );

  // --- Actions ---

  // SYSTEM CONFIG
  const updateSystemConfig = async (data: Partial<SystemConfigDB>) => {
    // Optimistic
    setSystemConfig((prev) => ({ ...prev, ...data }));
    if (isSupabaseEnabled() && supabase) {
      await supabase
        .from("system_config")
        .update(data)
        .eq("id", SYSTEM_CONFIG_ID);
    }
  };

  // USERS
  const addUser = async (user: UserDB) => {
    // 1. Optimistic Update
    setUsers((prev) => mergeUserIntoList(prev, user));

    // 2. Database Sync
    if (isSupabaseEnabled() && supabase) {
      try {
        // Check if user already has a role to avoid overwriting ADMIN status
        // and user-customized displayName/avatar during login race conditions.
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("role, displayName, avatar, email")
          .eq("userId", user.id)
          .maybeSingle();

        if (existingRole) {
          // Row already exists in DB. Hydrate local state with the persisted
          // values (role, displayName, avatar) instead of overwriting them with
          // the freshly-generated profile coming from auth metadata.
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id
                ? {
                    ...u,
                    role: (existingRole.role as UserRole) ?? u.role,
                    name: existingRole.displayName ?? u.name,
                    avatar: existingRole.avatar ?? u.avatar,
                    email: existingRole.email ?? u.email,
                  }
                : u,
            ),
          );
          // Only patch email if it's missing in the DB (e.g. legacy rows).
          // Never overwrite displayName/avatar here — those are user-edited.
          if (!existingRole.email && user.email) {
            await supabase
              .from("user_roles")
              .update({ email: user.email })
              .eq("userId", user.id);
          }
        } else {
          // New user, safe to insert with default role
          await supabase.from("user_roles").insert({
            userId: user.id,
            displayName: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
          });
        }
      } catch (err) {
        console.error("Error ensuring user profile:", err);
      }
    }
  };
  const updateUser = async (id: string, data: Partial<UserDB>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
    const enabled = isSupabaseEnabled();
    console.log("[updateUser] called for id:", id, "data:", data, "supabaseEnabled:", enabled);
    if (enabled && supabase) {
      const payload: Record<string, any> = {};
      if ("name" in data && data.name !== undefined)
        payload.displayName = data.name;
      if ("email" in data && data.email !== undefined)
        payload.email = data.email;
      if ("avatar" in data && data.avatar !== undefined)
        payload.avatar = data.avatar;
      if ("role" in data && data.role !== undefined) payload.role = data.role;

      if (Object.keys(payload).length > 0) {
        const prefix = import.meta.env.VITE_DB_TABLE_PREFIX || "";
        const tableName = prefix ? `${prefix}user_roles` : "user_roles";
        console.log("[updateUser] Sending to Supabase | table:", tableName, "| schema:", import.meta.env.VITE_SUPABASE_SCHEMA || "public", "| payload:", payload);
        const result = await supabase.from("user_roles").update(payload).eq("userId", id).select();
        console.log("[updateUser] Supabase result:", result);
        if (result.error) {
          console.error("[updateUser] Supabase error:", result.error.message, "payload:", payload);
          throw new Error(result.error.message);
        }
        if (!result.data || result.data.length === 0) {
          console.warn("[updateUser] Supabase returned 0 rows updated. The userId may not exist in the remote table, or the row is in a different schema/table.");
          throw new Error("Usuário não encontrado no servidor para atualização.");
        }
      }
    } else {
      console.warn("[updateUser] Supabase NOT enabled — only local state was updated.");
    }
  };

  const deleteUser = async (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setUserGroups((prev) => prev.filter((ug) => ug.userId !== id));
    setPredictions((prev) => prev.filter((p) => p.userId !== id));
    setTournamentPredictions((prev) => prev.filter((tp) => tp.userId !== id));

    if (isSupabaseEnabled() && supabase) {
      try {
        await supabase.from("user_roles").delete().eq("userId", id);
        await supabase.from("user_groups").delete().eq("userId", id);
        await supabase.from("predictions").delete().eq("userId", id);
        await supabase.from("tournament_predictions").delete().eq("userId", id);
      } catch (err: any) {
        console.error("Erro crítico ao excluir usuário:", err.message);
      }
    }
  };

  // GROUPS
  const addGroup = async (group: GroupDB) => {
    setGroups((prev) => mergeGroupIntoList(prev, group));
    if (isSupabaseEnabled() && supabase) {
      await supabase.from("groups").insert(group);
    }
  };

  const updateGroup = async (id: string, data: Partial<GroupDB>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
    if (isSupabaseEnabled() && supabase) {
      await supabase.from("groups").update(data).eq("id", id);
    }
  };

  const deleteGroup = async (id: string) => {
    // 1. Local Updates (Optimistic)
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setUserGroups((prev) => prev.filter((ug) => ug.groupId !== id));
    setUsers((prev) =>
      prev.map((u) =>
        u.activeGroupId === id ? { ...u, activeGroupId: undefined } : u,
      ),
    );

    // 2. Database Updates
    if (isSupabaseEnabled() && supabase) {
      try {
        // A. Remover dependências na tabela user_groups (garantia explícita, mesmo se houver cascade)
        const { error: ugError } = await supabase
          .from("user_groups")
          .delete()
          .eq("groupId", id);
        if (ugError)
          throw new Error(`Erro ao limpar membros: ${ugError.message}`);

        // B. Excluir o grupo
        const { error: groupError } = await supabase
          .from("groups")
          .delete()
          .eq("id", id);
        if (groupError)
          throw new Error(`Erro ao excluir grupo: ${groupError.message}`);

        console.log("✅ Grupo e dependências excluídos com sucesso.");
      } catch (err: any) {
        console.error("CRITICAL DELETE ERROR:", err);
        throw err; // Repassa o erro para o componente tratar
      }
    }
  };

  // RELATIONSHIPS
  const addUserToGroup = async (relation: UserGroupDB) => {
    setUserGroups((prev) => mergeUserGroupIntoList(prev, relation));
    if (isSupabaseEnabled() && supabase) {
      await supabase.from("user_groups").insert(relation);
    }
  };

  const removeUserFromGroup = async (userId: string, groupId: string) => {
    // 1. Optimistic Local Update
    setUserGroups((prev) =>
      prev.filter((ug) => !(ug.userId === userId && ug.groupId === groupId)),
    );

    // If the user is currently viewing this group, clear their activeGroupId to prevent "ghost" group viewing
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId && u.activeGroupId === groupId
          ? { ...u, activeGroupId: undefined }
          : u,
      ),
    );

    // 2. Database Update
    if (isSupabaseEnabled() && supabase) {
      try {
        // Delete relationship
        await supabase.from("user_groups").delete().match({ userId, groupId });
      } catch (err) {
        console.error("Error removing user from group:", err);
      }
    }
  };

  // TEAMS
  const upsertTeam = async (team: Team) => {
    if (isSupabaseEnabled() && supabase) {
      const teamPayload = {
        name: team.name,
        code: team.code,
        flag: team.flag,
        ranking: team.ranking,
        pot: team.pot,
        externalTeamId: team.externalTeamId,
      };

      const { data: persistedTeam, error } = await supabase
        .from("teams")
        .upsert(teamPayload, { onConflict: team.externalTeamId ? "externalTeamId" : "code" })
        .select("*")
        .single();


      if (error) {
        throw new Error(`Erro ao salvar team: ${error.message}`);
      }

      // Upsert Standings if available
      if (team.standingsCompetitionCode && persistedTeam) {
        const standingsPayload = {
          teamId: persistedTeam.id,
          competitionCode: team.standingsCompetitionCode,
          season: team.standingsSeason,
          stage: team.standingsStage,
          type: team.standingsType,
          group: team.standingsGroup,
          position: team.standingsPosition,
          playedGames: team.standingsPlayedGames,
          form: team.standingsForm,
          won: team.standingsWon,
          draw: team.standingsDraw,
          lost: team.standingsLost,
          points: team.standingsPoints,
          goalsFor: team.standingsGoalsFor,
          goalsAgainst: team.standingsGoalsAgainst,
          goalDifference: team.standingsGoalDifference,
          updatedAt: team.standingsUpdatedAt,
        };
        
        await supabase.from("team_standings").upsert(standingsPayload, { onConflict: "teamId,competitionCode" });
      }

      setTeams((prev) => {
        const idx = prev.findIndex(
          (t) => t.id === persistedTeam.id || t.code === persistedTeam.code,
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...persistedTeam };
          return next;
        }
        return [...prev, persistedTeam as TeamDB];
      });

      return persistedTeam as TeamDB;
    }

    setTeams((prev) => {
      const idx = prev.findIndex(
        (t) => t.id === team.id || t.code === team.code,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...team };
        return next;
      }
      return [...prev, team];
    });

    return team;
  };

  // COMPETITIONS
  const upsertCompetitions = async (competitionsList: CompetitionDB[]) => {
    // Optimistic Update
    setCompetitions((prev) => {
      let next = [...prev];
      competitionsList.forEach((incoming) => {
        next = mergeCompetitionIntoList(next, incoming);
      });
      return next;
    });

    // DB Update — map camelCase to snake_case for Supabase (database uses snake_case for some fields)
    if (isSupabaseEnabled() && supabase && competitionsList.length > 0) {
      const rows = competitionsList.map((c) => {
        const row: any = { code: c.code, name: c.name };
        if (c.emblem !== undefined) row.emblem = c.emblem;
        if (c.type !== undefined) row.type = c.type;
        if (c.lastSync !== undefined) row.last_sync = c.lastSync;
        if (c.topScorerName !== undefined) row.topScorerName = c.topScorerName;
        if (c.topScorerGoals !== undefined) row.topScorerGoals = c.topScorerGoals;
        if (c.championTeamId !== undefined) row.championTeamId = c.championTeamId;
        if (c.bestPlayerName !== undefined) row.bestPlayerName = c.bestPlayerName;
        if (c.bestGoalkeeperName !== undefined) row.bestGoalkeeperName = c.bestGoalkeeperName;
        if (c.mostGoalsTeamId !== undefined) row.mostGoalsTeamId = c.mostGoalsTeamId;
        if (c.mostConcededTeamId !== undefined) row.mostConcededTeamId = c.mostConcededTeamId;
        if (c.mostGoalsTeamIds !== undefined) row.mostGoalsTeamIds = c.mostGoalsTeamIds;
        if (c.mostConcededTeamIds !== undefined) row.mostConcededTeamIds = c.mostConcededTeamIds;
        return row;
      });
      const { error } = await supabase
        .from("competitions")
        .upsert(rows, { onConflict: "code" });
      if (error) {
        console.error("Erro ao fazer upsert de competições:", error.message);
      }
    }
  };

  const updateCompetitionLiveDetailsSync = async (
    code: string,
    timestamp: string,
  ) => {
    const patch: { liveDetailsLastSync: string } = {
      liveDetailsLastSync: timestamp,
    };

    setCompetitions((prev) =>
      prev.map((c) => (c.code === code ? { ...c, ...patch } : c)),
    );
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from("competitions")
        .update(patch)
        .eq("code", code);
      if (error) {
        console.error(
          "Erro ao atualizar liveDetailsLastSync da competição:",
          error.message,
        );
      }
    }
  };

  const updateCompetitionSync = async (code: string, timestamp: string) => {
    setCompetitions((prev) =>
      prev.map((c) => (c.code === code ? { ...c, lastSync: timestamp } : c)),
    );
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from("competitions")
        .update({ last_sync: timestamp })
        .eq("code", code);
      if (error) {
        console.error("Erro ao atualizar sync da competição:", error.message);
      }
    }
  };

  const updateCompetitionAutoSync = async (code: string, enabled: boolean) => {
    setCompetitions((prev) =>
      prev.map((c) =>
        c.code === code ? { ...c, autoSyncEnabled: enabled } : c,
      ),
    );
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from("competitions")
        .update({ autoSyncEnabled: enabled })
        .eq("code", code);
      if (error) {
        console.error(
          "Erro ao atualizar autoSyncEnabled da competição:",
          error.message,
        );
      }
    }
  };

  const acquireSyncLock = async (code: string): Promise<boolean> => {
    const prefix = import.meta.env.VITE_DB_TABLE_PREFIX || "";
    const rpcName = prefix ? `${prefix}acquire_sync_lock` : 'acquire_sync_lock';
    console.log(`[acquireSyncLock] Tentando adquirir lock para ${code} (schema: ${SUPABASE_SCHEMA}, RPC: ${rpcName})`);
    
    // Chama função PostgreSQL que faz UPDATE atômico
    // Só atualiza se lock está NULL ou expirado (>60s)
    const { data, error } = await supabase.rpc(rpcName, {
      p_competition_code: code,
      p_timeout_seconds: 60
    });

    if (error) {
      console.error(`[acquireSyncLock] ERRO ao chamar RPC:`, error);
      return false;
    }

    const lockAcquired = data === true;
    console.log(`[acquireSyncLock] Lock ${lockAcquired ? '✅ ADQUIRIDO' : '🔒 BLOQUEADO'} para ${code}`);
    return lockAcquired;
  };

  const releaseSyncLock = async (code: string): Promise<void> => {
    console.log(`[releaseSyncLock] Liberando lock para ${code}`);
    const { data, error } = await supabase
      .from("competitions")
      .update({ sync_locked_at: null })
      .eq("code", code)
      .select();
    
    if (error) {
      console.error(`[releaseSyncLock] ERRO ao liberar lock:`, error);
    } else if (!data || data.length === 0) {
      console.warn(`[releaseSyncLock] AVISO: Nenhuma linha atualizada para ${code}. Competição não existe?`);
    } else {
      console.log(`[releaseSyncLock] ✅ Lock liberado com sucesso para ${code}`, data);
    }
  };

  const updateCompetitionAwards = async (
    code: string,
    awards: { 
      championTeamId?: string | null;
      topScorerName?: string | null;
      topScorerGoals?: number | null;
      topScorerPlayerIds?: string[] | null;
      bestPlayerName?: string | null;
      bestGoalkeeperName?: string | null;
      mostGoalsTeamId?: string | null;
      mostConcededTeamId?: string | null;
      mostGoalsTeamIds?: string[] | null;
      mostConcededTeamIds?: string[] | null;
      groupClassifications?: Record<string, string[]> | null;
      knockoutClassifications?: Record<string, string[]> | null;
      /** @deprecated usar biggestGoalDiffMatchIds */
      biggestGoalDiffMatches?: Record<string, string> | null;
      biggestGoalDiffMatchIds?: Record<string, string[]> | null;
    }
  ) => {
    setCompetitions((prev) =>
      prev.map((c) => {
        if (c.code !== code) return c;
        // Merge PARCIAL: só sobrescreve os campos realmente presentes em
        // `awards` (!== undefined). Caso contrário, uma chamada que passa
        // apenas um campo (ex.: sync passando só biggestGoalDiffMatchIds)
        // zeraria todos os outros prêmios no cache em memória, derrubando
        // os pontos especiais do rank até o próximo refresh.
        const next = { ...c };
        if (awards.championTeamId !== undefined) next.championTeamId = awards.championTeamId ?? undefined;
        if (awards.topScorerName !== undefined) next.topScorerName = awards.topScorerName ?? undefined;
        if (awards.topScorerGoals !== undefined) next.topScorerGoals = awards.topScorerGoals ?? undefined;
        if (awards.topScorerPlayerIds !== undefined) next.topScorerPlayerIds = awards.topScorerPlayerIds ?? undefined;
        if (awards.bestPlayerName !== undefined) next.bestPlayerName = awards.bestPlayerName ?? undefined;
        if (awards.bestGoalkeeperName !== undefined) next.bestGoalkeeperName = awards.bestGoalkeeperName ?? undefined;
        if (awards.mostGoalsTeamId !== undefined) next.mostGoalsTeamId = awards.mostGoalsTeamId ?? undefined;
        if (awards.mostConcededTeamId !== undefined) next.mostConcededTeamId = awards.mostConcededTeamId ?? undefined;
        if (awards.mostGoalsTeamIds !== undefined) next.mostGoalsTeamIds = awards.mostGoalsTeamIds ?? undefined;
        if (awards.mostConcededTeamIds !== undefined) next.mostConcededTeamIds = awards.mostConcededTeamIds ?? undefined;
        if (awards.groupClassifications !== undefined) next.groupClassifications = awards.groupClassifications ?? undefined;
        if (awards.knockoutClassifications !== undefined) next.knockoutClassifications = awards.knockoutClassifications ?? undefined;
        if (awards.biggestGoalDiffMatches !== undefined) next.biggestGoalDiffMatches = awards.biggestGoalDiffMatches ?? undefined;
        if (awards.biggestGoalDiffMatchIds !== undefined) next.biggestGoalDiffMatchIds = awards.biggestGoalDiffMatchIds ?? undefined;
        return next;
      }),
    );
    if (isSupabaseEnabled() && supabase) {
      const updateData: any = {};
      if (awards.championTeamId !== undefined) updateData.championTeamId = awards.championTeamId;
      if (awards.topScorerName !== undefined) updateData.topScorerName = awards.topScorerName;
      if (awards.topScorerGoals !== undefined) updateData.topScorerGoals = awards.topScorerGoals;
      if (awards.topScorerPlayerIds !== undefined) updateData.topScorerPlayerIds = awards.topScorerPlayerIds;
      if (awards.bestPlayerName !== undefined) updateData.bestPlayerName = awards.bestPlayerName;
      if (awards.bestGoalkeeperName !== undefined) updateData.bestGoalkeeperName = awards.bestGoalkeeperName;
      if (awards.mostGoalsTeamId !== undefined) updateData.mostGoalsTeamId = awards.mostGoalsTeamId;
      if (awards.mostConcededTeamId !== undefined) updateData.mostConcededTeamId = awards.mostConcededTeamId;
      if (awards.mostGoalsTeamIds !== undefined) updateData.mostGoalsTeamIds = awards.mostGoalsTeamIds;
      if (awards.mostConcededTeamIds !== undefined) updateData.mostConcededTeamIds = awards.mostConcededTeamIds;
      if (awards.groupClassifications !== undefined) updateData.groupClassifications = awards.groupClassifications;
      if (awards.knockoutClassifications !== undefined) updateData.knockoutClassifications = awards.knockoutClassifications;
      if (awards.biggestGoalDiffMatches !== undefined) updateData.biggestGoalDiffMatches = awards.biggestGoalDiffMatches;
      if (awards.biggestGoalDiffMatchIds !== undefined) updateData.biggestGoalDiffMatchIds = awards.biggestGoalDiffMatchIds;
      
      const { error } = await supabase
        .from("competitions")
        .update(updateData)
        .eq("code", code);
      if (error) {
        console.error("Erro ao atualizar prêmios da competição:", error.message);
      }
    }
  };

  // MATCHES
  const upsertMatch = async (match: MatchDB | MatchDB[]) => {
    const matchesArray = Array.isArray(match) ? match : [match];
    if (matchesArray.length === 0) return;

    const hasExternalId = matchesArray.every((m) => m.externalMatchId);
    const conflictTarget = hasExternalId ? "externalMatchId" : "id";

    const byId = new Map<string, MatchDB>();
    const byExternalId = new Map<string, MatchDB>();
    let droppedDuplicates = 0;

    for (const item of matchesArray) {
      const idKey = item.id;
      const extKey = item.externalMatchId ? String(item.externalMatchId) : null;

      const existingById = byId.get(idKey);
      if (existingById) {
        // Same PK in payload. Keep the last item only if external id is compatible.
        if (
          existingById.externalMatchId &&
          extKey &&
          String(existingById.externalMatchId) !== extKey
        ) {
          droppedDuplicates++;
          continue;
        }
      }

      if (extKey) {
        const existingByExt = byExternalId.get(extKey);
        if (existingByExt && existingByExt.id !== idKey) {
          // Same external id mapped to different PKs in a single batch.
          droppedDuplicates++;
          continue;
        }
      }

      byId.set(idKey, item);
      if (extKey) {
        byExternalId.set(extKey, item);
      }
    }

    const upsertPayload = Array.from(byId.values());

    setMatches((prev) => {
      let next = [...prev];
      upsertPayload.forEach((m) => {
        next = mergeMatchIntoList(next, m);
      });
      return next;
    });

    if (isSupabaseEnabled() && supabase) {
      if (
        upsertPayload.length !== matchesArray.length ||
        droppedDuplicates > 0
      ) {
        console.warn(
          `[MATCHES] Duplicatas removidas antes do upsert: ${matchesArray.length - upsertPayload.length + droppedDuplicates}`,
        );
      }

      const { error } = await supabase
        .from("matches")
        .upsert(upsertPayload, { onConflict: conflictTarget });
      if (error) {
        throw new Error(`Erro ao salvar matches em lote: ${error.message}`);
      }
    }
  };

  // MATCHES
  const updateMatch = async (id: string, data: Partial<MatchDB>) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...data } : m)),
    );
    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from("matches")
        .update(data)
        .eq("id", id);
      if (error) {
        throw new Error(`Erro ao atualizar match: ${error.message}`);
      }
    }
  };

  // PREDICTIONS
  const upsertPrediction = async (
    prediction: PredictionDB | PredictionDB[],
  ) => {
    const predsArray = Array.isArray(prediction) ? prediction : [prediction];
    if (predsArray.length === 0) return;

    setPredictions((prev) => {
      let next = [...prev];
      predsArray.forEach((pred) => {
        const index = next.findIndex(
          (p) => predictionIdentityKey(p) === predictionIdentityKey(pred),
        );
        if (index >= 0) {
          next[index] = { ...next[index], ...pred };
        } else {
          next.push(pred);
        }
      });
      return next;
    });

    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from("predictions")
        .upsert(predsArray, { onConflict: '"userId", "matchId", "groupId"' });

      if (error) {
        throw new Error(`Erro ao salvar predictions em lote: ${error.message}`);
      }
    }
  };

  const upsertTournamentPrediction = async (pred: TournamentPredictionDB) => {
    setTournamentPredictions((prev) => {
      const index = prev.findIndex(
        (p) => p.userId === pred.userId && p.groupId === pred.groupId,
      );
      if (index >= 0) {
        const newArr = [...prev];
        newArr[index] = { ...newArr[index], ...pred };
        return newArr;
      }
      return [...prev, pred];
    });

    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from("tournament_predictions")
        .upsert(pred, { onConflict: "userId,groupId" });

      if (error) {
        throw new Error(
          `Erro ao salvar tournament prediction: ${error.message}`,
        );
      }
    }
  };

  const upsertExtraPhasePrediction = async (pred: ExtraPhasePredictionDB) => {
    setExtraPhasePredictions((prev) => {
      const index = prev.findIndex(
        (p) => p.userId === pred.userId && p.groupId === pred.groupId && p.phase === pred.phase,
      );
      if (index >= 0) {
        const newArr = [...prev];
        newArr[index] = { ...newArr[index], ...pred };
        return newArr;
      }
      return [...prev, pred];
    });

    if (isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from("extra_phase_predictions")
        .upsert(pred, { onConflict: '"userId", "groupId", "phase"' });

      if (error) {
        throw new Error(
          `Erro ao salvar extra phase prediction: ${error.message}`,
        );
      }
    }
  };

  const refetchMatches = useCallback(async () => {
    if (!isSupabaseEnabled() || !supabase) return;
    const data = await fetchAllRecords<MatchDB>("matches");
    if (data) {
      const deduped = data.reduce(
        (acc, item) => mergeMatchIntoList(acc, item),
        [] as MatchDB[],
      );
      setMatches(deduped);
    }
  }, []);

  const refetchTeamStandings = useCallback(async () => {
    if (!isSupabaseEnabled() || !supabase) return;
    const { data } = await supabase.from("team_standings").select("*");
    if (data) setTeamStandings(data as any[]);
  }, []);

  const refetchPredictions = useCallback(async () => {
    if (!isSupabaseEnabled() || !supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const data = await fetchAllRecords<PredictionDB>("predictions");
    if (data) setPredictions(data);
  }, []);

  const refetchUserGroups = useCallback(async () => {
    if (!isSupabaseEnabled() || !supabase) return;
    const { data } = await supabase.from("user_groups").select("*");
    if (data) {
      const deduped = (data as UserGroupDB[]).reduce(
        (acc, item) => mergeUserGroupIntoList(acc, item),
        [] as UserGroupDB[],
      );
      setUserGroups(deduped);
    }
  }, []);

  const refetchSystemConfig = useCallback(async () => {
    if (!isSupabaseEnabled() || !supabase) return;
    const { data } = await supabase.from("system_config").select("*").single();
    if (data) setSystemConfig(data);
  }, []);

  return (
    <DatabaseContext.Provider
      value={useMemo(() => ({
        competitions,
        users,
        groups,
        userGroups,
        teams,
        stadiums,
        matches,
        predictions,
        tournamentPredictions,
        extraPhasePredictions,
        teamStandings,
        systemConfig,
        addUser,
        updateUser,
        deleteUser,
        addGroup,
        updateGroup,
        deleteGroup,
        addUserToGroup,
        removeUserFromGroup,
        updateLocalUserGroups: (updates: UserGroupDB[]) => {
          setUserGroups((prev) => {
            const next = [...prev];
            updates.forEach((update) => {
              const idx = next.findIndex(
                (ug) =>
                  ug.userId === update.userId && ug.groupId === update.groupId,
              );
              if (idx >= 0) {
                next[idx] = { ...next[idx], ...update };
              } else {
                next.push(update);
              }
            });
            return next;
          });
        },
        upsertCompetitions,
        updateCompetitionSync,
        updateCompetitionLiveDetailsSync,
        updateCompetitionAutoSync,
        acquireSyncLock,
        releaseSyncLock,
        updateCompetitionAwards,
        upsertTeam,
        upsertMatch,
        updateMatch,
        upsertPrediction,
        upsertTournamentPrediction,
        upsertExtraPhasePrediction,
        updateSystemConfig,
        refetchMatches,
        refetchTeamStandings,
        refetchPredictions,
        refetchUserGroups,
        refetchSystemConfig,
        players,
        isSyncingPlayers,
        syncSquads,
        syncScorers,
        searchPlayers,
        getTopScorers,
        getPlayersByIds,
        isInitialFetchComplete,
      }), [
        competitions,
        users,
        groups,
        userGroups,
        teams,
        stadiums,
        matches,
        predictions,
        tournamentPredictions,
        extraPhasePredictions,
        systemConfig,
        addUser,
        updateUser,
        deleteUser,
        addGroup,
        updateGroup,
        deleteGroup,
        addUserToGroup,
        removeUserFromGroup,
        upsertCompetitions,
        updateCompetitionSync,
        updateCompetitionLiveDetailsSync,
        updateCompetitionAutoSync,
        acquireSyncLock,
        releaseSyncLock,
        updateCompetitionAwards,
        upsertTeam,
        upsertMatch,
        updateMatch,
        upsertPrediction,
        upsertTournamentPrediction,
        upsertExtraPhasePrediction,
        updateSystemConfig,
        refetchMatches,
        refetchTeamStandings,
        refetchPredictions,
        refetchUserGroups,
        refetchSystemConfig,
        players,
        isSyncingPlayers,
        syncSquads,
        syncScorers,
        searchPlayers,
        getTopScorers,
        getPlayersByIds,
        isInitialFetchComplete,
      ])}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context)
    throw new Error("useDatabase must be used within a DatabaseProvider");
  return context;
};
