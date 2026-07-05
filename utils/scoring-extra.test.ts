import { describe, it, expect } from "vitest";
import {
  getMatchPhase,
  getR1MatchScoringResult,
  getScoreCategoryRegulamento2,
  calculateTopScorerPoints,
  calculateTournamentPoints,
} from "./scoring";

describe("getMatchPhase", () => {
  it("retorna 'final' para stage FINAL", () => {
    expect(getMatchPhase("FINAL")).toBe("final");
  });

  it("retorna 'final' para stage FINAL com grupo vazio", () => {
    expect(getMatchPhase("FINAL", "")).toBe("final");
  });

  it("retorna 'ko' para SEMI_FINALS (nao confundir com FINAL)", () => {
    expect(getMatchPhase("SEMI_FINALS")).toBe("ko");
  });

  it("retorna 'ko' para QUARTER_FINALS (nao confundir com FINAL)", () => {
    expect(getMatchPhase("QUARTER_FINALS")).toBe("ko");
  });

  it("retorna 'ko' para ROUND_OF_16", () => {
    expect(getMatchPhase("ROUND_OF_16")).toBe("ko");
  });

  it("retorna 'ko' quando grupo contem OITAVAS", () => {
    expect(getMatchPhase("", "OITAVAS DE FINAL")).toBe("ko");
  });

  it("retorna 'ko' quando grupo contem QUARTAS", () => {
    expect(getMatchPhase("", "QUARTAS DE FINAL")).toBe("ko");
  });

  it("retorna 'ko' quando grupo contem SEMI", () => {
    expect(getMatchPhase("", "SEMI FINAL")).toBe("ko");
  });

  it("retorna 'third_place' para stage THIRD_PLACE", () => {
    expect(getMatchPhase("THIRD_PLACE")).toBe("third_place");
  });

  it("retorna 'third_place' quando grupo contem TERCEIRO", () => {
    expect(getMatchPhase("", "TERCEIRO LUGAR")).toBe("third_place");
  });

  it("retorna 'third_place' quando grupo contem 3o", () => {
    expect(getMatchPhase("", "3O LUGAR")).toBe("third_place");
  });

  it("retorna 'groups' para fase de grupos generica", () => {
    expect(getMatchPhase("LEAGUE_STAGE", "Grupo A")).toBe("groups");
  });

  it("retorna 'groups' quando stage e grupo sao undefined", () => {
    expect(getMatchPhase(undefined, undefined)).toBe("groups");
  });

  it("retorna 'groups' quando stage e grupo sao strings vazias", () => {
    expect(getMatchPhase("", "")).toBe("groups");
  });

  it("retorna 'groups' para stage desconhecido sem indicadores de knockout", () => {
    expect(getMatchPhase("REGULAR_SEASON", "Grupo B")).toBe("groups");
  });
});

describe("getR1MatchScoringResult", () => {
  it("retorna fallback quando score e undefined", () => {
    const result = getR1MatchScoringResult(undefined, 2, 1);
    expect(result).toEqual({ home: 2, away: 1 });
  });

  it("retorna fallback quando score e null", () => {
    const result = getR1MatchScoringResult(null, 3, 0);
    expect(result).toEqual({ home: 3, away: 0 });
  });

  it("retorna fallback para tempo regular (sem EXTRA_TIME)", () => {
    const score = { duration: "REGULAR", fullTime: { home: 2, away: 1 } };
    const result = getR1MatchScoringResult(score, 2, 1);
    expect(result).toEqual({ home: 2, away: 1 });
  });

  it("retorna regularTime para EXTRA_TIME", () => {
    const score = {
      duration: "EXTRA_TIME",
      regularTime: { home: 1, away: 1 },
      fullTime: { home: 2, away: 1 },
    };
    const result = getR1MatchScoringResult(score, 2, 1);
    expect(result).toEqual({ home: 1, away: 1 });
  });

  it("retorna regularTime para PENALTY_SHOOTOUT", () => {
    const score = {
      duration: "PENALTY_SHOOTOUT",
      regularTime: { home: 2, away: 2 },
      fullTime: { home: 2, away: 2 },
      penalties: { home: 4, away: 3 },
    };
    const result = getR1MatchScoringResult(score, 2, 2);
    expect(result).toEqual({ home: 2, away: 2 });
  });

  it("usa fallback quando regularTime esta ausente em EXTRA_TIME", () => {
    const score = {
      duration: "EXTRA_TIME",
      fullTime: { home: 3, away: 2 },
    };
    const result = getR1MatchScoringResult(score, 3, 2);
    expect(result).toEqual({ home: 3, away: 2 });
  });

  it("usa fallback quando regularTime e null em PENALTY_SHOOTOUT", () => {
    const score = {
      duration: "PENALTY_SHOOTOUT",
      regularTime: null,
    };
    const result = getR1MatchScoringResult(score, 1, 1);
    expect(result).toEqual({ home: 1, away: 1 });
  });

  it("retorna regularTime parcial se apenas home esta disponivel", () => {
    const score = {
      duration: "EXTRA_TIME",
      regularTime: { home: 0 },
    };
    const result = getR1MatchScoringResult(score, 1, 0);
    expect(result).toEqual({ home: 0, away: 0 });
  });
});

describe("getScoreCategoryRegulamento2", () => {
  const mkPreds = (userId: string, home: number, away: number) => [
    { userId, homeScore: home, awayScore: away },
  ];

  it("retorna 'exact' com aloneBonus=true quando e o unico a acertar", () => {
    const result = getScoreCategoryRegulamento2(
      2,
      1,
      2,
      1,
      "groups",
      mkPreds("u1", 2, 1),
      "u1",
    );
    expect(result.type).toBe("exact");
    expect(result.aloneBonus).toBe(true);
  });

  it("retorna 'exact' com aloneBonus=false quando outros tambem acertaram", () => {
    const preds = [
      { userId: "u1", homeScore: 2, awayScore: 1 },
      { userId: "u2", homeScore: 2, awayScore: 1 },
    ];
    const result = getScoreCategoryRegulamento2(
      2,
      1,
      2,
      1,
      "groups",
      preds,
      "u1",
    );
    expect(result.type).toBe("exact");
    expect(result.aloneBonus).toBe(false);
  });

  it("retorna 'outcome' para empate nao exato (1-1 vs 0-0)", () => {
    const result = getScoreCategoryRegulamento2(
      1,
      1,
      0,
      0,
      "groups",
      mkPreds("u1", 1, 1),
      "u1",
    );
    expect(result.type).toBe("outcome");
  });

  it("retorna 'diff' para vitoria com diferenca correta (3-1 vs 2-0)", () => {
    const result = getScoreCategoryRegulamento2(
      3,
      1,
      2,
      0,
      "groups",
      mkPreds("u1", 3, 1),
      "u1",
    );
    expect(result.type).toBe("diff");
  });

  it("retorna 'wrong' quando erra o resultado", () => {
    const result = getScoreCategoryRegulamento2(
      1,
      0,
      0,
      2,
      "groups",
      mkPreds("u1", 1, 0),
      "u1",
    );
    expect(result.type).toBe("wrong");
  });

  it("retorna 'outcome' para empate quando resultado real e empate (nao concede diff)", () => {
    const result = getScoreCategoryRegulamento2(
      0,
      0,
      2,
      2,
      "groups",
      mkPreds("u1", 0, 0),
      "u1",
    );
    expect(result.type).toBe("outcome");
  });
});

describe("calculateTopScorerPoints", () => {
  it("e um alias para calculateTournamentPoints", () => {
    expect(calculateTopScorerPoints).toBe(calculateTournamentPoints);
  });
});
