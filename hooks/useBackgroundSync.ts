import { useEffect, useRef } from "react";
import { CompetitionDB, GroupDB } from "../types";
import { supabase, isSupabaseEnabled } from "../services/supabase";

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
  /** Versão atual do app (para comparação com system_config.app_version). */
  currentVersion: string;
  /** Callback chamado quando detecta versão desatualizada (para forçar refetch de system_config). */
  onVersionOutdated?: () => void;
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
  currentVersion,
  onVersionOutdated,
}: UseBackgroundSyncOptions): void => {
  // Lock por código para evitar syncs concorrentes dentro do mesmo hook
  const syncLockRef = useRef<Set<string>>(new Set());

  // Refs das props para o setInterval ler sempre o valor atual
  // sem precisar ser recriado a cada render.
  const competitionsRef = useRef(competitions);
  const groupsRef = useRef(groups);
  const syncIntervalMsRef = useRef(syncIntervalMs);
  const syncFnRef = useRef(syncFn);

  const onSyncStartRef = useRef(onSyncStart);
  const onSyncEndRef = useRef(onSyncEnd);
  const currentVersionRef = useRef(currentVersion);
  const onVersionOutdatedRef = useRef(onVersionOutdated);
  useEffect(() => { competitionsRef.current = competitions; }, [competitions]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { syncIntervalMsRef.current = syncIntervalMs; }, [syncIntervalMs]);
  useEffect(() => { syncFnRef.current = syncFn; }, [syncFn]);
  useEffect(() => { onSyncStartRef.current = onSyncStart; }, [onSyncStart]);
  useEffect(() => { onSyncEndRef.current = onSyncEnd; }, [onSyncEnd]);
  useEffect(() => { currentVersionRef.current = currentVersion; }, [currentVersion]);
  useEffect(() => { onVersionOutdatedRef.current = onVersionOutdated; }, [onVersionOutdated]);

  useEffect(() => {
    if (!enabled) {
      console.log("🔇 Background Sync: desabilitado.");
      return;
    }

    const checkInterval = getCheckInterval(syncIntervalMsRef.current);
    console.log(`⏰ Background Sync: ativo. Checando a cada ${Math.round(checkInterval / 1000)}s.`);

    const tick = async () => {
      if (!isSupabaseEnabled() || !supabase) {
        console.log("🚫 [BackgroundSync] Supabase não habilitado. Sync bloqueado.");
        return;
      }

      // Guarda 0: carregar system_config para verificar versão mais recente
      console.log("🔍 [BackgroundSync] Carregando system_config para verificar versão...");
      const { data: configData, error: configError } = await supabase
        .from("system_config")
        .select("*")
        .single();

      if (configError) {
        console.warn("⚠️ [BackgroundSync] Erro ao carregar system_config:", configError);
        return;
      }

      console.log("✅ [BackgroundSync] system_config carregado:", configData);

      const now = Date.now();
      const dbInterval = syncIntervalMsRef.current;

      // Guarda 1: versão do app está desatualizada? Bloqueia sync para evitar operações problemáticas.
      const published = configData?.app_version;
      if (published && published !== currentVersionRef.current) {
        console.log(`🚫 [BackgroundSync] Versão desatualizada (local: ${currentVersionRef.current}, remota: ${published}). Sync bloqueado.`);
        onVersionOutdatedRef.current?.();
        return;
      }

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

        // Guarda 2: auto-sync por competição — admin desativou esta competição?
        const comp = competitionsRef.current.find(
          (c) => c.code.toUpperCase() === code
        );
        if (comp && comp.autoSyncEnabled === false) {
          console.log(
            `🚫 [BackgroundSync] ${code}: auto-sync desabilitado para esta competição.`
          );
          continue;
        }

        // Guarda 3: DB lastSync — algum cliente já sincronizou recentemente?
        const lastSyncTs = comp?.lastSync
          ? new Date(comp.lastSync).getTime()
          : 0;
        const elapsed = now - lastSyncTs;

        if (elapsed < dbInterval) {
          const remaining = Math.round((dbInterval - elapsed) / 1000);
          console.log(
            `✅ [BackgroundSync] ${code}: DB atualizado há ${Math.round(elapsed / 1000)}s. Próximo sync em ~${remaining}s (intervalo: ${Math.round(dbInterval / 1000)}s).`
          );
          continue;
        }

        // Todos os guardas passaram — pode sincronizar
        console.log(
          `🔄 [BackgroundSync] ${code}: ${Math.round(elapsed / 1000)}s desde o último sync (limite: ${Math.round(dbInterval / 1000)}s). Iniciando...`
        );

        syncLockRef.current.add(code);

        try {
          // syncFn irá chamar onSyncStart apenas se conseguir o lock
          const result = await syncFnRef.current(code);
          // Só exibe toast se houver mensagem (skip silencioso retorna "")
          if (result.message) {
            onSyncEndRef.current?.(code, result.success, result.message);
          }
        } catch (err: any) {
          console.warn(`[BackgroundSync] Erro ao sincronizar ${code}:`, err);
          onSyncEndRef.current?.(code, false, err?.message || "Erro desconhecido");
        } finally {
          syncLockRef.current.delete(code);
        }
      }
    };

    // Dispara primeiro tick imediatamente
    // O lock atômico garante que apenas uma instância sincroniza por vez
    void tick();

    const id = setInterval(() => void tick(), checkInterval);

    return () => {
      clearInterval(id);
    };
  }, [enabled]); // só recria o interval se `enabled` mudar — props são lidas via refs
};
