import { describe, it, expect } from "vitest";
import {
  calculatePoints,
  calculateUnderdogBonus,
  calculateTournamentPoints,
  POINTS_EXACT,
  POINTS_GOAL_DIFF,
  POINTS_OUTCOME,
  POINTS_WRONG,
} from "./scoring";

describe("calculatePoints", () => {
  describe("placar exato", () => {
    it("retorna 10 pontos quando o palpite é idêntico ao resultado", () => {
      expect(calculatePoints(2, 1, 2, 1)).toBe(POINTS_EXACT);
    });

    it("retorna 10 pontos para empate exato", () => {
      expect(calculatePoints(0, 0, 0, 0)).toBe(POINTS_EXACT);
    });

    it("retorna 10 pontos para placar exato com números altos", () => {
      expect(calculatePoints(4, 3, 4, 3)).toBe(POINTS_EXACT);
    });
  });

  describe("diferença de gols correta", () => {
    it("retorna 7 pontos quando acerta a diferença mas não o placar", () => {
      expect(calculatePoints(3, 1, 2, 0)).toBe(POINTS_GOAL_DIFF);
    });

    it("retorna 7 pontos para empate com diferença correta (0-0 vs 1-1)", () => {
      expect(calculatePoints(0, 0, 1, 1)).toBe(POINTS_GOAL_DIFF);
    });
  });

  describe("resultado correto (vencedor certo)", () => {
    it("retorna 5 pontos quando acerta o vencedor mas não a diferença", () => {
      expect(calculatePoints(1, 0, 3, 1)).toBe(POINTS_OUTCOME);
    });

    it("retorna 7 pontos para empate com diferença de gols zero (1-1 vs 2-2)", () => {
      // Ambos empates têm diff=0, portanto acerta diff além do resultado → POINTS_GOAL_DIFF
      expect(calculatePoints(1, 1, 2, 2)).toBe(POINTS_GOAL_DIFF);
    });

    it("retorna 5 pontos para empate previsto mas placar com diff diferente (0-0 vs 2-1)", () => {
      // Previu empate mas saiu vitória → errou resultado
      expect(calculatePoints(0, 0, 2, 1)).toBe(POINTS_WRONG);
    });
  });

  describe("palpite errado", () => {
    it("retorna 0 pontos quando o resultado é oposto", () => {
      expect(calculatePoints(2, 0, 0, 1)).toBe(POINTS_WRONG);
    });

    it("retorna 0 pontos quando prevê empate mas há vencedor", () => {
      expect(calculatePoints(1, 1, 2, 0)).toBe(POINTS_WRONG);
    });

    it("retorna 0 pontos quando prevê vencedor mas é empate", () => {
      expect(calculatePoints(2, 0, 1, 1)).toBe(POINTS_WRONG);
    });
  });

  describe("bônus zebra", () => {
    it("adiciona bônus quando o time azarão (ranking pior) vence", () => {
      // Ranking 50 vs 1 — time de ranking 50 ganha (azarão)
      const pts = calculatePoints(0, 1, 0, 1, 1, 50);
      expect(pts).toBeGreaterThan(POINTS_EXACT);
    });

    it("não adiciona bônus quando o favorito vence", () => {
      // Time ranking 1 vence time ranking 50
      const pts = calculatePoints(1, 0, 1, 0, 1, 50);
      expect(pts).toBe(POINTS_EXACT);
    });

    it("não adiciona bônus em empate", () => {
      const pts = calculatePoints(1, 1, 1, 1, 1, 50);
      expect(pts).toBe(POINTS_EXACT);
    });

    it("não adiciona bônus quando a diferença de ranking é pequena (≤10)", () => {
      const pts = calculatePoints(0, 1, 0, 1, 5, 10);
      expect(pts).toBe(POINTS_EXACT);
    });

    it("não adiciona bônus quando rankings são undefined", () => {
      const pts = calculatePoints(1, 0, 1, 0);
      expect(pts).toBe(POINTS_EXACT);
    });

    it("adiciona bônus com minRankDiff customizado menor (5) quando diff entre rankings está entre 5 e 10", () => {
      // ranking 20 vs 10 → diff = 10 > 5, azarão (rank 20) vence
      const ptsCustom = calculatePoints(0, 1, 0, 1, 10, 20, 5);
      expect(ptsCustom).toBeGreaterThan(POINTS_EXACT);
    });

    it("não adiciona bônus com minRankDiff padrão quando diff entre rankings é exatamente 10", () => {
      // ranking 20 vs 10 → diff = 10, que não é > 10 (padrão), então sem bônus
      const ptsDefault = calculatePoints(0, 1, 0, 1, 10, 20);
      expect(ptsDefault).toBe(POINTS_EXACT);
    });

    it("com minRankDiff = 0, azarão por qualquer margem gera bônus", () => {
      // ranking 2 vs 1 → diff = 1 > 0, azarão vence
      const pts = calculatePoints(0, 1, 0, 1, 1, 2, 0);
      expect(pts).toBeGreaterThan(POINTS_EXACT);
    });

    it("comportamento com minRankDiff padrão é idêntico a passar minRankDiff = 10 explicitamente", () => {
      // ranking 50 vs 1 — azarão vence; comparar omitir vs passar 10
      const ptsDefault = calculatePoints(0, 1, 0, 1, 1, 50);
      const ptsExplicit = calculatePoints(0, 1, 0, 1, 1, 50, 10);
      expect(ptsDefault).toBe(ptsExplicit);
    });
  });
});

