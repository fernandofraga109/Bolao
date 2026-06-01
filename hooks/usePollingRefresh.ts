import { useEffect, useRef } from "react";
import { Match, MatchStatus } from "../types";

const POLL_INTERVAL_MS = 15_000; // 15 segundos
const REFETCH_DELAY_MS = 2_000;  // delay após detectar mudança no placar

interface UsePollingRefreshOptions {
  matches: Match[];
  refetchMatches: () => Promise<void>;
  refetchPredictions: () => Promise<void>;
  refetchUserGroups: () => Promise<void>;
  enabled: boolean;
}

/**
 * usePollingRefresh
 *
 * Hook que faz polling da tabela `matches` a cada 15s.
 * Se detectar mudança no placar (resultHome, resultAway) ou status → FINISHED,
 * dispara automaticamente o refetch de predictions e user_groups para atualizar
 * o ranking — eliminando a necessidade de F5/pull-to-refresh quando o Realtime
 * não está funcionando.
 */
export const usePollingRefresh = ({
  matches,
  refetchMatches,
  refetchPredictions,
  refetchUserGroups,
  enabled,
}: UsePollingRefreshOptions): void => {
  const matchesRef = useRef(matches);
  const refetchMatchesRef = useRef(refetchMatches);
  const refetchPredictionsRef = useRef(refetchPredictions);
  const refetchUserGroupsRef = useRef(refetchUserGroups);

  useEffect(() => { matchesRef.current = matches; }, [matches]);
  useEffect(() => { refetchMatchesRef.current = refetchMatches; }, [refetchMatches]);
  useEffect(() => { refetchPredictionsRef.current = refetchPredictions; }, [refetchPredictions]);
  useEffect(() => { refetchUserGroupsRef.current = refetchUserGroups; }, [refetchUserGroups]);

  useEffect(() => {
    if (!enabled) {
      console.log("🔇 Polling Refresh: desabilitado.");
      return;
    }

    console.log(`⏰ Polling Refresh: ativo. Checando a cada ${POLL_INTERVAL_MS / 1000}s.`);

    const tick = async () => {
      const prevMatches = matchesRef.current;
      const prevMap = new Map(prevMatches.map((m) => [m.id, m]));

      try {
        await refetchMatchesRef.current();
      } catch (err) {
        console.warn("[PollingRefresh] Erro ao refetch matches:", err);
        return;
      }

      // Compara o estado anterior com o novo (lido via matchesRef após refetch)
      const nextMatches = matchesRef.current;
      let hasMeaningfulChange = false;

      for (const next of nextMatches) {
        const prev = prevMap.get(next.id);
        if (!prev) continue;

        const scoreChanged =
          (prev.result?.home ?? null) !== (next.result?.home ?? null) ||
          (prev.result?.away ?? null) !== (next.result?.away ?? null);

        const statusChangedToFinished =
          prev.status !== MatchStatus.FINISHED &&
          next.status === MatchStatus.FINISHED;

        if (scoreChanged || statusChangedToFinished) {
          console.log(
            `[PollingRefresh] Mudança detectada no jogo ${next.id}: ` +
            `placar (${prev.result?.home ?? '-'}x${prev.result?.away ?? '-'} → ${next.result?.home ?? '-'}x${next.result?.away ?? '-'}), ` +
            `status (${prev.status} → ${next.status})`
          );
          hasMeaningfulChange = true;
          break;
        }
      }

      if (hasMeaningfulChange) {
        // Pequeno delay para dar tempo ao backend de recalcular os pontos
        setTimeout(() => {
          console.log("[PollingRefresh] Refetching predictions + user_groups...");
          void refetchPredictionsRef.current();
          void refetchUserGroupsRef.current();
        }, REFETCH_DELAY_MS);
      }
    };

    const id = setInterval(() => void tick(), POLL_INTERVAL_MS);

    // Tick inicial com delay curto para não competir com o boot
    const initialId = setTimeout(() => void tick(), 5_000);

    return () => {
      clearTimeout(initialId);
      clearInterval(id);
    };
  }, [enabled]);
};
