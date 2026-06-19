import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * PROC — Processamento e persistência de pontos (`hooks/usePointsProcessor.ts`).
 *
 * Estes testes exercitam a lógica de recálculo com um mock de Supabase que
 * imita o query-builder encadeável (`from().select().eq()...`). Cada tabela
 * tem um dataset configurável e os upserts são capturados para asserção.
 *
 * Referência de regras: documentacao/business-rules.md §6.
 */

// ---------------------------------------------------------------------------
// Mock do Supabase: query-builder encadeável e thenable.
// Usamos `vi.hoisted` para que o estado exista quando a factory de vi.mock rodar.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  // Datasets por tabela, configuráveis em cada teste.
  const datasets: Record<string, any[]> = {};
  // Erros forçados por tabela (para testar fallback / continue).
  const tableErrors: Record<string, any> = {};
  // Captura de upserts: { table, rows, options }
  const upserts: Array<{ table: string; rows: any[]; options?: any }> = [];

  function applyFilters(rows: any[], filters: Record<string, any>): any[] {
    return rows.filter((r) =>
      Object.entries(filters).every(([col, val]) => {
        if (Array.isArray(val)) return val.includes(r[col]);
        return r[col] === val;
      }),
    );
  }

  function makeBuilder(table: string) {
    const filters: Record<string, any> = {};
    let single = false;
    let maybeSingle = false;

    const resolve = () => {
      if (tableErrors[table]) {
        return { data: null, error: tableErrors[table] };
      }
      const rows = applyFilters(datasets[table] || [], filters);
      if (single || maybeSingle) {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    };

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => {
        filters[col] = val;
        return builder;
      },
      in: (col: string, vals: any[]) => {
        filters[col] = vals;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      single: () => {
        single = true;
        return builder;
      },
      maybeSingle: () => {
        maybeSingle = true;
        return builder;
      },
      upsert: (rows: any[], options?: any) => {
        upserts.push({ table, rows, options });
        const err = tableErrors[`${table}:upsert`] || null;
        return Promise.resolve({ data: rows, error: err });
      },
      // Torna o builder "thenable" para `await supabase.from(...).select()...eq()`.
      then: (onFulfilled: any, onRejected?: any) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const mockSupabase = {
    from: (table: string) => makeBuilder(table),
  };

  return { datasets, tableErrors, upserts, mockSupabase };
});

const { datasets, tableErrors, upserts, mockSupabase } = h;

function resetDb() {
  for (const k of Object.keys(datasets)) delete datasets[k];
  for (const k of Object.keys(tableErrors)) delete tableErrors[k];
  upserts.length = 0;
}

vi.mock("../services/supabase", () => ({
  supabase: h.mockSupabase,
  isSupabaseEnabled: () => true,
}));

import { usePointsProcessor } from "./usePointsProcessor";

// ---------------------------------------------------------------------------
// Helpers de fixtures
// ---------------------------------------------------------------------------
const makeDbRef = (overrides: any = {}) => {
  const updateLocalUserGroups = vi.fn();
  const refetchPredictions = vi.fn().mockResolvedValue(undefined);
  return {
    current: {
      matches: [],
      teams: [
        { id: "t1", ranking: 1 },
        { id: "t2", ranking: 2 },
      ],
      groups: [
        { id: "g1", ruleset: "regulamento_1", competitionCode: "WC" },
      ],
      userGroups: [],
      predictions: [],
      systemConfig: { underdog_min_rank_diff: 10 },
      updateLocalUserGroups,
      refetchPredictions,
      ...overrides,
    },
  };
};

const finishedMatch = (id: string, home: number, away: number, extra: any = {}) => ({
  id,
  status: "FINISHED",
  resultHome: home,
  resultAway: away,
  homeTeamId: "t1",
  awayTeamId: "t2",
  stage: "GROUP_STAGE",
  group: "Grupo A",
  ...extra,
});

describe("usePointsProcessor — recalculateUserGroupPoints", () => {
  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  it("PROC-01: soma pontos de partidas para grupo R1 e grava em user_groups.points", async () => {
    datasets["matches"] = [finishedMatch("m1", 2, 1)];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 2, awayScore: 1, points: 0, tieWinnerTeamId: null },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = []; // sem resultados oficiais
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef();
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    expect(ugUpsert).toBeDefined();
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    expect(u1.points).toBe(10); // placar exato R1
  });

  it("PROC-02: R2 inclui bônus de placar isolado (+5) no total", async () => {
    datasets["matches"] = [finishedMatch("m1", 2, 1)];
    datasets["predictions"] = [
      // só u1 cravou o exato → +5 isolado; grupos exato R2 = 15
      { userId: "u1", matchId: "m1", groupId: "g2", homeScore: 2, awayScore: 1, points: 0 },
      { userId: "u2", matchId: "m1", groupId: "g2", homeScore: 0, awayScore: 0, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["extra_phase_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [
      { userId: "u1", groupId: "g2", role: "USER", joinedAt: "x" },
      { userId: "u2", groupId: "g2", role: "USER", joinedAt: "x" },
    ];

    const dbRef = makeDbRef({
      groups: [{ id: "g2", ruleset: "regulamento_2", competitionCode: "WC" }],
    });
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g2"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    expect(u1.points).toBe(20); // 15 exato + 5 isolado
  });

  it("PROC-03: ignora jogos não FINISHED ou com result nulo", async () => {
    datasets["matches"] = [
      { id: "m1", status: "SCHEDULED", resultHome: null, resultAway: null, homeTeamId: "t1", awayTeamId: "t2", stage: "GROUP_STAGE", group: "Grupo A" },
    ];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 2, awayScore: 1, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef();
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    expect(u1.points).toBe(0);
  });

  it("PROC-04: usa matches frescos do DB (não o estado React stale)", async () => {
    // DB tem o resultado correto; o estado React (dbRef) está vazio/stale.
    datasets["matches"] = [finishedMatch("m1", 1, 0)];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 1, awayScore: 0, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef({ matches: [] }); // estado local vazio de propósito
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    expect(u1.points).toBe(10); // veio do DB fresco, não do estado vazio
  });

  it("PROC-05: erro ao buscar matches → fallback para dbRef.current.matches", async () => {
    tableErrors["matches"] = { message: "boom" };
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 1, awayScore: 0, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef({
      matches: [finishedMatch("m1", 1, 0)], // estado local serve de fallback
    });
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    // Não deve lançar
    await expect(result.current.recalculateUserGroupPoints(["g1"])).resolves.toBeUndefined();

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    expect(u1.points).toBe(10); // calculado a partir do fallback local
  });

  it("PROC-06: erro ao buscar predictions do grupo → pula o grupo (sem upsert)", async () => {
    datasets["matches"] = [finishedMatch("m1", 1, 0)];
    tableErrors["predictions"] = { message: "fail predictions" };
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef();
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    // Como pulou via `continue`, nenhum upsert de user_groups deve acontecer
    expect(upserts.find((u) => u.table === "user_groups")).toBeUndefined();
  });

  it("PROC-07: grupo sem predictions mas com pontos existentes → pula update (anti-zeramento)", async () => {
    datasets["matches"] = [finishedMatch("m1", 1, 0)];
    datasets["predictions"] = []; // grupo sem predictions
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    // estado local indica que já há pontos persistidos
    const dbRef = makeDbRef({
      userGroups: [{ userId: "u1", groupId: "g1", points: 42 }],
    });
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    // Anti-zeramento: não deve haver upsert de user_groups
    expect(upserts.find((u) => u.table === "user_groups")).toBeUndefined();
  });

  it("PROC-08: upsert de predictions usa defaultToNull:false (preserva colunas ausentes)", async () => {
    datasets["matches"] = [finishedMatch("m1", 2, 1)];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 2, awayScore: 1, points: 0, tieWinnerTeamId: "t1" },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef();
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const predUpsert = upserts.find((u) => u.table === "predictions");
    expect(predUpsert).toBeDefined();
    expect(predUpsert!.options?.defaultToNull).toBe(false);
  });

  it("PROC-09: persiste predictions.points apenas quando o valor muda", async () => {
    datasets["matches"] = [finishedMatch("m1", 2, 1), finishedMatch("m2", 3, 0, { id: "m2" })];
    datasets["predictions"] = [
      // m1: já está com points corretos (10) → não deve entrar no upsert
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 2, awayScore: 1, points: 10 },
      // m2: points desatualizados → deve entrar no upsert
      { userId: "u1", matchId: "m2", groupId: "g1", homeScore: 3, awayScore: 0, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef();
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const predUpsert = upserts.find((u) => u.table === "predictions");
    expect(predUpsert).toBeDefined();
    const matchIds = predUpsert!.rows.map((r) => r.matchId);
    expect(matchIds).toContain("m2");
    expect(matchIds).not.toContain("m1"); // já estava correto
  });

  it("PROC-14: competição sem resultados oficiais → só pontua partidas", async () => {
    datasets["matches"] = [finishedMatch("m1", 1, 0)];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 1, awayScore: 0, points: 0 },
    ];
    // tournament_predictions presentes, mas sem competição (sem gabarito)
    datasets["tournament_predictions"] = [
      { userId: "u1", groupId: "g1", championTeamId: "t1" },
    ];
    datasets["competitions"] = []; // single() → data null
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef();
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    expect(u1.points).toBe(10); // só os pontos da partida, sem torneio
  });

  it("PROC-12: threshold underdog respeita precedência grupo > systemConfig", async () => {
    // Azarão (ranking pior) vence: t2 (ranking 2) sobre t1 (ranking 1) NÃO é azarão.
    // Invertendo: vencedor é t1 (ranking 1) — favorito — então sem bônus em qualquer caso.
    // Para exercitar o threshold, usamos rankings com diff grande e variamos o min.
    // homeTeam t1 ranking 1, awayTeam t2 ranking 2 (diff 1) → nunca dá bônus.
    // Usamos teams customizados com ranking distante.
    datasets["matches"] = [
      { id: "m1", status: "FINISHED", resultHome: 0, resultAway: 1, homeTeamId: "tf", awayTeamId: "tu", stage: "GROUP_STAGE", group: "Grupo A" },
    ];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 0, awayScore: 1, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    // tu (away) ranking 50 vence tf (home) ranking 5 → azarão por margem 45.
    // group.underdog_min_rank_diff = 100 (alto) deve SUPRIMIR o bônus,
    // mesmo com systemConfig.underdog_min_rank_diff = 0.
    const dbRef = makeDbRef({
      teams: [
        { id: "tf", ranking: 5 },
        { id: "tu", ranking: 50 },
      ],
      groups: [{ id: "g1", ruleset: "regulamento_1", competitionCode: "WC", underdog_min_rank_diff: 100 }],
      systemConfig: { underdog_min_rank_diff: 0 },
    });
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    // Threshold do grupo (100) > margem (45) → sem bônus → apenas placar exato 10.
    expect(u1.points).toBe(10);
  });

  it("PROC-12: sem threshold no grupo, usa systemConfig e concede bônus de azarão", async () => {
    datasets["matches"] = [
      { id: "m1", status: "FINISHED", resultHome: 0, resultAway: 1, homeTeamId: "tf", awayTeamId: "tu", stage: "GROUP_STAGE", group: "Grupo A" },
    ];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 0, awayScore: 1, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef({
      teams: [
        { id: "tf", ranking: 5 },
        { id: "tu", ranking: 50 },
      ],
      // grupo sem threshold → cai para systemConfig = 0 → margem 45 dá bônus
      groups: [{ id: "g1", ruleset: "regulamento_1", competitionCode: "WC" }],
      systemConfig: { underdog_min_rank_diff: 0 },
    });
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    // exato 10 + bônus azarão floor(45*0.03)=1 = 11
    expect(u1.points).toBe(11);
  });

  it("PROC-13: R2 pontua artilheiro comparando UUIDs (nunca por nome)", async () => {
    datasets["matches"] = [];
    datasets["predictions"] = [];
    datasets["extra_phase_predictions"] = [];
    // Palpite armazena o UUID do jogador, não o nome
    datasets["tournament_predictions"] = [
      { userId: "u1", groupId: "g2", topScorerPlayerId: "player-uuid-1", topScorerGoals: 6 },
    ];
    datasets["players"] = [{ id: "player-uuid-1", name: "Mbappe" }];
    datasets["competitions"] = [
      { code: "WC", topScorerName: "Mbappe", topScorerGoals: 6, topScorerPlayerIds: ["player-uuid-1"] },
    ];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g2", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef({
      groups: [{ id: "g2", ruleset: "regulamento_2", competitionCode: "WC" }],
    });
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g2"]);

    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    const u1 = ugUpsert!.rows.find((r) => r.userId === "u1");
    // artilheiro acertado sozinho no R2 = 60
    expect(u1.points).toBe(60);
  });

  it("PROC-15: refetchPredictions é chamado ao final do recálculo", async () => {
    datasets["matches"] = [finishedMatch("m1", 1, 0)];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 1, awayScore: 0, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const dbRef = makeDbRef();
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.recalculateUserGroupPoints(["g1"]);

    expect(dbRef.current.refetchPredictions).toHaveBeenCalled();
  });
});

