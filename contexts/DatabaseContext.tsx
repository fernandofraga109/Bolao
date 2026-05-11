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
  SystemConfigDB,
  CompetitionDB,
  TeamStandingsDB,
} from "../types";
import { INITIAL_DB } from "../data/initialData";
import { supabase, isSupabaseEnabled, SUPABASE_SCHEMA } from "../services/supabase";

const SYSTEM_CONFIG_ID = "00000000-0000-0000-0000-000000000001";

type UserRoleRow = {
  userId: string;
  displayName: string;
  email?: string;
  avatar?: string | null;
  role: UserDB["role"];
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
  upsertTeam: (team: Team) => Promise<TeamDB>;
  upsertMatch: (match: MatchDB) => Promise<void>;
  updateMatch: (id: string, data: Partial<MatchDB>) => Promise<void>;

  upsertPrediction: (pred: PredictionDB) => Promise<void>;
  upsertTournamentPrediction: (pred: TournamentPredictionDB) => Promise<void>;

  updateSystemConfig: (data: Partial<SystemConfigDB>) => Promise<void>;
  updateLocalUserGroups: (updates: UserGroupDB[]) => void;
  refetchMatches: () => Promise<void>;
  refetchTeamStandings: () => Promise<void>;
  refetchPredictions: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
);

