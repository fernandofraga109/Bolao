import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { User, UserRole, TournamentPredictions, Group } from "../types";
import { useDatabase } from "../contexts/DatabaseContext";
import { supabase, isSupabaseEnabled } from "../services/supabase";

export const useUserSystem = () => {
  const db = useDatabase();
  const dbRef = useRef(db);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem("bolao_current_user_id");
  });
  const [authReady, setAuthReady] = useState(false);
  const pendingSignupsRef = useRef(new Set<string>());
  const signupAttemptAtRef = useRef(new Map<string, number>());

  const resolveChampionIdForUi = useCallback(
    (storedChampionTeamId?: string): string | undefined => {
      if (!storedChampionTeamId) return undefined;

      const normalizedStored = storedChampionTeamId.toLowerCase();
      const match = db.teams.find((team) => {
        if (!team) return false;
        const byId = team.id?.toLowerCase() === normalizedStored;
        const byCode = team.code?.toLowerCase() === normalizedStored;
        return byId || byCode;
      });

      if (!match) return undefined;

      return (match.id || match.code || "").toLowerCase() || undefined;
    },
    [db.teams],
  );

  const resolveChampionIdForDb = useCallback(
    (uiChampionTeamId?: string): string | undefined => {
      if (!uiChampionTeamId) return undefined;

      const normalizedUiId = uiChampionTeamId.toLowerCase();
      const match = db.teams.find((team) => {
        if (!team) return false;
        const byId = team.id?.toLowerCase() === normalizedUiId;
        const byCode = team.code?.toLowerCase() === normalizedUiId;
        return byId || byCode;
      });

      if (!match) return uiChampionTeamId;
      return match.id;
    },
    [db.teams],
  );

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // --- HYDRATION: Convert DB Normalized Data to UI User Objects ---
  // This performs the "SQL JOIN" logic
  const hydratedUsers: User[] = useMemo(() => {
    return db.users.map((user) => {
      // Join UserGroups
      const myGroups = db.userGroups
        .filter((ug) => ug.userId === user.id)
        .map((ug) => ug.groupId);

      // activeGroupId may not be persisted in remote rows; recover from local preference or first joined group.
      const preferredActiveGroupId = localStorage.getItem(
        `bolao_active_group_${user.id}`,
      );

      const resolvedActiveGroupId =
        (preferredActiveGroupId && myGroups.includes(preferredActiveGroupId)
          ? preferredActiveGroupId
          : undefined) ||
        (user.activeGroupId && myGroups.includes(user.activeGroupId)
          ? user.activeGroupId
          : undefined) ||
        myGroups[0];

      // Join Predictions
      const myPredictionsMap: Record<string, { home: number; away: number }> =
        {};
      db.predictions
        .filter((p) => p.userId === user.id)
        .forEach((p) => {
          const isExactGroupPrediction =
            !!resolvedActiveGroupId && p.groupId === resolvedActiveGroupId;
          const isLegacyPrediction = !p.groupId;

          if (!isExactGroupPrediction && !isLegacyPrediction) return;

          // Group-specific prediction always wins over legacy/global entries.
          const alreadyHasPrediction = !!myPredictionsMap[p.matchId];
          if (alreadyHasPrediction && !isExactGroupPrediction) return;

          myPredictionsMap[p.matchId] = {
            home: p.homeScore,
            away: p.awayScore,
          };
        });

      // Join Tournament Predictions
      const tpDb = db.tournamentPredictions.find((tp) => tp.userId === user.id);
      const tp: TournamentPredictions | undefined = tpDb
        ? {
            championTeamId: resolveChampionIdForUi(tpDb.championTeamId),
            topScorer:
              tpDb.topScorerPlayer || tpDb.topScorerGoals
                ? {
                    player: tpDb.topScorerPlayer || "",
                    goals: tpDb.topScorerGoals || 0,
                  }
                : undefined,
            bestPlayer: tpDb.bestPlayer,
            bestGoalkeeper: tpDb.bestGoalkeeper,
          }
        : undefined;

      return {
        ...user,
        groupIds: myGroups,
        activeGroupId: resolvedActiveGroupId,
        predictions: myPredictionsMap,
        tournamentPredictions: tp,
      };
    });
  }, [
    db.users,
    db.userGroups,
    db.predictions,
    db.tournamentPredictions,
    resolveChampionIdForUi,
  ]);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return hydratedUsers.find((u) => u.id === currentUserId) || null;
  }, [currentUserId, hydratedUsers]);

  const ensureProfileForAuthUser = useCallback(
    async (userId: string, email: string, metadata: Record<string, any>) => {
      const currentDb = dbRef.current;
      const existing = currentDb.users.find((u) => u.id === userId);
      if (existing) return existing;

      const nameFromMetadata =
        typeof metadata?.display_name === "string" &&
        metadata.display_name.trim()
          ? metadata.display_name.trim()
          : typeof metadata?.full_name === "string" && metadata.full_name.trim()
            ? metadata.full_name.trim()
            : typeof metadata?.name === "string" && metadata.name.trim()
              ? metadata.name.trim()
              : email.split("@")[0] || "Usuário";

      const profile = {
        id: userId,
        name: nameFromMetadata,
        email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(nameFromMetadata)}&background=random`,
        role: "USER" as const,
        status: "ACTIVE" as const,
        activeGroupId: undefined,
        totalPoints: 0,
      };

      await currentDb.addUser(profile);
      return profile;
    },
    [],
  );

  useEffect(() => {
    if (!isSupabaseEnabled() || !supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const sessionUser = data.session?.user ?? null;
      if (sessionUser) {
        await ensureProfileForAuthUser(
          sessionUser.id,
          sessionUser.email ?? "",
          sessionUser.user_metadata ?? {},
        );
        setCurrentUserId(sessionUser.id);
        localStorage.setItem("bolao_current_user_id", sessionUser.id);
      } else {
        setCurrentUserId(null);
        localStorage.removeItem("bolao_current_user_id");
      }

      if (mounted) setAuthReady(true);
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const sessionUser = session?.user ?? null;
        if (sessionUser) {
          await ensureProfileForAuthUser(
            sessionUser.id,
            sessionUser.email ?? "",
            sessionUser.user_metadata ?? {},
          );
          setCurrentUserId(sessionUser.id);
          localStorage.setItem("bolao_current_user_id", sessionUser.id);
        } else {
          setCurrentUserId(null);
          localStorage.removeItem("bolao_current_user_id");
        }
        setAuthReady(true);
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [ensureProfileForAuthUser]);

  // --- ACTIONS ---

  const login = (user: User) => {
    setCurrentUserId(user.id);
    localStorage.setItem("bolao_current_user_id", user.id);
  };

  const loginWithCredentials = async (email: string, password: string) => {
    if (isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { success: false, message: error.message };

      const authUser = data.user;
      if (!authUser)
        return { success: false, message: "Não foi possível autenticar." };

      const profile = await ensureProfileForAuthUser(
        authUser.id,
        authUser.email ?? email,
        authUser.user_metadata ?? {},
      );
      const hydratedUser: User = {
        ...profile,
        groupIds:
          hydratedUsers.find((u) => u.id === profile.id)?.groupIds ?? [],
        predictions:
          hydratedUsers.find((u) => u.id === profile.id)?.predictions ?? {},
        tournamentPredictions: hydratedUsers.find((u) => u.id === profile.id)
          ?.tournamentPredictions,
      };

      login(hydratedUser);
      return { success: true, user: hydratedUser };
    }

    const user = hydratedUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (!user) return { success: false, message: "Usuário não encontrado." };
    if (user.password !== password)
      return { success: false, message: "Senha incorreta." };
    login(user);
    return { success: true, user };
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    groupCode: string,
    groupsList: Group[],
  ) => {
    const group = groupsList.find(
      (g) => g.code.toUpperCase() === groupCode.toUpperCase(),
    );
    if (!group) return { success: false, message: "Código de grupo inválido." };

    if (isSupabaseEnabled() && supabase) {
      const normalizedEmail = email.trim().toLowerCase();
      const cooldownMs = 15_000;
      const now = Date.now();
      const lastAttemptAt = signupAttemptAtRef.current.get(normalizedEmail);

      if (pendingSignupsRef.current.has(normalizedEmail)) {
        return {
          success: false,
          message: "Cadastro já está em andamento. Aguarde alguns segundos.",
        };
      }

      if (lastAttemptAt && now - lastAttemptAt < cooldownMs) {
        const remaining = Math.ceil(
          (cooldownMs - (now - lastAttemptAt)) / 1000,
        );
        return {
          success: false,
          message: `Aguarde ${remaining}s para tentar novo cadastro.`,
        };
      }

      pendingSignupsRef.current.add(normalizedEmail);
      signupAttemptAtRef.current.set(normalizedEmail, now);

      try {
        let authUserId: string | null = null;
        let authEmail: string = email;

        try {
          const proxyResponse = await fetch("/api/supabase-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });

          const proxyPayload = await proxyResponse.json().catch(() => ({}));

          if (proxyResponse.ok && proxyPayload?.user?.id) {
            authUserId = String(proxyPayload.user.id);
            authEmail = String(proxyPayload.user.email || email);
          } else if (proxyResponse.status !== 404) {
            const message =
              proxyPayload?.message ||
              proxyPayload?.error ||
              "Falha no cadastro via proxy.";
            const isRateLimit = /rate\s*limit|too\s*many/i.test(message);
            if (isRateLimit) {
              return {
                success: false,
                message:
                  "Muitas tentativas de cadastro. Aguarde um pouco e tente novamente.",
              };
            }
            return { success: false, message };
          }
        } catch {
          // Falhou no proxy (ex: ambiente local sem função serverless); segue fallback.
        }

        if (!authUserId) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: name, full_name: name },
            },
          });

          if (error) {
            const isRateLimit = /rate\s*limit|too\s*many/i.test(error.message);
            if (isRateLimit) {
              return {
                success: false,
                message:
                  "Muitas tentativas de cadastro. Aguarde um pouco e tente novamente.",
              };
            }
            return {
              success: false,
              message: error.message,
            };
          }

          const authUser = data.user;
          if (!authUser)
            return {
              success: false,
              message: "Não foi possível criar a conta.",
            };

          authUserId = authUser.id;
          authEmail = authUser.email ?? email;
        }

        // RLS now requires a valid JWT session for user-owned inserts/updates.
        // Ensure the user is authenticated before writing to protected tables.
        const signInResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInResult.error || !signInResult.data.user) {
          const msg =
            signInResult.error?.message || "Não foi possível iniciar sessão.";
          const needsEmailConfirmation = /confirm|verification|verify/i.test(
            msg,
          );
          return {
            success: false,
            message: needsEmailConfirmation
              ? "Conta criada. Confirme o e-mail para entrar e começar a palpitar."
              : msg,
          };
        }

        authUserId = signInResult.data.user.id;
        authEmail = signInResult.data.user.email ?? authEmail;

        await ensureProfileForAuthUser(authUserId, authEmail, {
          full_name: name,
        });

        await db.addUserToGroup({
          userId: authUserId,
          groupId: group.id,
          joinedAt: new Date().toISOString(),
        });

        await db.updateUser(authUserId, { activeGroupId: group.id });
        setCurrentUserId(authUserId);
        localStorage.setItem("bolao_current_user_id", authUserId);
        localStorage.setItem(`bolao_active_group_${authUserId}`, group.id);
        return { success: true };
      } finally {
        pendingSignupsRef.current.delete(normalizedEmail);
      }
    }

    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: "E-mail já cadastrado." };
    }

    const newId = `u_${Date.now()}`;

    db.addUser({
      id: newId,
      name,
      email,
      password,
      avatar: `https://ui-avatars.com/api/?name=${name.replace(" ", "+")}&background=random`,
      role: "USER",
      status: "ACTIVE",
      activeGroupId: group.id,
      totalPoints: 0,
    });

    db.addUserToGroup({
      userId: newId,
      groupId: group.id,
      joinedAt: new Date().toISOString(),
    });

    setCurrentUserId(newId);
    localStorage.setItem("bolao_current_user_id", newId);
    localStorage.setItem(`bolao_active_group_${newId}`, group.id);

    return { success: true };
  };

  const logout = async () => {
    if (isSupabaseEnabled() && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUserId(null);
    localStorage.removeItem("bolao_current_user_id");
  };

  const joinGroup = (userId: string, groupId: string) => {
    db.addUserToGroup({
      userId,
      groupId,
      joinedAt: new Date().toISOString(),
    });
    // Switch active group automatically
    db.updateUser(userId, { activeGroupId: groupId });
    localStorage.setItem(`bolao_active_group_${userId}`, groupId);
  };

  const switchGroup = (userId: string, groupId: string) => {
    db.updateUser(userId, { activeGroupId: groupId });
    localStorage.setItem(`bolao_active_group_${userId}`, groupId);
  };

  const predictMatch = async (matchId: string, home: number, away: number) => {
    if (!currentUser) {
      throw new Error("Voce precisa estar logado para salvar palpites.");
    }
    const activeGroupId = currentUser.activeGroupId || currentUser.groupIds[0];
    if (!activeGroupId) {
      throw new Error("Entre em um grupo antes de salvar palpites.");
    }

    await db.upsertPrediction({
      userId: currentUser.id,
      groupId: activeGroupId,
      matchId,
      homeScore: home,
      awayScore: away,
      timestamp: new Date().toISOString(),
    });
  };

  const predictTournament = (data: TournamentPredictions) => {
    if (!currentUser) return;
    db.upsertTournamentPrediction({
      userId: currentUser.id,
      championTeamId: resolveChampionIdForDb(data.championTeamId),
      topScorerPlayer: data.topScorer?.player,
      topScorerGoals: data.topScorer?.goals,
      bestPlayer: data.bestPlayer,
      bestGoalkeeper: data.bestGoalkeeper,
    });
  };

  const requestPasswordReset = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { success: false, message: "Informe um e-mail válido." };
    }

    if (!isSupabaseEnabled() || !supabase) {
      return {
        success: false,
        message: "Reset de senha disponível apenas com Supabase configurado.",
      };
    }

    const redirectTo = `${window.location.origin}/?mode=recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      },
    );

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message:
        "Enviamos um e-mail com o link para redefinir sua senha, se a conta existir.",
    };
  };

  const updatePassword = async (newPassword: string) => {
    const normalizedPassword = newPassword.trim();
    if (!normalizedPassword || normalizedPassword.length < 6) {
      return {
        success: false,
        message: "A nova senha deve ter pelo menos 6 caracteres.",
      };
    }

    if (!isSupabaseEnabled() || !supabase) {
      return {
        success: false,
        message:
          "Redefinição de senha disponível apenas com Supabase configurado.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: normalizedPassword,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: "Senha atualizada com sucesso.",
    };
  };

  // --- Admin Actions ---
  const inviteUser = (email: string) => console.log("Inviting", email);
  const updateUserRole = (userId: string, newRole: UserRole) =>
    db.updateUser(userId, { role: newRole });

  const removeUser = async (userId: string) => {
    console.log(`🗑️ useUserSystem: Solicitando exclusão do usuário ${userId}`);
    await db.deleteUser(userId);
  };

  // Fix: made adminAddUserToGroup async to match db operations and expected return type in AdminDashboard
  const adminAddUserToGroup = async (userId: string, groupId: string) => {
    await db.addUserToGroup({
      userId,
      groupId,
      joinedAt: new Date().toISOString(),
    });
  };

  // Fix: made adminRemoveUserFromGroup async and added awaits to ensure proper execution of db operations
  const adminRemoveUserFromGroup = async (userId: string, groupId: string) => {
    await db.removeUserFromGroup(userId, groupId);
    // If user was viewing this group, reset their active group preference
    const user = hydratedUsers.find((u) => u.id === userId);
    if (user && user.activeGroupId === groupId) {
      // Find another group they are in
      const otherGroup = user.groupIds.find((gid) => gid !== groupId);
      await db.updateUser(userId, { activeGroupId: otherGroup });
    }
  };

  return {
    users: hydratedUsers,
    currentUser,
    authReady,
    login,
    loginWithCredentials,
    register,
    logout,
    joinGroup,
    switchGroup,
    predictMatch,
    predictTournament,
    requestPasswordReset,
    updatePassword,
    adminActions: {
      inviteUser,
      updateUserRole,
      removeUser,
      adminAddUserToGroup,
      adminRemoveUserFromGroup,
    },
  };
};
