import { describe, it, expect } from "vitest";
import { resolveSeason } from "./seasonPolicy";

/**
 * SEASON POLICY — política de season server-side (`api/_lib/seasonPolicy.ts`).
 *
 * Comportamento esperado:
 *   - Competições no mapa resolvem para uma season fixa (ex.: BSA → "2026").
 *   - A resolução é case-insensitive (o cliente pode mandar o código em qualquer caixa).
 *   - Competições fora do mapa são "seedless" (undefined) → a football-data.org
 *     devolve a temporada corrente.
 *   - Sem código (undefined/vazio), assume o default "WC", que é seedless.
 */
describe("resolveSeason", () => {
  it("resolve BSA para a season fixa 2026", () => {
    expect(resolveSeason("BSA")).toBe("2026");
  });

  it("é case-insensitive (bsa minúsculo também resolve 2026)", () => {
    expect(resolveSeason("bsa")).toBe("2026");
    expect(resolveSeason("Bsa")).toBe("2026");
  });

  it("retorna undefined (seedless) para WC", () => {
    expect(resolveSeason("WC")).toBeUndefined();
  });

  it("retorna undefined (seedless) para código desconhecido", () => {
    expect(resolveSeason("XYZ")).toBeUndefined();
  });

  it("assume o default WC (seedless) quando o código é undefined", () => {
    expect(resolveSeason(undefined)).toBeUndefined();
  });

  it("assume o default WC (seedless) quando o código é vazio", () => {
    expect(resolveSeason("")).toBeUndefined();
  });
});
