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
  getMatchPhase,
  getMatchDuration,
  getKnockoutAdvancingTeamId,
  getR1MatchScoringResult,
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

    it("retorna 5 pontos para empate previsto vs empate real com diff=0 (0-0 vs 1-1) — empates nunca ganham bônus de diff", () => {
      expect(calculatePoints(0, 0, 1, 1)).toBe(POINTS_OUTCOME);
    });
  });

  describe("resultado correto (vencedor certo)", () => {
    it("retorna 5 pontos quando acerta o vencedor mas não a diferença", () => {
      expect(calculatePoints(1, 0, 3, 1)).toBe(POINTS_OUTCOME);
    });

    it("retorna 5 pontos para empate previsto vs empate real com diff=0 (1-1 vs 2-2) — empates nunca ganham bônus de diff", () => {
      // Resultado real é empate: regra 3 do regulamento nunca concede 'diff', apenas 'outcome'
      expect(calculatePoints(1, 1, 2, 2)).toBe(POINTS_OUTCOME);
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
    { userId: "u1", championTeamId: "bra", topScorerPlayerId: "neymar-uuid" },
    { userId: "u2", championTeamId: "fra", topScorerPlayerId: "mbappe-uuid" },
    { userId: "u3", championTeamId: "bra", topScorerPlayerId: "messi-uuid" },
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
    // Apenas u2 apostou 'mbappe-uuid' (1 acerta = 60 pontos)
    const actual = { topScorerPlayerIds: ["mbappe-uuid"] };
    const ptsU2 = calculateTournamentPointsRegulamento2(
      { topScorerPlayerId: "mbappe-uuid" },
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

  it("pontua melhor ataque / pior defesa quando há empate de times (array oficial)", () => {
    const prediction = {
      championTeamId: "fra",
      mostGoalsTeamId: "ger",
      mostConcededTeamId: "pan",
    };
    const actual = {
      championTeamId: "fra",
      mostGoalsTeamIds: ["bra", "ger"],
      mostConcededTeamIds: ["pan", "ksa"],
    };
    // u2 acerta campeão sozinho (100) + ataque empatado inclui 'ger' (20) + defesa empatada inclui 'pan' (20) = 140 pts
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

  it("classifiesBonus = 0 quando jogo não foi para pênaltis (realTieWinnerId ausente)", () => {
    const cat = getScoreCategoryRegulamento1(1, 1, 1, 1, undefined, undefined, 0, "team-a", undefined);
    expect(cat.type).toBe("exact");
    expect(cat.classifiesBonus).toBe(0);
  });

  it("classifiesBonus = +3 quando palpite é empate, jogo foi para pênaltis e vencedor correto", () => {
    const cat = getScoreCategoryRegulamento1(1, 1, 1, 1, undefined, undefined, 0, "team-a", "team-a");
    expect(cat.type).toBe("exact");
    expect(cat.classifiesBonus).toBe(3);
  });

  it("classifiesBonus = 0 quando vencedor errado nos pênaltis", () => {
    const cat = getScoreCategoryRegulamento1(1, 1, 1, 1, undefined, undefined, 0, "team-a", "team-b");
    expect(cat.type).toBe("exact");
    expect(cat.classifiesBonus).toBe(0);
  });

  it("classifiesBonus = 0 quando palpite não é empate (mesmo que jogo vá para pênaltis)", () => {
    const cat = getScoreCategoryRegulamento1(2, 1, 2, 1, undefined, undefined, 0, "team-a", "team-a");
    expect(cat.type).toBe("exact");
    expect(cat.classifiesBonus).toBe(0);
  });

  it("calculatePoints inclui classifiesBonus no total de pontos", () => {
    const pts = calculatePoints(1, 1, 1, 1, undefined, undefined, 0, "team-a", "team-a");
    expect(pts).toBe(10 + 3); // POINTS_EXACT + POINTS_CLASSIFIES_BONUS
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

  // SCORE-39 — empate de maior diferença: qualquer jogo máximo vale (já coberto acima)
  // SCORE-40 — override admin tem precedência sobre o cálculo automático
  it("SCORE-40: override admin define o jogo correto e tem precedência (array de matchIds)", () => {
    const matches = [
      { id: "m1", resultHome: 5, resultAway: 0, status: "FINISHED" }, // maior saldo natural
      { id: "m2", resultHome: 1, resultAway: 0, status: "FINISHED" },
    ];
    // Admin força m2 como o "correto" — m1 não pontua, m2 pontua
    expect(calculateExtraPhasePoints({ phase: "groups", matchId: "m1" }, matches, ["m2"])).toBe(0);
    expect(calculateExtraPhasePoints({ phase: "groups", matchId: "m2" }, matches, ["m2"])).toBe(20);
  });

  // SCORE-40b — múltiplos jogos oficiais por fase (array)
  it("SCORE-40b: múltiplos jogos oficiais pontuam se o palpite estiver incluso", () => {
    const matches = [
      { id: "m1", resultHome: 5, resultAway: 0, status: "FINISHED" },
      { id: "m2", resultHome: 1, resultAway: 0, status: "FINISHED" },
    ];
    expect(calculateExtraPhasePoints({ phase: "groups", matchId: "m1" }, matches, ["m1", "m2"])).toBe(20);
    expect(calculateExtraPhasePoints({ phase: "groups", matchId: "m2" }, matches, ["m1", "m2"])).toBe(20);
    expect(calculateExtraPhasePoints({ phase: "groups", matchId: "m2" }, matches, [])).toBe(0);
  });

  // SCORE-41 — torneio/extra com prediction indefinida
  it("SCORE-41: retorna 0 quando o palpite extra é indefinido ou sem matchId", () => {
    expect(calculateExtraPhasePoints(undefined, [])).toBe(0);
    expect(calculateExtraPhasePoints({ phase: "groups" }, [])).toBe(0);
  });
});

// ============================================================================
// SCORE-18/19/20 — Tabela completa de pontos por fase (Regulamento 2)
// ============================================================================
describe("calculatePointsRegulamento2 — tabela por fase (SCORE-18/19/20)", () => {
  // Mock onde só o usuário corrente acerta, para isolar o valor exato sem aloneBonus
  const sharedPreds = (h: number, a: number) => [
    { userId: "u1", homeScore: h, awayScore: a },
    { userId: "u2", homeScore: h, awayScore: a }, // outro acerta o exato → sem aloneBonus
  ];

  describe("SCORE-18: placar exato por fase", () => {
    it("grupos exato = 15", () => {
      expect(calculatePointsRegulamento2(2, 1, 2, 1, "groups", sharedPreds(2, 1), "u1")).toBe(15);
    });
    it("ko exato = 15", () => {
      expect(calculatePointsRegulamento2(2, 1, 2, 1, "ko", sharedPreds(2, 1), "u1")).toBe(15);
    });
    it("3º lugar exato = 17", () => {
      expect(calculatePointsRegulamento2(2, 1, 2, 1, "third_place", sharedPreds(2, 1), "u1")).toBe(17);
    });
    it("final exato = 22", () => {
      expect(calculatePointsRegulamento2(2, 1, 2, 1, "final", sharedPreds(2, 1), "u1")).toBe(22);
    });
  });

  describe("SCORE-19: diferença certa por fase", () => {
    // pred 3-1 (diff 2) vs real 2-0 (diff 2)
    it("grupos diff = 13", () => {
      expect(calculatePointsRegulamento2(3, 1, 2, 0, "groups", [], "u1")).toBe(13);
    });
    it("ko diff = 13", () => {
      expect(calculatePointsRegulamento2(3, 1, 2, 0, "ko", [], "u1")).toBe(13);
    });
    it("3º lugar diff = 15", () => {
      expect(calculatePointsRegulamento2(3, 1, 2, 0, "third_place", [], "u1")).toBe(15);
    });
    it("final diff = 19", () => {
      expect(calculatePointsRegulamento2(3, 1, 2, 0, "final", [], "u1")).toBe(19);
    });
  });

  describe("SCORE-20: resultado certo por fase", () => {
    // pred 1-0 (diff 1) vs real 3-1 (diff 2) → só acerta vencedor
    it("grupos outcome = 10", () => {
      expect(calculatePointsRegulamento2(1, 0, 3, 1, "groups", [], "u1")).toBe(10);
    });
    it("ko outcome = 10", () => {
      expect(calculatePointsRegulamento2(1, 0, 3, 1, "ko", [], "u1")).toBe(10);
    });
    it("3º lugar outcome = 12", () => {
      expect(calculatePointsRegulamento2(1, 0, 3, 1, "third_place", [], "u1")).toBe(12);
    });
    it("final outcome = 16", () => {
      expect(calculatePointsRegulamento2(1, 0, 3, 1, "final", [], "u1")).toBe(16);
    });
  });

  // SCORE-23: aloneBonus só se aplica a exact, nunca a diff/outcome
  it("SCORE-23: placar isolado (+5) não se aplica a diff", () => {
    // pred 3-1 vs real 2-0 → diff; mesmo sendo o único, sem +5
    const pts = calculatePointsRegulamento2(3, 1, 2, 0, "groups", [{ userId: "u1", homeScore: 3, awayScore: 1 }], "u1");
    expect(pts).toBe(13); // 13 e não 18
  });

  it("SCORE-23: placar isolado (+5) não se aplica a outcome", () => {
    const pts = calculatePointsRegulamento2(1, 0, 3, 1, "groups", [{ userId: "u1", homeScore: 1, awayScore: 0 }], "u1");
    expect(pts).toBe(10); // 10 e não 15
  });

  // SCORE-24: R2 empate real → outcome, nunca diff
  it("SCORE-24: empate real classifica como outcome (nunca diff)", () => {
    const cat = getScoreCategoryRegulamento2(2, 2, 1, 1, "groups", [], "u1");
    expect(cat.type).toBe("outcome");
    expect(cat.type).not.toBe("diff");
  });
});

// ============================================================================
// SCORE-26 — getMatchPhase
// ============================================================================
describe("getMatchPhase (SCORE-26)", () => {
  it("mapeia stages EN para fases internas", () => {
    expect(getMatchPhase("GROUP_STAGE")).toBe("groups");
    expect(getMatchPhase("REGULAR_SEASON")).toBe("groups");
    expect(getMatchPhase("ROUND_OF_16")).toBe("ko");
    expect(getMatchPhase("QUARTER_FINALS")).toBe("ko");
    expect(getMatchPhase("SEMI_FINALS")).toBe("ko");
    expect(getMatchPhase("THIRD_PLACE")).toBe("third_place");
    expect(getMatchPhase("FINAL")).toBe("final");
  });

  it("reconhece nomes de grupo pt-BR de mata-mata", () => {
    expect(getMatchPhase(undefined, "OITAVAS")).toBe("ko");
    expect(getMatchPhase(undefined, "QUARTAS")).toBe("ko");
    expect(getMatchPhase(undefined, "SEMI")).toBe("ko");
  });

  it("reconhece terceiro lugar em pt-BR", () => {
    expect(getMatchPhase(undefined, "TERCEIRO LUGAR")).toBe("third_place");
    expect(getMatchPhase(undefined, "3º Lugar")).toBe("third_place");
  });

  it("default é groups quando não reconhece", () => {
    expect(getMatchPhase(undefined, "Grupo A")).toBe("groups");
    expect(getMatchPhase("")).toBe("groups");
  });
});

// ============================================================================
// SCORE-27/28 — getMatchDuration (colunas planas + fallback JSONB)
// ============================================================================
describe("getMatchDuration (SCORE-27/28)", () => {
  it("SCORE-27: pênaltis tem precedência sobre prorrogação e regular", () => {
    expect(getMatchDuration({ penaltiesHome: 4, extraTimeHome: 1 })).toBe("PENALTY_SHOOTOUT");
  });

  it("SCORE-27: prorrogação quando há extraTimeHome e sem pênaltis", () => {
    expect(getMatchDuration({ extraTimeHome: 1 })).toBe("EXTRA_TIME");
  });

  it("SCORE-27: regular quando não há colunas planas de prorrog./pênaltis", () => {
    expect(getMatchDuration({})).toBe("REGULAR");
  });

  it("SCORE-28: fallback para score.duration (JSONB) quando faltam colunas planas", () => {
    expect(getMatchDuration({ score: { duration: "EXTRA_TIME" } })).toBe("EXTRA_TIME");
    expect(getMatchDuration({ score: { duration: "PENALTY_SHOOTOUT" } })).toBe("PENALTY_SHOOTOUT");
  });
});

// ============================================================================
// SCORE-29/30/31 — getKnockoutAdvancingTeamId
// ============================================================================
describe("getKnockoutAdvancingTeamId (SCORE-29/30/31)", () => {
  const home = { id: "home-id" };
  const away = { id: "away-id" };

  it("SCORE-29: pênaltis — vencedor pelos pênaltis (mandante)", () => {
    const id = getKnockoutAdvancingTeamId({
      penaltiesHome: 4,
      penaltiesAway: 2,
      homeTeam: home,
      awayTeam: away,
    });
    expect(id).toBe("home-id");
  });

  it("SCORE-29: pênaltis — vencedor pelos pênaltis (visitante)", () => {
    const id = getKnockoutAdvancingTeamId({
      penaltiesHome: 2,
      penaltiesAway: 4,
      homeTeam: home,
      awayTeam: away,
    });
    expect(id).toBe("away-id");
  });

  it("SCORE-30: prorrogação — vencedor pelo placar acumulado (result)", () => {
    const id = getKnockoutAdvancingTeamId({
      extraTimeHome: 1,
      result: { home: 2, away: 1 },
      homeTeam: home,
      awayTeam: away,
    });
    expect(id).toBe("home-id");
  });

  it("SCORE-31: jogo no tempo regular → undefined (sem desempate)", () => {
    const id = getKnockoutAdvancingTeamId({
      result: { home: 2, away: 1 },
      homeTeam: home,
      awayTeam: away,
    });
    expect(id).toBeUndefined();
  });
});

// ============================================================================
// SCORE-32/33 — getR1MatchScoringResult (regular only, fallback JSONB)
// SCORE-16 — R1 mata-mata usa tempo regular
// ============================================================================
describe("getR1MatchScoringResult (SCORE-32/33)", () => {
  it("SCORE-32: usa colunas planas regularHome/regularAway quando presentes", () => {
    const res = getR1MatchScoringResult(
      { regularHome: 1, regularAway: 1, extraTimeHome: 1 },
      2, // fallback (placar acumulado) — não deve ser usado
      1
    );
    expect(res).toEqual({ home: 1, away: 1 });
  });

  it("SCORE-33: sem colunas planas, com JSONB EXTRA_TIME usa score.regularTime", () => {
    const res = getR1MatchScoringResult(
      { score: { duration: "EXTRA_TIME", regularTime: { home: 1, away: 1 } } },
      2,
      1
    );
    expect(res).toEqual({ home: 1, away: 1 });
  });

  it("retorna fallback quando jogo é regular sem colunas planas", () => {
    const res = getR1MatchScoringResult({}, 2, 1);
    expect(res).toEqual({ home: 2, away: 1 });
  });

  it("SCORE-16: R1 mata-mata pontua sobre o tempo regular (1-1 reg, 2-1 prorrog → pred 1-1 = exato)", () => {
    // Simula o consumo real: R1 calcula a categoria sobre o resultado regular
    const r1 = getR1MatchScoringResult(
      { regularHome: 1, regularAway: 1, extraTimeHome: 1 },
      2,
      1
    );
    const cat = getScoreCategoryRegulamento1(1, 1, r1.home, r1.away);
    expect(cat.type).toBe("exact");
  });
});

// ============================================================================
// SCORE-25 — R2 mata-mata usa regular + prorrogação (match.result)
// ============================================================================
describe("R2 mata-mata usa placar acumulado (SCORE-25)", () => {
  it("categoria R2 é calculada sobre regular+prorrogação (match.result), não só regular", () => {
    // Regular 1-1, prorrogação leva a 2-1 acumulado.
    // Palpite 2-1 deve ser EXATO no R2 (que compara o acumulado), diferente do R1.
    const cat = getScoreCategoryRegulamento2(2, 1, 2, 1, "ko", [], "u1");
    expect(cat.type).toBe("exact");
  });
});

// ============================================================================
// SCORE-34/35/36/37 — Pontos de torneio (campeão/artilheiro/classificados)
// ============================================================================
describe("Torneio Regulamento 1 (SCORE-34)", () => {
  it("SCORE-34: campeão/artilheiro/melhor jogador/goleiro valem 100 cada", () => {
    const pred = {
      championTeamId: "bra",
      topScorer: { player: "Vini", goals: 7 },
      bestPlayer: "Messi",
      bestGoalkeeper: "Alisson",
    };
    const actual = {
      championTeamId: "bra",
      topScorer: { player: "Vini", goals: 7 },
      bestPlayer: "Messi",
      bestGoalkeeper: "Alisson",
    };
    // campeão 100 + artilheiro nome 100 + artilheiro gols 100 + melhor jogador 100 + goleiro 100
    expect(calculateTournamentPoints(pred, actual)).toBe(500);
  });

  it("SCORE-34: comparação de nomes é case-insensitive e com trim", () => {
    const pts = calculateTournamentPoints(
      { bestPlayer: "  MESSI  " },
      { bestPlayer: "messi" }
    );
    expect(pts).toBe(100);
  });
});

describe("Torneio Regulamento 2 — campeão dividido (SCORE-35)", () => {
  const actual = { championTeamId: "bra" };
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, championTeamId: "bra" }));

  it("1 acertador → 100", () => {
    expect(calculateTournamentPointsRegulamento2({ championTeamId: "bra" }, actual, mk(1), "u0")).toBe(100);
  });
  it("2 acertadores → 70", () => {
    expect(calculateTournamentPointsRegulamento2({ championTeamId: "bra" }, actual, mk(2), "u0")).toBe(70);
  });
  it("3 acertadores → 50", () => {
    expect(calculateTournamentPointsRegulamento2({ championTeamId: "bra" }, actual, mk(3), "u0")).toBe(50);
  });
  it("4+ acertadores → 40", () => {
    expect(calculateTournamentPointsRegulamento2({ championTeamId: "bra" }, actual, mk(5), "u0")).toBe(40);
  });
});

describe("Torneio Regulamento 2 — artilheiro dividido (SCORE-36)", () => {
  const actual = { topScorerPlayerIds: ["vini-uuid"] };
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, topScorerPlayerId: "vini-uuid" }));

  it("1 acertador → 60", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "vini-uuid" }, actual, mk(1), "u0")).toBe(60);
  });
  it("2 acertadores → 40", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "vini-uuid" }, actual, mk(2), "u0")).toBe(40);
  });
  it("3 acertadores → 30", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "vini-uuid" }, actual, mk(3), "u0")).toBe(30);
  });
  it("4+ acertadores → 25", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "vini-uuid" }, actual, mk(4), "u0")).toBe(25);
  });
  it("não pontua artilheiro via nome (campo nome ignorado)", () => {
    const actualName = { topScorer: { player: "Vini", goals: 6 } } as any;
    const predName = { topScorer: { player: "Vini", goals: 6 } } as any;
    expect(calculateTournamentPointsRegulamento2(predName, actualName, [], "u0")).toBe(0);
  });
});

