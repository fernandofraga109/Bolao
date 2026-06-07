import { useEffect, useRef } from "react";
import { CompetitionDB, GroupDB } from "../types";

// Cooldown mínimo entre tentativas DESTE cliente, independente do DB.
// Protege contra loops causados por re-renders, remounts ou falhas de sync.
const CLIENT_COOLDOWN_MS = 60 * 1000; // 1 minuto

// Calcula o intervalo de checagem proporcional ao syncIntervalMs configurado pelo admin.
// Checa com frequência suficiente para não perder o momento do sync, mas não gasta ciclos.
const getCheckInterval = (syncIntervalMs: number): number => {
  const half = Math.floor(syncIntervalMs / 2);
  return Math.max(Math.min(half, 60_000), 5_000); // entre 5s e 60s
};

interface UseBackgroundSyncOptions {
  /** Lista de competições disponíveis (com campo lastSync). */
  competitions: CompetitionDB[];
  /** Grupos criados — usados para descobrir quais códigos de competição estão ativos. */
  groups: GroupDB[];
  /** Intervalo configurado pelo admin (em ms) após o qual o sync é considerado expirado. */
  syncIntervalMs: number;
  /** Função de sync a ser chamada quando o intervalo expirar. */
  syncFn: (competitionCode: string) => Promise<{ success: boolean; message: string }>;
  /** Se false, o hook fica pausado (ex: auto-sync desabilitado pelo admin). */
  enabled: boolean;
  /** Callback chamado quando um sync é iniciado (para exibir feedback visual). */
  onSyncStart?: (competitionCode: string) => void;
  /** Callback chamado quando um sync termina (para exibir resultado). */
  onSyncEnd?: (competitionCode: string, success: boolean, message: string) => void;
}

/**
 * useBackgroundSync
 *
 * Hook passivo que roda para QUALQUER usuário autenticado.
 * A cada intervalo de checagem (proporcional ao syncIntervalMs do admin), verifica
 * duas condições antes de sincronizar:
 *
 * 1. Cooldown local (CLIENT_COOLDOWN_MS): este cliente já tentou recentemente?
 *    Protege contra re-renders/remounts freqüentes e loops após falhas.
 *
 * 2. DB lastSync (syncIntervalMs): algum cliente já sincronizou recentemente?
 *    Evita trabalho redundante quando outro usuário já fez o sync.
 *
 * Não dispara tick() imediatamente no mount — apenas após o primeiro intervalo.
 * Isso é intencional: evita corridas com o Supabase auth/Realtime na inicialização.
 */
