import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "../services/supabase";
import { useDatabase } from "../contexts/DatabaseContext";
import {
  Poll,
  PollDB,
  PollResults,
  PollTargetRuleset,
  User,
} from "../types";

/**
 * Sistema de Enquetes (Polls).
 *
 * Hook CONSUMIDOR (como useGroupSystem): lê `groups` do DatabaseContext para resolver
 * o targeting por ruleset e fala direto com o `supabase` para polls/respostas.
 *
 * Fluxo do usuário (detecção passiva, análoga ao check de versão):
 *   - ao logar, busca polls ativas + as respostas do PRÓPRIO usuário (RLS own-row),
 *     filtra por targeting de ruleset e remove as já respondidas → `pendingPolls`.
 *   - App.tsx mostra um modal BLOQUEANTE sequencial sobre `pendingPolls`.
 *   - ADMIN nunca é alvo (guarda no cálculo de pendência + em App.tsx).
 *
 * Anonimato: o admin NUNCA lê `poll_responses`; resultados vêm da RPC
 * `get_poll_results` (SECURITY DEFINER), que só devolve contagem por opção.
 */

const rpcName = (base: string): string => {
  const prefix = import.meta.env.VITE_DB_TABLE_PREFIX || "";
  return prefix ? `${prefix}${base}` : base;
};

/** Targeting avaliado no client a partir dos grupos (rulesets) do usuário. */
const userMatchesTarget = (
  target: PollTargetRuleset,
  userRulesets: Set<string>,
): boolean => {
  if (!target) return true; // null = todos
  if (target === "both") return userRulesets.size > 0; // tem reg1 OU reg2
  return userRulesets.has(target);
};

