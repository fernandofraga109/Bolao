import { describe, it, expect } from "vitest";
import { translateStage, translateGroupName } from "./translations";

describe("translateStage", () => {
  it("traduz FINAL para FINAL", () => {
    expect(translateStage("FINAL")).toBe("FINAL");
  });

  it("traduz SEMI_FINALS para SEMI FINAL", () => {
    expect(translateStage("SEMI_FINALS")).toBe("SEMI FINAL");
  });

  it("traduz SEMI_FINAL (singular) para SEMI FINAL", () => {
    expect(translateStage("SEMI_FINAL")).toBe("SEMI FINAL");
  });

  it("traduz QUARTER_FINALS para QUARTAS DE FINAL", () => {
    expect(translateStage("QUARTER_FINALS")).toBe("QUARTAS DE FINAL");
  });

  it("traduz QUARTER_FINAL (singular) para QUARTAS DE FINAL", () => {
    expect(translateStage("QUARTER_FINAL")).toBe("QUARTAS DE FINAL");
  });

  it("traduz PLAYOFFS para PLAYOFFS", () => {
    expect(translateStage("PLAYOFFS")).toBe("PLAYOFFS");
  });

  it("traduz PLAY_OFF para PLAYOFFS", () => {
    expect(translateStage("PLAY_OFF")).toBe("PLAYOFFS");
  });

  it("traduz LAST_16 para OITAVAS DE FINAL", () => {
    expect(translateStage("LAST_16")).toBe("OITAVAS DE FINAL");
  });

  it("traduz ROUND_OF_16 para DEZESSEIS AVOS", () => {
    expect(translateStage("ROUND_OF_16")).toBe("DEZESSEIS AVOS");
  });

  it("traduz LAST_32 para TRINTA E DOIS AVOS", () => {
    expect(translateStage("LAST_32")).toBe("TRINTA E DOIS AVOS");
  });

  it("traduz ROUND_OF_32 para TRINTA E DOIS AVOS", () => {
    expect(translateStage("ROUND_OF_32")).toBe("TRINTA E DOIS AVOS");
  });

  it("traduz THIRD_PLACE para TERCEIRO LUGAR", () => {
    expect(translateStage("THIRD_PLACE")).toBe("TERCEIRO LUGAR");
  });

  it("traduz LEAGUE_STAGE para FASE DE GRUPOS", () => {
    expect(translateStage("LEAGUE_STAGE")).toBe("FASE DE GRUPOS");
  });

  it("traduz REGULAR_SEASON para TEMPORADA REGULAR", () => {
    expect(translateStage("REGULAR_SEASON")).toBe("TEMPORADA REGULAR");
  });

  it("normaliza entrada com espacos em vez de underscores", () => {
    expect(translateStage("semi finals")).toBe("SEMI FINAL");
  });

  it("normaliza entrada em minusculas", () => {
    expect(translateStage("quarter_finals")).toBe("QUARTAS DE FINAL");
  });

  it("retorna o valor original para fases desconhecidas", () => {
    expect(translateStage("UNKNOWN_STAGE")).toBe("UNKNOWN_STAGE");
  });
});

describe("translateGroupName", () => {
  it("traduz 'Group A' para 'Grupo A'", () => {
    expect(translateGroupName("Group A")).toBe("Grupo A");
  });

  it("traduz 'GROUP_B' para 'Grupo B'", () => {
    expect(translateGroupName("GROUP_B")).toBe("Grupo B");
  });

  it("traduz 'group c' para 'Grupo c' (preserva case da letra capturada)", () => {
    expect(translateGroupName("group c")).toBe("Grupo c");
  });

  it("traduz 'Group Z' para 'Grupo Z'", () => {
    expect(translateGroupName("Group Z")).toBe("Grupo Z");
  });

  it("traduz nomes de fases como competicao", () => {
    expect(translateGroupName("SEMI_FINALS")).toBe("SEMI FINAL");
  });

  it("traduz THIRD_PLACE como fase de competicao", () => {
    expect(translateGroupName("THIRD_PLACE")).toBe("TERCEIRO LUGAR");
  });

  it("capitaliza termos desconhecidos sem traducao", () => {
    expect(translateGroupName("some_random_stage")).toBe("Some Random Stage");
  });

  it("capitaliza termos com espacos", () => {
    expect(translateGroupName("another stage")).toBe("Another Stage");
  });

  it("lida com whitespace extra ao redor de grupo", () => {
    expect(translateGroupName("  Group A  ")).toBe("Grupo A");
  });
});