describe("usePointsProcessor — batchProcessPointsForMatches (PROC-10)", () => {
  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  it("PROC-10: coleta apenas os grupos afetados e dispara recálculo deles", async () => {
    // DB fresco usado pelo recalc interno
    datasets["matches"] = [finishedMatch("m1", 1, 0)];
    datasets["predictions"] = [
      { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 1, awayScore: 0, points: 0 },
    ];
    datasets["tournament_predictions"] = [];
    datasets["competitions"] = [];
    datasets["user_groups"] = [{ userId: "u1", groupId: "g1", role: "USER", joinedAt: "x" }];

    const match: any = {
      id: "m1",
      status: "FINISHED",
      result: { home: 1, away: 0 },
      homeTeam: { id: "t1", ranking: 1 },
      awayTeam: { id: "t2", ranking: 2 },
      stage: "GROUP_STAGE",
      group: "Grupo A",
    };

    const dbRef = makeDbRef({
      // estado local com predictions que mapeiam para g1
      predictions: [
        { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 1, awayScore: 0, points: 0 },
      ],
    });
    const { result } = renderHook(() => usePointsProcessor(dbRef));

    await result.current.batchProcessPointsForMatches([match]);

    // Recálculo de g1 ocorreu → houve upsert para user_groups do grupo g1
    const ugUpsert = upserts.find((u) => u.table === "user_groups");
    expect(ugUpsert).toBeDefined();
    expect(ugUpsert!.rows.every((r) => r.groupId === "g1")).toBe(true);
  });
});

