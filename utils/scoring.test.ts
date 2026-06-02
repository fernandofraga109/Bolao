import { describe, it, expect } from "vitest";
import {
  calculatePoints,
  calculateUnderdogBonus,
  calculateTournamentPoints,
  calculatePointsRegulamento2,
  calculateTournamentPointsRegulamento2,
  calculateExtraPhasePoints,
  getScoreCategoryRegulamento1,
  getScoreCategoryRegulamento2,
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

    it("adiciona bônus com minRankDiff customizado menor (5) quando diff entre rankings está acima de 5", () => {
      // ranking 40 vs 5 → diff = 35 > 5, azarão (rank 40) vence, Math.floor(35 * 0.03) = 1
      const ptsCustom = calculatePoints(0, 1, 0, 1, 5, 40, 5);
      expect(ptsCustom).toBeGreaterThan(POINTS_EXACT);
    });

    it("não adiciona bônus com minRankDiff padrão quando diff entre rankings é exatamente 10", () => {
      // ranking 20 vs 10 → diff = 10, que não é > 10 (padrão), então sem bônus
      const ptsDefault = calculatePoints(0, 1, 0, 1, 10, 20);
      expect(ptsDefault).toBe(POINTS_EXACT);
    });

    it("com minRankDiff = 0, azarão por qualquer margem gera bônus", () => {
      // ranking 50 vs 1 → diff = 49 > 0, azarão vence, Math.floor(49 * 0.03) = 1
      const pts = calculatePoints(0, 1, 0, 1, 1, 50, 0);
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
      // ranking 40 vs 5 → diff = 35, que é > 5, então deve dar bônus (Math.floor(35 * 0.03) = 1)
      const bonus = calculateUnderdogBonus(40, 5, 5);
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
      // ranking 35 vs 1 → diff = 34, que é > 0, então deve dar bônus (Math.floor(34 * 0.03) = 1)
      const bonus = calculateUnderdogBonus(35, 1, 0);
      expect(bonus).toBeGreaterThan(0);
    });

    it("com minRankDiff = 0, diff de 1 posição gera bônus mínimo", () => {
      // diff = 1, factor = 0.03 → Math.floor(0.03) = 0
      const bonus = calculateUnderdogBonus(2, 1, 0);
      expect(bonus).toBe(0);
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
      { topScorer: { player: "VINI JR", goals: 0 } },
      { topScorer: { player: "vini jr", goals: 0 } }
    );
    expect(pts).toBe(100);
  });
});

describe("calculatePointsRegulamento2", () => {
  const matchPredsMock = [
    { userId: "u1", homeScore: 2, awayScore: 1 },
    { userId: "u2", homeScore: 1, awayScore: 1 },
    { userId: "u3", homeScore: 0, awayScore: 2 },
  ];

  it("retorna pontos de placar exato e bônus de placar sozinho (+5) se for o único no grupo", () => {
    // Fase de grupos: Exato = 15. Apenas u1 apostou 2-1 (exato)
    const pts = calculatePointsRegulamento2(2, 1, 2, 1, "groups", matchPredsMock, "u1");
    expect(pts).toBe(20); // 15 + 5
  });

  it("retorna apenas pontos de placar exato (sem bônus de placar sozinho) se outros acertaram", () => {
    const sharedPreds = [
      { userId: "u1", homeScore: 2, awayScore: 1 },
      { userId: "u2", homeScore: 2, awayScore: 1 },
    ];
    const pts = calculatePointsRegulamento2(2, 1, 2, 1, "groups", sharedPreds, "u1");
    expect(pts).toBe(15); // Sem +5 de bônus
  });

  it("não concede bônus de saldo de gols para empates", () => {
    // Resultado real = 1-1 (empate)
    // Palpite = 2-2 (empate mas não exato)
    // Pelo regulamento 2, ganha apenas Resultado (10 pts), não Saldo (13 pts)
    const pts = calculatePointsRegulamento2(2, 2, 1, 1, "groups", matchPredsMock, "u1");
    expect(pts).toBe(10);
  });

  it("retorna pontos de diferença de gols para vitórias com diferença correta", () => {
    // Resultado real = 2-0 (vitória com diff = 2)
    // Palpite = 3-1 (vitória com diff = 2)
    // Fase de oitavas (ko): Saldo = 13 pts
    const pts = calculatePointsRegulamento2(3, 1, 2, 0, "ko", matchPredsMock, "u1");
    expect(pts).toBe(13);
  });

  it("retorna pontos corretos para as diferentes fases (Terceiro Lugar e Final)", () => {
    // Precisamos um mock onde u1 seja o ÚNICO a acertar o placar exato
    const aloneMatchPreds = [
      { userId: "u1", homeScore: 1, awayScore: 0 },
      { userId: "u2", homeScore: 2, awayScore: 1 },
      { userId: "u3", homeScore: 0, awayScore: 2 },
    ];

    // 3º Lugar: Exato = 17, se for sozinho = 22
    const pts3 = calculatePointsRegulamento2(1, 0, 1, 0, "third_place", aloneMatchPreds, "u1");
    expect(pts3).toBe(22);

    // Final: Exato = 22, se for sozinho = 27
    const ptsFinal = calculatePointsRegulamento2(1, 0, 1, 0, "final", aloneMatchPreds, "u1");
    expect(ptsFinal).toBe(27);
  });
});