// Default config if DB is not ready
const DEFAULT_CONFIG: SystemConfigDB = {
  id: SYSTEM_CONFIG_ID,
  is_auto_sync_enabled: false,
  sync_interval_ms: 60000,
  underdog_min_rank_diff: 10,
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

export const DatabaseProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // --- State Initialization ---
  // Safe loader to prevent app crash if LocalStorage is corrupted
  const loadTable = <T,>(key: string, seed: T[]): T[] => {
    try {
      const saved = localStorage.getItem(`bolao_db_${key}`);
      return saved ? JSON.parse(saved) : seed;
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
  const [teams, setTeams] = useState<TeamDB[]>(() =>
    loadTable("teams", INITIAL_DB.teams),
  );
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
  const [teamStandings, setTeamStandings] = useState<TeamStandingsDB[]>(() =>
    loadTable("teamStandings", []),
  );

  // System Config
  const [systemConfig, setSystemConfig] =
    useState<SystemConfigDB>(DEFAULT_CONFIG);

  // --- Supabase Realtime & Sync Effect ---
  useEffect(() => {
    if (!isSupabaseEnabled() || !supabase) return;

    let isMounted = true;

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
        predsRes,
        tournPredsRes,
        configRes,
        competitionsRes,
        teamStandingsRes,
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
        supabase.from("matches").select("*"),
        isAuthenticated
          ? supabase.from("predictions").select("*")
          : Promise.resolve({ data: null, error: null } as any),
        isAuthenticated
          ? supabase.from("tournament_predictions").select("*")
          : Promise.resolve({ data: null, error: null } as any),
        supabase.from("system_config").select("*").single(),
        supabase.from("competitions").select("*"),
        supabase.from("team_standings").select("*"),
      ]);

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
      if (teamsRes.data) setTeams(teamsRes.data);
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
      }
    };

    fetchData();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void fetchData();
    });

    // 2. Realtime Subscriptions Handler
    const handleRealtimeEvent = (payload: any) => {
      const { table, eventType, new: newRecord, old: oldRecord } = payload;

      if (eventType !== "UPDATE") {
        console.log(`⚡ Realtime Event: ${eventType} on ${table}`, payload);
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
              const idx = prev.findIndex((p) => p.userId === newRecord.userId);
              if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], ...newRecord };
                return newArr;
              }
              return [...prev, newRecord];
            });
          } else if (eventType === "DELETE") {
            setTournamentPredictions((prev) =>
              prev.filter((p) => p.userId !== oldRecord.userId),
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

    const channel = supabase
      .channel("db-realtime-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"matches" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"predictions" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"tournament_predictions" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"user_roles" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"groups" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"user_groups" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"system_config" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: SUPABASE_SCHEMA, table:"competitions" },
        handleRealtimeEvent,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.log("✅ Conectado ao Realtime do Banco de Dados");
      });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // --- Persistence Effects (LocalStorage Fallback) ---
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_competitions",
        JSON.stringify(competitions),
      ),
    [competitions],
  );
  useEffect(
    () => localStorage.setItem("bolao_db_users", JSON.stringify(users)),
    [users],
  );
  useEffect(
    () => localStorage.setItem("bolao_db_groups", JSON.stringify(groups)),
    [groups],
  );
  useEffect(
    () =>
      localStorage.setItem("bolao_db_userGroups", JSON.stringify(userGroups)),
    [userGroups],
  );
  useEffect(
    () => localStorage.setItem("bolao_db_matches", JSON.stringify(matches)),
    [matches],
  );
  useEffect(
    () =>
      localStorage.setItem("bolao_db_predictions", JSON.stringify(predictions)),
    [predictions],
  );
  useEffect(
    () =>
      localStorage.setItem(
        "bolao_db_tournamentPredictions",
        JSON.stringify(tournamentPredictions),
      ),
    [tournamentPredictions],
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
        // Check if user already has a role to avoid overwriting ADMIN status during race conditions
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("userId", user.id)
          .single();

        if (existingRole) {
          // Correct local state if DB role differs from optimistic value (e.g., ADMIN logged in as new session)
          if (existingRole.role && existingRole.role !== user.role) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === user.id ? { ...u, role: existingRole.role as UserRole } : u,
              ),
            );
          }
          // Update other fields but NOT the role if it's already set (to prevent demotion)
          await supabase
            .from("user_roles")
            .update({
              displayName: user.name,
              email: user.email,
              avatar: user.avatar,
            })
            .eq("userId", user.id);
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
    if (isSupabaseEnabled() && supabase) {
      const payload: Record<string, any> = {};
      if ("name" in data && data.name !== undefined)
        payload.displayName = data.name;
      if ("email" in data && data.email !== undefined)
        payload.email = data.email;
      if ("avatar" in data && data.avatar !== undefined)
        payload.avatar = data.avatar;
      if ("role" in data && data.role !== undefined) payload.role = data.role;

      if (Object.keys(payload).length > 0) {
        await supabase.from("user_roles").update(payload).eq("userId", id);
      }
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

    // DB Update — map camelCase to snake_case for Supabase
    if (isSupabaseEnabled() && supabase && competitionsList.length > 0) {
      const rows = competitionsList.map((c) => {
        const row: any = { code: c.code, name: c.name };
        if (c.emblem !== undefined) row.emblem = c.emblem;
        if (c.type !== undefined) row.type = c.type;
        if (c.lastSync !== undefined) row.last_sync = c.lastSync;
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
      const index = prev.findIndex((p) => p.userId === pred.userId);
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
        .upsert(pred, { onConflict: "userId" });

      if (error) {
        throw new Error(
          `Erro ao salvar tournament prediction: ${error.message}`,
        );
      }
    }
  };

  const refetchMatches = useCallback(async () => {
    if (!isSupabaseEnabled() || !supabase) return;
    const { data } = await supabase.from("matches").select("*");
    if (data) {
      const deduped = (data as MatchDB[]).reduce(
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
    const { data } = await supabase.from("predictions").select("*");
    if (data) setPredictions(data as PredictionDB[]);
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
        upsertTeam,
        upsertMatch,
        updateMatch,
        upsertPrediction,
        upsertTournamentPrediction,
        updateSystemConfig,
        refetchMatches,
        refetchTeamStandings,
        refetchPredictions,
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
        upsertTeam,
        upsertMatch,
        updateMatch,
        upsertPrediction,
        upsertTournamentPrediction,
        updateSystemConfig,
        refetchMatches,
        refetchTeamStandings,
        refetchPredictions,
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