export const usePollSystem = (currentUser: User | null) => {
  const db = useDatabase();
  const { groups, users, userGroups } = db;

  /**
   * Cadastrado até a criação da enquete? Quem entrou DEPOIS não é elegível
   * (sem bagagem para opinar). createdAt/created_at ausentes → tratado como elegível.
   */
  const registeredBeforePoll = (
    userCreatedAt: string | undefined,
    pollCreatedAt: string | undefined,
  ): boolean => {
    if (!userCreatedAt || !pollCreatedAt) return true;
    return new Date(userCreatedAt).getTime() <= new Date(pollCreatedAt).getTime();
  };

  /**
   * Conta usuários NÃO-admin elegíveis a uma poll: casam o targeting por ruleset
   * E se cadastraram até a criação da enquete.
   */
  const countEligibleUsers = useCallback(
    (target: PollTargetRuleset, pollCreatedAt: string | undefined): number => {
      const nonAdmin = users.filter(
        (u) => u.role !== "ADMIN" && registeredBeforePoll(u.createdAt, pollCreatedAt),
      );
      if (!target) return nonAdmin.length; // todos (já filtrados por data)

      // userId -> conjunto de rulesets dos seus grupos
      const rulesetsByUser = new Map<string, Set<string>>();
      for (const ug of userGroups) {
        const ruleset = groups.find((g) => g.id === ug.groupId)?.ruleset;
        if (!ruleset) continue;
        if (!rulesetsByUser.has(ug.userId)) rulesetsByUser.set(ug.userId, new Set());
        rulesetsByUser.get(ug.userId)!.add(ruleset);
      }

      return nonAdmin.filter((u) => {
        const rs = rulesetsByUser.get(u.id);
        if (!rs || rs.size === 0) return false;
        if (target === "both") return true; // tem reg1 OU reg2
        return rs.has(target);
      }).length;
    },
    [users, userGroups, groups],
  );

  const [activePolls, setActivePolls] = useState<Poll[]>([]);
  const [answeredPollIds, setAnsweredPollIds] = useState<Set<string>>(new Set());
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);

  // --- Fetch das polls ativas + respostas do próprio usuário ---
  const loadPolls = useCallback(async () => {
    if (!isSupabaseEnabled() || !supabase || !currentUser) return;
    setIsLoadingPolls(true);
    try {
      const [{ data: polls }, { data: myResponses }] = await Promise.all([
        supabase
          .from("polls")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: true }),
        supabase.from("poll_responses").select("poll_id"),
      ]);

      setActivePolls((polls as PollDB[]) || []);
      setAnsweredPollIds(
        new Set(((myResponses as { poll_id: string }[]) || []).map((r) => r.poll_id)),
      );
    } catch (err) {
      console.error("[usePollSystem] Falha ao carregar polls:", err);
    } finally {
      setIsLoadingPolls(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  // --- Pendências do usuário (targeting + não respondidas), admin nunca é alvo ---
  const userRulesets = new Set(
    (currentUser?.groupIds || [])
      .map((gid) => groups.find((g) => g.id === gid)?.ruleset)
      .filter((r): r is NonNullable<typeof r> => !!r),
  );

  const currentUserCreatedAt = users.find((u) => u.id === currentUser?.id)?.createdAt;

  const pendingPolls =
    !currentUser || currentUser.role === "ADMIN"
      ? []
      : activePolls.filter(
          (p) =>
            !answeredPollIds.has(p.id) &&
            userMatchesTarget(p.target_ruleset, userRulesets) &&
            registeredBeforePoll(currentUserCreatedAt, p.created_at),
        );

  // --- Submeter voto (voto travado: só insere, nunca atualiza) ---
  const submitResponse = useCallback(
    async (pollId: string, optionIndexes: number[]): Promise<boolean> => {
      if (!supabase || !currentUser || optionIndexes.length === 0) return false;
      const rows = optionIndexes.map((option_index) => ({
        poll_id: pollId,
        user_id: currentUser.id,
        option_index,
      }));
      const { error } = await supabase.from("poll_responses").insert(rows);
      if (error) {
        console.error("[usePollSystem] Falha ao registrar voto:", error);
        return false;
      }
      // Marca como respondida localmente → some do modal sem refetch.
      setAnsweredPollIds((prev) => new Set(prev).add(pollId));
      return true;
    },
    [currentUser],
  );

  // --- Lista completa (admin): ativas + fechadas ---
  const fetchAllPolls = useCallback(async (): Promise<Poll[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("polls")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[usePollSystem] Falha ao listar polls (admin):", error);
      return [];
    }
    return (data as PollDB[]) || [];
  }, []);

  // --- Resultados anônimos via RPC (uso do admin) ---
  const getPollResults = useCallback(
    async (poll: Poll): Promise<PollResults | null> => {
      if (!supabase) return null;
      const { data, error } = await supabase.rpc(rpcName("get_poll_results"), {
        p_poll_id: poll.id,
      });
      if (error) {
        console.error("[usePollSystem] Falha ao obter resultados:", error);
        return null;
      }
      const rows =
        (data as { option_index: number; votes: number; total_respondents: number }[]) ||
        [];
      const totalRespondents = rows[0]?.total_respondents ?? 0;
      const eligibleUsers = countEligibleUsers(poll.target_ruleset, poll.created_at);
      const votesByIndex = new Map(rows.map((r) => [r.option_index, Number(r.votes)]));
      return {
        pollId: poll.id,
        totalRespondents,
        eligibleUsers,
        participationRate: eligibleUsers > 0 ? totalRespondents / eligibleUsers : 0,
        options: poll.options.map((label, idx) => {
          const votes = votesByIndex.get(idx) ?? 0;
          return {
            optionIndex: idx,
            label,
            votes,
            percentage: totalRespondents > 0 ? votes / totalRespondents : 0,
          };
        }),
      };
    },
    [countEligibleUsers],
  );

  // --- Ações de admin ---
  const createPoll = useCallback(
    async (input: {
      question: string;
      options: string[];
      allowMultiple: boolean;
      targetRuleset: PollTargetRuleset;
    }): Promise<boolean> => {
      if (!supabase) return false;
      const { error } = await supabase.from("polls").insert({
        question: input.question,
        options: input.options,
        allow_multiple: input.allowMultiple,
        target_ruleset: input.targetRuleset,
        status: "active",
      });
      if (error) {
        console.error("[usePollSystem] Falha ao criar poll:", error);
        return false;
      }
      await loadPolls();
      return true;
    },
    [loadPolls],
  );

  const setPollStatus = useCallback(
    async (pollId: string, status: "active" | "closed"): Promise<boolean> => {
      if (!supabase) return false;
      const { error } = await supabase
        .from("polls")
        .update({ status })
        .eq("id", pollId);
      if (error) {
        console.error("[usePollSystem] Falha ao alterar status da poll:", error);
        return false;
      }
      await loadPolls();
      return true;
    },
    [loadPolls],
  );

  const deletePoll = useCallback(
    async (pollId: string): Promise<boolean> => {
      if (!supabase) return false;
      const { error } = await supabase.from("polls").delete().eq("id", pollId);
      if (error) {
        console.error("[usePollSystem] Falha ao excluir poll:", error);
        return false;
      }
      await loadPolls();
      return true;
    },
    [loadPolls],
  );

  return {
    activePolls,
    pendingPolls,
    isLoadingPolls,
    reloadPolls: loadPolls,
    fetchAllPolls,
    submitResponse,
    getPollResults,
    createPoll,
    setPollStatus,
    deletePoll,
  };
};