export const useBackgroundSync = ({
  competitions,
  groups,
  syncIntervalMs,
  syncFn,
  enabled,
  onSyncStart,
  onSyncEnd,
}: UseBackgroundSyncOptions): void => {
  // Lock por código para evitar syncs concorrentes dentro do mesmo hook
  const syncLockRef = useRef<Set<string>>(new Set());

  // Registra o timestamp da última TENTATIVA (sucesso ou falha) por código.
  // Persiste entre re-renders, mas não entre remounts do hook.
  // Garante que falhas não causem um loop de retentativas imediatas.
  const lastAttemptedAtRef = useRef<Map<string, number>>(new Map());

  // Refs das props para o setInterval ler sempre o valor atual
  // sem precisar ser recriado a cada render.
  const competitionsRef = useRef(competitions);
  const groupsRef = useRef(groups);
  const syncIntervalMsRef = useRef(syncIntervalMs);
  const syncFnRef = useRef(syncFn);

  const onSyncStartRef = useRef(onSyncStart);
  const onSyncEndRef = useRef(onSyncEnd);
  useEffect(() => { competitionsRef.current = competitions; }, [competitions]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { syncIntervalMsRef.current = syncIntervalMs; }, [syncIntervalMs]);
  useEffect(() => { syncFnRef.current = syncFn; }, [syncFn]);
  useEffect(() => { onSyncStartRef.current = onSyncStart; }, [onSyncStart]);
  useEffect(() => { onSyncEndRef.current = onSyncEnd; }, [onSyncEnd]);

  useEffect(() => {
    if (!enabled) {
      console.log("🔇 Background Sync: desabilitado.");
      return;
    }

    const checkInterval = getCheckInterval(syncIntervalMsRef.current);
    console.log(`⏰ Background Sync: ativo. Checando a cada ${Math.round(checkInterval / 1000)}s.`);

    const tick = async () => {
      const now = Date.now();
      const dbInterval = syncIntervalMsRef.current;

      // Descobre quais competições estão em uso nos grupos ativos
      const activeCodes = Array.from(
        new Set(
          groupsRef.current.map((g) =>
            (g.competitionCode || "WC").toUpperCase()
          )
        )
      );

      if (activeCodes.length === 0) return;

      for (const code of activeCodes) {
        // Guarda 1: já tem um sync em andamento para este código neste cliente?
        if (syncLockRef.current.has(code)) {
          console.log(`⏳ [BackgroundSync] ${code}: sync já em andamento. Pulando.`);
          continue;
        }

        // Guarda 2: cooldown local — este cliente tentou recentemente?
        const lastAttempted = lastAttemptedAtRef.current.get(code) ?? 0;
        const timeSinceAttempt = now - lastAttempted;
        if (timeSinceAttempt < CLIENT_COOLDOWN_MS) {
          const remainingCooldown = Math.round((CLIENT_COOLDOWN_MS - timeSinceAttempt) / 1000);
          console.log(
            `🛡️ [BackgroundSync] ${code}: cooldown local ativo. Próxima tentativa em ~${remainingCooldown}s.`
          );
          continue;
        }

        // Guarda 3: auto-sync por competição — admin desativou esta competição?
        const comp = competitionsRef.current.find(
          (c) => c.code.toUpperCase() === code
        );
        if (comp && comp.autoSyncEnabled === false) {
          console.log(
            `🚫 [BackgroundSync] ${code}: auto-sync desabilitado para esta competição.`
          );
          continue;
        }

        // Guarda 4: DB lastSync — algum cliente já sincronizou recentemente?
        const lastSyncTs = comp?.lastSync
          ? new Date(comp.lastSync).getTime()
          : 0;
        const elapsed = now - lastSyncTs;

        if (elapsed <= dbInterval) {
          const remaining = Math.round((dbInterval - elapsed) / 1000);
          console.log(
            `✅ [BackgroundSync] ${code}: DB atualizado há ${Math.round(elapsed / 1000)}s. Próximo sync em ~${remaining}s.`
          );
          continue;
        }

        // Todos os guardas passaram — pode sincronizar
        console.log(
          `🔄 [BackgroundSync] ${code}: ${Math.round(elapsed / 1000)}s desde o último sync (limite: ${Math.round(dbInterval / 1000)}s). Iniciando...`
        );

        // Registra a tentativa ANTES de iniciar (mesmo que falhe, o cooldown local se aplica)
        lastAttemptedAtRef.current.set(code, now);
        syncLockRef.current.add(code);

        // Notifica o pai que o sync iniciou (para mostrar toast de "sincronizando")
        onSyncStartRef.current?.(code);

        try {
          const result = await syncFnRef.current(code);
          onSyncEndRef.current?.(code, result.success, result.message);
        } catch (err: any) {
          console.warn(`[BackgroundSync] Erro ao sincronizar ${code}:`, err);
          onSyncEndRef.current?.(code, false, err?.message || "Erro desconhecido");
        } finally {
          syncLockRef.current.delete(code);
        }
      }
    };

    // Dispara um tick inicial com jitter para espalhar checagens entre
    // múltiplas abas abertas simultaneamente. Isso reduz corridas onde N
    // usuários checam o lastSync ao mesmo tempo e todos decidem syncar.
    const initialDelay = 20_000 + Math.random() * 30_000; // 20-50s
    const initialId = setTimeout(() => void tick(), initialDelay);

    const id = setInterval(() => void tick(), checkInterval);

    return () => {
      clearTimeout(initialId);
      clearInterval(id);
    };
  }, [enabled]); // só recria o interval se `enabled` mudar — props são lidas via refs
};