describe("Torneio Regulamento 2 — artilheiro dividido por UUID", () => {
  const actual = { topScorerPlayerIds: ["player-uuid-1", "player-uuid-2"] };
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, topScorerPlayerId: "player-uuid-1" }));

  it("1 acertador → 60", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "player-uuid-1" }, actual, mk(1), "u0")).toBe(60);
  });
  it("2 acertadores → 40", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "player-uuid-1" }, actual, mk(2), "u0")).toBe(40);
  });
  it("3 acertadores → 30", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "player-uuid-1" }, actual, mk(3), "u0")).toBe(30);
  });
  it("4+ acertadores → 25", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "player-uuid-1" }, actual, mk(4), "u0")).toBe(25);
  });
  it("retorna 0 se o UUID do artilheiro não estiver correto", () => {
    expect(calculateTournamentPointsRegulamento2({ topScorerPlayerId: "wrong-uuid" }, actual, mk(1), "u0")).toBe(0);
  });

  it("empate de artilheiros: acertadores de A e de B compartilham o rateio", () => {
    // Artilheiro A (player-uuid-1) e Artilheiro B (player-uuid-2) empatados em gols.
    // 2 usuários palpitaram A, 1 usuário palpitou B → 3 acertadores no total → 30 pontos cada.
    const tiedActual = { topScorerPlayerIds: ["player-uuid-1", "player-uuid-2"] };
    const groupPreds = [
      { userId: "u0", topScorerPlayerId: "player-uuid-1" },
      { userId: "u1", topScorerPlayerId: "player-uuid-1" },
      { userId: "u2", topScorerPlayerId: "player-uuid-2" },
    ];
    expect(
      calculateTournamentPointsRegulamento2({ topScorerPlayerId: "player-uuid-1" }, tiedActual, groupPreds, "u0")
    ).toBe(30);
    expect(
      calculateTournamentPointsRegulamento2({ topScorerPlayerId: "player-uuid-2" }, tiedActual, groupPreds, "u2")
    ).toBe(30);
  });
});

