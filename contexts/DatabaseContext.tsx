import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  UserDB,
  GroupDB,
  UserGroupDB,
  MatchDB,
  TeamDB,
  StadiumDB,
  PredictionDB,
  TournamentPredictionDB,
  SystemConfigDB,
} from "../types";
import { INITIAL_DB } from "../data/initialData";
import { supabase, isSupabaseEnabled } from "../services/supabase";

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
  users: UserDB[];
  groups: GroupDB[];
  userGroups: UserGroupDB[];
  teams: TeamDB[];
  stadiums: StadiumDB[];
  matches: MatchDB[];
  predictions: PredictionDB[];
  tournamentPredictions: TournamentPredictionDB[];
  systemConfig: SystemConfigDB;

  // Actions (CRUD)
  addUser: (user: UserDB) => Promise<void>;
  updateUser: (id: string, data: Partial<UserDB>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  addGroup: (group: GroupDB) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  addUserToGroup: (relation: UserGroupDB) => Promise<void>;
  removeUserFromGroup: (userId: string, groupId: string) => Promise<void>;

  upsertTeam: (team: TeamDB) => Promise<TeamDB>;
  upsertMatch: (match: MatchDB) => Promise<void>;
  updateMatch: (id: string, data: Partial<MatchDB>) => Promise<void>;

  upsertPrediction: (pred: PredictionDB) => Promise<void>;
  upsertTournamentPrediction: (pred: TournamentPredictionDB) => Promise<void>;

  updateSystemConfig: (data: Partial<SystemConfigDB>) => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
);

