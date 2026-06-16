import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * SYNC — Pipeline de sincronização (`hooks/useSyncSystem.ts`).
 *
 * DECISÃO DE COBERTURA (ver instruções do test-runner):
 * O pipeline completo de sync acopla MUITOS colaboradores externos:
 *   - `services/liveScoreService` (5+ funções de fetch via proxy /api/*)
 *   - `getWcRankingMap` (fetch de ranking)
 *   - `dbRef` (acquire_sync_lock / releaseSyncLock RPC + upserts + updaters locais)
 *   - `usePlayerSync.persistScorers`
 *   - lock atômico interno + estado de localStorage
 *
 * Um teste de integração fiel exigiria reconstruir toda a ordem de chamadas
 * (fases 1→1.5→1.6→2→3→4→5, fallback de season, 429→RATE_LIMIT, lock RPC),
 * ficando fortemente acoplado a detalhes de implementação e instável a cada
 * refactor. Isso viola a regra "teste comportamento, não implementação".
 *
 * Por isso, dos 14 casos SYNC (P0):
 *   - SYNC-09 (guarda de permissão: usuário comum não sincroniza manualmente)
 *     é implementado de verdade — é um early-return puro, sem fetch/Supabase.
 *   - Os demais ficam como `it.todo`, a serem cobertos por testes de integração
 *     dedicados (mock de liveScoreService + RPC de lock) ou E2E de admin.
 *
 * Para implementar os TODOs no futuro: mockar `../services/liveScoreService`
 * (cada fetch retornando payloads canônicos), `../services/supabase` (upserts +
 * RPC `acquire_sync_lock`), e injetar um `dbRef` com lock/locks helpers.
 */

// liveScoreService é mockado para que o módulo carregue sem tocar a rede.
vi.mock("../services/liveScoreService", () => ({
  fetchExternalStandings: vi.fn().mockResolvedValue([]),
  fetchExternalMatches: vi.fn().mockResolvedValue([]),
  fetchCompetitionTeams: vi.fn().mockResolvedValue([]),
  fetchLiveMatchMinutes: vi.fn().mockResolvedValue({}),
  fetchCompetitionScorers: vi.fn().mockResolvedValue([]),
  findInternalMatch: vi.fn(),
  getCurrentSeason: vi.fn().mockReturnValue("2026"),
  mapExternalStatusToInternal: vi.fn(),
  shouldUpdateByLastUpdated: vi.fn().mockReturnValue(true),
  isStaleApiData: vi.fn().mockReturnValue(false),
}));

vi.mock("../services/supabase", () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn() })), rpc: vi.fn() },
  isSupabaseEnabled: () => true,
}));

vi.mock("./usePlayerSync", () => ({
  persistScorers: vi.fn().mockResolvedValue({ synced: 0, extIdToUuid: new Map() }),
}));

import { useSyncSystem } from "./useSyncSystem";

const makeDbRef = () => ({
  current: {
    matches: [],
    teams: [],
    groups: [],
    userGroups: [],
    predictions: [],
    competitions: [],
    systemConfig: {},
    acquireSyncLock: vi.fn().mockResolvedValue(true),
    releaseSyncLock: vi.fn().mockResolvedValue(undefined),
    updateLocalMatches: vi.fn(),
    refetchPredictions: vi.fn().mockResolvedValue(undefined),
  },
});

describe("useSyncSystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("SYNC-09: usuário comum (canWriteData=false) é bloqueado no sync manual", async () => {
    const dbRef = makeDbRef();
    const { result } = renderHook(() =>
      useSyncSystem(
        "WC",
        /* canWriteData */ false,
        dbRef,
        vi.fn().mockResolvedValue({}),
        vi.fn().mockResolvedValue(undefined),
        vi.fn().mockResolvedValue(undefined),
      ),
    );

    const res = await result.current.syncMatchesAndStandings("WC", /* isManualRequest */ true);

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Somente administradores/i);
    // Não deve ter tentado adquirir lock nem persistir nada.
    expect(dbRef.current.acquireSyncLock).not.toHaveBeenCalled();
  });

  // --- TODOs: cobertura de integração futura (ver cabeçalho do arquivo) ---
  it.todo("SYNC-01: sync completo upserta matches/standings/scorers e atualiza lastSync");
  it.todo("SYNC-02: respeita a ordem das fases (1→1.5→1.6→2→3→4→5)");
  it.todo("SYNC-03: /api/live-matches só é chamado quando há jogo IN_PLAY/PAUSED");
  it.todo("SYNC-04: persistScorers reaproveita scorersData (0 fetch extra)");
  it.todo("SYNC-05: adquire lock e libera ao final (acquire/releaseSyncLock)");
  it.todo("SYNC-06: lock já tomado por outro cliente → aborta com aviso");
  it.todo("SYNC-07: 429 rate limit → erro RATE_LIMIT_<segundos>");
  it.todo("SYNC-08: 404/403 com season → refaz fetch sem season (fallback)");
  it.todo("SYNC-10: background sync respeita sync_interval_ms/lastSync");
  it.todo("SYNC-11: persistScorers falha (try/catch) → sync de jogos continua");
  it.todo("SYNC-12: jogo vira FINISHED no diff → dispara recálculo de pontos");
  it.todo("SYNC-13: upsert de matches dedup por externalMatchId/id");
  it.todo("SYNC-14: teams.code não único → upsert por externalTeamId");
});