describe("Torneio Regulamento 2 — classificados (SCORE-37)", () => {
  it("SCORE-37: grupo vale 10/time, mata-mata vale 5/time", () => {
    const pred = {
      groupClassifications: {
        "Grupo A": ["bra", "arg"],
        "Oitavas": ["bra"],
      },
    };
    const actual = {
      groupClassifications: {
        "Grupo A": ["bra", "arg"], // 2 * 10 = 20
        "Oitavas": ["bra"], // 1 * 5 = 5
      },
    };
    const pts = calculateTournamentPointsRegulamento2(pred as any, actual as any, [], "u0");
    expect(pts).toBe(25);
  });
});

describe("Torneio — prediction/actual indefinidos (SCORE-41)", () => {
  it("SCORE-41 (R1): retorna 0 com prediction indefinida", () => {
    expect(calculateTournamentPoints(undefined, { championTeamId: "bra" })).toBe(0);
  });
  it("SCORE-41 (R1): retorna 0 com actual indefinido", () => {
    expect(calculateTournamentPoints({ championTeamId: "bra" }, undefined)).toBe(0);
  });
  it("SCORE-41 (R2): retorna 0 com prediction/actual indefinidos", () => {
    expect(calculateTournamentPointsRegulamento2(undefined, { championTeamId: "bra" }, [], "u0")).toBe(0);
    expect(calculateTournamentPointsRegulamento2({ championTeamId: "bra" }, undefined, [], "u0")).toBe(0);
  });
});