describe("usePointsProcessor — updateLocalPointsWithLive (PROC-11)", () => {
  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  it("PROC-11: projeta pontos de jogos LIVE localmente sem persistir no DB", async () => {
    const updateLocalUserGroups = vi.fn();
    const dbRef: any = {
      current: {
        matches: [
          {
            id: "m1",
            status: "LIVE",
            resultHome: 1,
            resultAway: 0,
            homeTeamId: "t1",
            awayTeamId: "t2",
            stage: "GROUP_STAGE",
            group: "Grupo A",
          },
        ],
        teams: [
          { id: "t1", ranking: 1 },
          { id: "t2", ranking: 2 },
        ],
        groups: [{ id: "g1", ruleset: "regulamento_1", competitionCode: "WC" }],
        userGroups: [{ userId: "u1", groupId: "g1", points: 0 }],
        predictions: [
          { userId: "u1", matchId: "m1", groupId: "g1", homeScore: 1, awayScore: 0 },
        ],
        systemConfig: { underdog_min_rank_diff: 10 },
        updateLocalUserGroups,
        refetchPredictions: vi.fn(),
      },
    };

    const { result } = renderHook(() => usePointsProcessor(dbRef));
    result.current.updateLocalPointsWithLive(["m1"]);

    // Atualiza estado local (sem upsert no DB)
    expect(updateLocalUserGroups).toHaveBeenCalled();
    const arg = updateLocalUserGroups.mock.calls[0][0];
    const u1 = arg.find((x: any) => x.userId === "u1");
    expect(u1.points).toBe(10); // placar exato projetado ao vivo
    expect(upserts.length).toBe(0); // nada persistido
  });
});