describe("calculateUnderdogBonus", () => {
  it("retorna 0 quando os rankings são undefined", () => {
    expect(calculateUnderdogBonus(undefined, undefined)).toBe(0);
  });

  it("retorna 0 quando o favorito vence (ranking menor ganha)", () => {
    expect(calculateUnderdogBonus(1, 50)).toBe(0);
  });

  it("retorna 0 quando a diferença é menor ou igual a 10", () => {
    expect(calculateUnderdogBonus(20, 10)).toBe(0);
  });

  it("calcula bônus proporcional à diferença de ranking", () => {
    const bonus = calculateUnderdogBonus(50, 1);
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThanOrEqual(5);
  });

  it("limita o bônus máximo em 5", () => {
    const bonus = calculateUnderdogBonus(200, 1);
    expect(bonus).toBe(5);
  });

  describe("minRankDiff customizado", () => {
    it("dispara bônus quando diff está acima do minRankDiff customizado (5)", () => {
      // ranking 20 vs 10 → diff = 10, que é > 5, então deve dar bônus
      const bonus = calculateUnderdogBonus(20, 10, 5);
      expect(bonus).toBeGreaterThan(0);
    });

    it("não dispara bônus quando diff é igual ao minRankDiff customizado (5)", () => {
      // ranking 15 vs 10 → diff = 5, que não é > 5, então sem bônus
      const bonus = calculateUnderdogBonus(15, 10, 5);
      expect(bonus).toBe(0);
    });

    it("não dispara bônus quando diff está abaixo do minRankDiff customizado (5)", () => {
      // ranking 13 vs 10 → diff = 3, que não é > 5, então sem bônus
      const bonus = calculateUnderdogBonus(13, 10, 5);
      expect(bonus).toBe(0);
    });

    it("com minRankDiff = 0, qualquer vitória de azarão gera bônus", () => {
      // ranking 2 vs 1 → diff = 1, que é > 0, então deve dar bônus
      const bonus = calculateUnderdogBonus(2, 1, 0);
      expect(bonus).toBeGreaterThan(0);
    });

    it("com minRankDiff = 0, diff de 1 posição gera bônus mínimo de 1", () => {
      // diff = 1, factor = 0.25 → ceil(0.25) = 1
      const bonus = calculateUnderdogBonus(2, 1, 0);
      expect(bonus).toBe(1);
    });

    it("comportamento padrão sem passar minRankDiff é igual a passar minRankDiff = 10", () => {
      // diff = 10 (ranking 20 vs 10) — não deve acionar bônus com o padrão de 10
      const bonusDefault = calculateUnderdogBonus(20, 10);
      const bonusExplicit = calculateUnderdogBonus(20, 10, 10);
      expect(bonusDefault).toBe(bonusExplicit);
    });
  });
});

describe("calculateTournamentPoints", () => {
  it("retorna 0 quando prediction é undefined", () => {
    expect(calculateTournamentPoints(undefined, { championTeamId: "br" })).toBe(0);
  });

  it("retorna 0 quando actual é undefined", () => {
    expect(calculateTournamentPoints({ championTeamId: "br" }, undefined)).toBe(0);
  });

  it("pontua campeão correto", () => {
    const pts = calculateTournamentPoints(
      { championTeamId: "brasil" },
      { championTeamId: "brasil" }
    );
    expect(pts).toBe(100);
  });

  it("não pontua campeão errado", () => {
    const pts = calculateTournamentPoints(
      { championTeamId: "brasil" },
      { championTeamId: "argentina" }
    );
    expect(pts).toBe(0);
  });

  it("acumula pontos de múltiplas previsões corretas", () => {
    const pts = calculateTournamentPoints(
      {
        championTeamId: "brasil",
        topScorer: { player: "Vini Jr", goals: 8 },
      },
      {
        championTeamId: "brasil",
        topScorer: { player: "Vini Jr", goals: 8 },
      }
    );
    expect(pts).toBe(300); // campeão + artilheiro nome + artilheiro gols
  });

  it("é case-insensitive para nomes de artilheiro", () => {
    const pts = calculateTournamentPoints(
      { topScorer: { player: "VINI JR" } },
      { topScorer: { player: "vini jr" } }
    );
    expect(pts).toBe(100);
  });
});
