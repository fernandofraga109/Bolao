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

  // Compute the VIEWER's active group ID independently from hydratedUsers.
  // This is needed to correctly filter other users' predictions: their localStorage
  // keys don't exist on the viewer's device, so their per-user resolvedActiveGroupId
  // would resolve to the wrong group, silently dropping their predictions.
  const viewerActiveGroupId = useMemo(() => {
    if (!currentUserId) return undefined;
    const viewerGroups = db.userGroups
      .filter((ug) => ug.userId === currentUserId)
      .map((ug) => ug.groupId);
    const fromStorage = localStorage.getItem(`bolao_active_group_${currentUserId}`);
    return (fromStorage && viewerGroups.includes(fromStorage) ? fromStorage : undefined)
      || (db.users.find((u) => u.id === currentUserId)?.activeGroupId &&
          viewerGroups.includes(db.users.find((u) => u.id === currentUserId)!.activeGroupId!)
            ? db.users.find((u) => u.id === currentUserId)!.activeGroupId!
            : undefined)
      || viewerGroups[0];
  }, [currentUserId, db.users, db.userGroups]);

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

      // Join Predictions.
      // For the current viewer, use their own resolvedActiveGroupId (accurate on their device).
      // For all other users, use viewerActiveGroupId — their localStorage doesn't exist here,
      // so their per-user resolved group would be wrong and silently drop their predictions.
      const effectiveGroupId =
        user.id === currentUserId ? resolvedActiveGroupId : viewerActiveGroupId;

      const myPredictionsMap: Record<string, { home: number; away: number; points?: number }> =
        {};
      db.predictions
        .filter((p) => p.userId === user.id)
        .forEach((p) => {
          const isExactGroupPrediction =
            !!effectiveGroupId && p.groupId === effectiveGroupId;
          const isLegacyPrediction = !p.groupId;

          if (!isExactGroupPrediction && !isLegacyPrediction) return;

          // Group-specific prediction always wins over legacy/global entries.
          const alreadyHasPrediction = !!myPredictionsMap[p.matchId];
          if (alreadyHasPrediction && !isExactGroupPrediction) return;

          myPredictionsMap[p.matchId] = {
            home: p.homeScore,
            away: p.awayScore,
            points: p.points,
          };
        });

      // Join Tournament Predictions — scoped to the user's active group
      const tpDb = db.tournamentPredictions.find(
        (tp) =>
          tp.userId === user.id &&
          tp.groupId === resolvedActiveGroupId,
      );
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
            mostGoalsTeamId: tpDb.mostGoalsTeamId,
            mostConcededTeamId: tpDb.mostConcededTeamId,
            groupClassifications: tpDb.groupClassifications,
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
    currentUserId,
    viewerActiveGroupId,
  ]);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return hydratedUsers.find((u) => u.id === currentUserId) || null;
  }, [currentUserId, hydratedUsers]);

  const resumePendingGroupJoin = useCallback(async (userId: string) => {
    const pendingGroupId = localStorage.getItem(`bolao_pending_group_${userId}`);
    if (!pendingGroupId || !isSupabaseEnabled() || !supabase) return;

    // Guard against duplicate joins (e.g. syncSession + onAuthStateChange both firing)
    const { data: existing } = await supabase
      .from("user_groups")
      .select("userId")
      .eq("userId", userId)
      .eq("groupId", pendingGroupId)
      .maybeSingle();

    if (!existing) {
      await dbRef.current.addUserToGroup({
        userId,
        groupId: pendingGroupId,
        joinedAt: new Date().toISOString(),
      });
      await dbRef.current.updateUser(userId, { activeGroupId: pendingGroupId });
      localStorage.setItem(`bolao_active_group_${userId}`, pendingGroupId);
    }

    localStorage.removeItem(`bolao_pending_group_${userId}`);
  }, []);

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
    // Safety net: if auth never resolves, unblock after 8s
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        console.warn("[auth] fallback timeout — forcing authReady");
        setAuthReady(true);
      }
    }, 8000);

    const syncSession = async () => {
      console.log("[syncSession] start");
      try {
        const { data } = await supabase.auth.getSession();
        console.log("[syncSession] getSession done, user:", !!data.session?.user);
        if (!mounted) return;

        const sessionUser = data.session?.user ?? null;
        if (sessionUser) {
          await ensureProfileForAuthUser(
            sessionUser.id,
            sessionUser.email ?? "",
            sessionUser.user_metadata ?? {},
          );
          await resumePendingGroupJoin(sessionUser.id);
          setCurrentUserId(sessionUser.id);
          localStorage.setItem("bolao_current_user_id", sessionUser.id);
        } else {
          setCurrentUserId(null);
          localStorage.removeItem("bolao_current_user_id");
        }
      } catch (err) {
        console.error("[syncSession] error:", err);
      } finally {
        console.log("[syncSession] finally, mounted:", mounted);
        if (mounted) {
          clearTimeout(fallbackTimer);
          setAuthReady(true);
        }
      }
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("[onAuthStateChange] event:", _event);
        try {
          const sessionUser = session?.user ?? null;
          if (sessionUser) {
            await ensureProfileForAuthUser(
              sessionUser.id,
              sessionUser.email ?? "",
              sessionUser.user_metadata ?? {},
            );
            await resumePendingGroupJoin(sessionUser.id);
            setCurrentUserId(sessionUser.id);
            localStorage.setItem("bolao_current_user_id", sessionUser.id);
          } else {
            setCurrentUserId(null);
            localStorage.removeItem("bolao_current_user_id");
          }
        } catch (err) {
          console.error("[onAuthStateChange] error:", err);
        } finally {
          clearTimeout(fallbackTimer);
          setAuthReady(true);
        }
      },
    );

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
    };
  }, [ensureProfileForAuthUser, resumePendingGroupJoin]);

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
    const normalizedCode = groupCode.trim().toUpperCase();

    // Fast path: search the in-memory list (populated when user is already authenticated)
    let group: Group | undefined = groupsList.find(
      (g) => g.code.toUpperCase() === normalizedCode,
    );

    // Fallback: query DB directly (handles pre-auth registration where groupsList is empty)
    if (!group && isSupabaseEnabled() && supabase) {
      const { data } = await supabase
        .from("groups")
        .select("*")
        .eq("code", normalizedCode)
        .maybeSingle();
      if (data) group = data as Group;
    }

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
          if (needsEmailConfirmation && authUserId) {
            // Store the group so it can be joined after the user confirms their email
            localStorage.setItem(`bolao_pending_group_${authUserId}`, group.id);
          }
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
    const activeGroupId =
      currentUser.activeGroupId ?? currentUser.groupIds?.[0];
    if (!activeGroupId) return;
    db.upsertTournamentPrediction({
      userId: currentUser.id,
      groupId: activeGroupId,
      championTeamId: resolveChampionIdForDb(data.championTeamId),
      topScorerPlayer: data.topScorer?.player,
      topScorerGoals: data.topScorer?.goals,
      bestPlayer: data.bestPlayer,
      bestGoalkeeper: data.bestGoalkeeper,
      mostGoalsTeamId: data.mostGoalsTeamId,
      mostConcededTeamId: data.mostConcededTeamId,
      groupClassifications: data.groupClassifications,
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

  const updateAvatar = async (newAvatarUrl: string) => {
    if (!currentUser) return { success: false, message: "Usuário não autenticado." };
    await db.updateUser(currentUser.id, { avatar: newAvatarUrl });
    return { success: true };
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
    updateAvatar,
    adminActions: {
      inviteUser,
      updateUserRole,
      removeUser,
      adminAddUserToGroup,
      adminRemoveUserFromGroup,
    },
  };
};