// Default config if DB is not ready
const DEFAULT_CONFIG: SystemConfigDB = {
  id: SYSTEM_CONFIG_ID,
  is_auto_sync_enabled: false,
  sync_interval_ms: 60000,
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

  // System Config
  const [systemConfig, setSystemConfig] =
    useState<SystemConfigDB>(DEFAULT_CONFIG);

  // --- Supabase Realtime & Sync Effect ---
  useEffect(() => {
    if (!isSupabaseEnabled() || !supabase) return;

    // 1. Initial Fetch
    const fetchData = async () => {
      console.log("🔄 Sincronizando dados com o Supabase...");

      const [
        rolesRes,
        profilesRes,
        legacyUsersRes,
        teamsRes,
        stadiumsRes,
        groupsRes,
        userGroupsRes,
        matchesRes,
        predsRes,
        tournPredsRes,
        configRes,
      ] = await Promise.all([
        supabase
          .from("user_roles")
          .select('"userId", "displayName", avatar, role'),
        supabase.from("profiles").select("*"),
        supabase.from("users").select("*"),
        supabase.from("teams").select("*"),
        supabase.from("stadiums").select("*"),
        supabase.from("groups").select("*"),
        supabase.from("user_groups").select("*"),
        supabase.from("matches").select("*"),
        supabase.from("predictions").select("*"),
        supabase.from("tournament_predictions").select("*"),
        supabase.from("system_config").select("*").single(),
      ]);

      const usersById = new Map<string, UserDB>();

      if (Array.isArray(rolesRes.data)) {
        (rolesRes.data as UserRoleRow[]).forEach((row) => {
          usersById.set(row.userId, mapUserRoleToUser(row));
        });
      }

      if (Array.isArray(profilesRes.data)) {
        (profilesRes.data as ProfileRow[]).forEach((row) => {
          const current = usersById.get(row.id);
          const profileUser = mapProfileToUser(row);
          usersById.set(
            row.id,
            current
              ? {
                  ...profileUser,
                  ...current,
                  activeGroupId:
                    current.activeGroupId || profileUser.activeGroupId,
                  totalPoints:
                    (current.totalPoints || 0) > 0
                      ? current.totalPoints
                      : profileUser.totalPoints,
                }
              : profileUser,
          );
        });
      }

      if (Array.isArray(legacyUsersRes.data)) {
        (legacyUsersRes.data as LegacyUserRow[]).forEach((row) => {
          const current = usersById.get(row.id);
          const legacyUser = mapLegacyUserToUser(row);
          usersById.set(
            row.id,
            current
              ? {
                  ...legacyUser,
                  ...current,
                  activeGroupId:
                    current.activeGroupId || legacyUser.activeGroupId,
                  totalPoints:
                    (current.totalPoints || 0) > 0
                      ? current.totalPoints
                      : legacyUser.totalPoints,
                }
              : legacyUser,
          );
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
    };

    fetchData();

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
                  p.userId === newRecord.userId &&
                  p.matchId === newRecord.matchId,
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
              setPredictions((prev) =>
                prev.filter(
                  (p) =>
                    !(
                      p.userId === oldRecord.userId &&
                      p.matchId === oldRecord.matchId
                    ),
                ),
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

        // --- USER_GROUPS ---
        case "user_groups":
          if (eventType === "INSERT") {
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
      }
    };

    const channel = supabase
      .channel("db-realtime-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_predictions" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_groups" },
        handleRealtimeEvent,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_config" },
        handleRealtimeEvent,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED")
          console.log("✅ Conectado ao Realtime do Banco de Dados");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- Persistence Effects (LocalStorage Fallback) ---
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
    setUsers((prev) => mergeUserIntoList(prev, user));
    if (isSupabaseEnabled() && supabase) {
      await supabase.from("user_roles").upsert({
        userId: user.id,
        displayName: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      });
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
  const upsertTeam = async (team: TeamDB) => {
    if (isSupabaseEnabled() && supabase) {
      const payload = {
        name: team.name,
        code: team.code,
        flag: team.flag,
        ranking: team.ranking,
        pot: team.pot,
        externalTeamId: team.externalTeamId,
        standingsSeason: team.standingsSeason,
        standingsStage: team.standingsStage,
        standingsType: team.standingsType,
        standingsGroup: team.standingsGroup,
        standingsPosition: team.standingsPosition,
        standingsPlayedGames: team.standingsPlayedGames,
        standingsForm: team.standingsForm,
        standingsWon: team.standingsWon,
        standingsDraw: team.standingsDraw,
        standingsLost: team.standingsLost,
        standingsPoints: team.standingsPoints,
        standingsGoalsFor: team.standingsGoalsFor,
        standingsGoalsAgainst: team.standingsGoalsAgainst,
        standingsGoalDifference: team.standingsGoalDifference,
        standingsUpdatedAt: team.standingsUpdatedAt,
      };

      const { data, error } = await supabase
        .from("teams")
        .upsert(payload, { onConflict: "code" })
        .select("*")
        .single();

      if (error) {
        throw new Error(`Erro ao salvar team: ${error.message}`);
      }

      const persistedTeam = data as TeamDB;
      setTeams((prev) => {
        const idx = prev.findIndex(
          (t) => t.id === persistedTeam.id || t.code === persistedTeam.code,
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...persistedTeam };
          return next;
        }
        return [...prev, persistedTeam];
      });

      return persistedTeam;
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

  // MATCHES
  const upsertMatch = async (match: MatchDB) => {
    setMatches((prev) => mergeMatchIntoList(prev, match));

    if (isSupabaseEnabled() && supabase) {
      const conflictTarget = match.externalMatchId ? "externalMatchId" : "id";
      const { error } = await supabase
        .from("matches")
        .upsert(match, { onConflict: conflictTarget });
      if (error) {
        throw new Error(`Erro ao salvar match: ${error.message}`);
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
  const upsertPrediction = async (pred: PredictionDB) => {
    setPredictions((prev) => {
      const index = prev.findIndex(
        (p) => p.userId === pred.userId && p.matchId === pred.matchId,
      );
      if (index >= 0) {
        const newArr = [...prev];
        newArr[index] = { ...newArr[index], ...pred };
        return newArr;
      }
      return [...prev, pred];
    });

    if (isSupabaseEnabled() && supabase) {
      await supabase
        .from("predictions")
        .upsert(pred, { onConflict: "userId, matchId" });
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
      await supabase
        .from("tournament_predictions")
        .upsert(pred, { onConflict: "userId" });
    }
  };

  return (
    <DatabaseContext.Provider
      value={{
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
        deleteGroup,
        addUserToGroup,
        removeUserFromGroup,
        upsertTeam,
        upsertMatch,
        updateMatch,
        upsertPrediction,
        upsertTournamentPrediction,
        updateSystemConfig,
      }}
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