describe("calculateTournamentPointsRegulamento2", () => {
  const groupTournMock = [
    { userId: "u1", championTeamId: "bra", topScorerPlayer: "Neymar" },
    { userId: "u2", championTeamId: "fra", topScorerPlayer: "Mbappe" },
    { userId: "u3", championTeamId: "bra", topScorerPlayer: "Messi" },
  ];

  it("pontua campeão com rateio proporcional a quem acertou no grupo", () => {
    // u1 e u3 acertaram 'bra' (2 acertam = 70 pontos cada)
    const actual = { championTeamId: "bra" };
    const ptsU1 = calculateTournamentPointsRegulamento2(
      { championTeamId: "bra" },
      actual,
      groupTournMock,
      "u1"
    );
    expect(ptsU1).toBe(70);
  });

  it("pontua campeão com 100 pontos se for o único a acertar no grupo", () => {
    // Apenas u2 acertou 'fra' (1 acerta = 100 pontos)
    const actual = { championTeamId: "fra" };
    const ptsU2 = calculateTournamentPointsRegulamento2(
      { championTeamId: "fra" },
      actual,
      groupTournMock,
      "u2"
    );
    expect(ptsU2).toBe(100);
  });

  it("pontua artilheiro com rateio proporcional", () => {
    // Apenas u2 apostou 'Mbappe' (1 acerta = 60 pontos)
    const actual = { topScorer: { player: "Mbappe", goals: 6 } };
    const ptsU2 = calculateTournamentPointsRegulamento2(
      { topScorer: { player: "Mbappe", goals: 6 } },
      actual,
      groupTournMock,
      "u2"
    );
    expect(ptsU2).toBe(60);
  });

  it("pontua palpites extras pré-copa adicionais (Melhor Ataque / Pior Defesa)", () => {
    const prediction = {
      championTeamId: "fra",
      mostGoalsTeamId: "ger",
      mostConcededTeamId: "pan",
    };
    const actual = {
      championTeamId: "fra",
      mostGoalsTeamId: "ger",
      mostConcededTeamId: "pan",
    };
    // u2 acerta campeão sozinho (100) + maior ataque (20) + pior defesa (20) = 140 pts
    const pts = calculateTournamentPointsRegulamento2(
      prediction,
      actual,
      groupTournMock,
      "u2"
    );
    expect(pts).toBe(140);
  });

  it("pontua classificados de fase com 10 pts para grupo normal e 5 pts para Oitavas, Quartas e Semis", () => {
    const prediction = {
      groupClassifications: {
        "Grupo A": ["bra", "arg"], // 2 corretos
        "Oitavas": ["bra", "arg", "fra", "ger"], // 4 no palpite
        "Quartas": ["bra", "arg"], // 2 no palpite
      },
    };
    const actual = {
      groupClassifications: {
        "Grupo A": ["bra", "arg"], // bra, arg = 20 pts
        "Oitavas": ["bra", "fra", "ita", "esp"], // bra, fra corretos = 2 * 5 = 10 pts
        "Quartas": ["arg", "esp"], // arg correto = 1 * 5 = 5 pts
      },
    };
    const pts = calculateTournamentPointsRegulamento2(
      prediction as any,
      actual as any,
      groupTournMock,
      "u2"
    );
    // 20 (Grupo A) + 10 (Oitavas) + 5 (Quartas) = 35 pts
    expect(pts).toBe(35);
  });
});

describe("getScoreCategoryRegulamento1", () => {
  it("classifica como exact para placar idêntico", () => {
    const cat = getScoreCategoryRegulamento1(2, 1, 2, 1);
    expect(cat.type).toBe("exact");
    expect(cat.underdogBonus).toBe(0);
  });

  it("classifica como diff quando acerta diferença mas não o placar", () => {
    const cat = getScoreCategoryRegulamento1(3, 1, 2, 0);
    expect(cat.type).toBe("diff");
    expect(cat.underdogBonus).toBe(0);
  });

  it("classifica como outcome quando acerta apenas o vencedor", () => {
    const cat = getScoreCategoryRegulamento1(1, 0, 3, 1);
    expect(cat.type).toBe("outcome");
  });

  it("classifica como wrong quando erra o resultado", () => {
    const cat = getScoreCategoryRegulamento1(2, 0, 0, 1);
    expect(cat.type).toBe("wrong");
    expect(cat.underdogBonus).toBe(0);
  });

  it("retorna underdogBonus > 0 quando azarão vence e rankings diferem", () => {
    const cat = getScoreCategoryRegulamento1(0, 1, 0, 1, 1, 50);
    expect(cat.type).toBe("exact");
    expect(cat.underdogBonus).toBeGreaterThan(0);
  });
});

describe("getScoreCategoryRegulamento2", () => {
  const matchPredsMock = [
    { userId: "u1", homeScore: 2, awayScore: 1 },
    { userId: "u2", homeScore: 1, awayScore: 1 },
    { userId: "u3", homeScore: 0, awayScore: 2 },
  ];

  it("classifica como exact para placar idêntico", () => {
    const cat = getScoreCategoryRegulamento2(2, 1, 2, 1, "groups", matchPredsMock, "u1");
    expect(cat.type).toBe("exact");
    expect(cat.aloneBonus).toBe(true); // só u1 acertou
  });

  it("classifica como exact sem aloneBonus se outros também acertaram", () => {
    const sharedPreds = [
      { userId: "u1", homeScore: 2, awayScore: 1 },
      { userId: "u2", homeScore: 2, awayScore: 1 },
    ];
    const cat = getScoreCategoryRegulamento2(2, 1, 2, 1, "groups", sharedPreds, "u1");
    expect(cat.type).toBe("exact");
    expect(cat.aloneBonus).toBe(false);
  });

  it("classifica como outcome para empate não exato", () => {
    const cat = getScoreCategoryRegulamento2(2, 2, 1, 1, "groups", matchPredsMock, "u1");
    expect(cat.type).toBe("outcome");
    expect(cat.aloneBonus).toBe(false);
  });

  it("classifica como diff para vitória com diferença correta", () => {
    const cat = getScoreCategoryRegulamento2(3, 1, 2, 0, "ko", matchPredsMock, "u1");
    expect(cat.type).toBe("diff");
    expect(cat.aloneBonus).toBe(false);
  });

  it("classifica como wrong quando erra tudo", () => {
    const cat = getScoreCategoryRegulamento2(0, 2, 2, 0, "groups", matchPredsMock, "u1");
    expect(cat.type).toBe("wrong");
    expect(cat.aloneBonus).toBe(false);
  });
});

describe("calculateExtraPhasePoints", () => {
  const matchesMock = [
    { id: "m1", resultHome: 3, resultAway: 0, status: "FINISHED" }, // diff = 3
    { id: "m2", resultHome: 1, resultAway: 1, status: "FINISHED" }, // diff = 0
    { id: "m3", resultHome: 4, resultAway: 2, status: "FINISHED" }, // diff = 2
  ];

  it("concede 20 pontos se o palpite corresponder ao jogo de maior saldo da fase", () => {
    const userPred = { phase: "groups", matchId: "m1" };
    const pts = calculateExtraPhasePoints(userPred, matchesMock);
    expect(pts).toBe(20);
  });

  it("concede 0 pontos se o palpite não for o jogo de maior saldo da fase", () => {
    const userPred = { phase: "groups", matchId: "m3" };
    const pts = calculateExtraPhasePoints(userPred, matchesMock);
    expect(pts).toBe(0);
  });

  it("aceita empate se múltiplos jogos compartilharem o maior saldo", () => {
    const tiedMatches = [
      { id: "m1", resultHome: 3, resultAway: 0, status: "FINISHED" }, // diff = 3
      { id: "m2", resultHome: 0, resultAway: 3, status: "FINISHED" }, // diff = 3
    ];
    const pts1 = calculateExtraPhasePoints({ phase: "groups", matchId: "m1" }, tiedMatches);
    const pts2 = calculateExtraPhasePoints({ phase: "groups", matchId: "m2" }, tiedMatches);
    expect(pts1).toBe(20);
    expect(pts2).toBe(20);
  });
});
