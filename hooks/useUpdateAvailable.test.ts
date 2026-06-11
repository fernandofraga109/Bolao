import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * UPDATE-AVAILABLE — lógica derivada de "há versão mais nova publicada?"
 * (`hooks/useUpdateAvailable.ts`).
 *
 * Comportamento esperado: compara a versão publicada pelo servidor
 * (`systemConfig.app_version`) com a versão embutida no bundle
 * (`CURRENT_VERSION`). Qualquer divergência = `true`. Guarda anti
 * falso-positivo: valores falsy (null/undefined/"") nunca disparam.
 */

let fakeDb: any;

vi.mock("../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

// Fixa CURRENT_VERSION para isolar o teste de bumps de versão reais.
vi.mock("../data/releases", () => ({
  CURRENT_VERSION: "1.31.0",
}));

import { useUpdateAvailable } from "./useUpdateAvailable";

beforeEach(() => {
  fakeDb = { systemConfig: {} };
});

describe("useUpdateAvailable", () => {
  it("retorna false quando app_version é igual à versão em execução", () => {
    fakeDb.systemConfig = { app_version: "1.31.0" };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna true quando app_version publicada é mais nova/diferente", () => {
    fakeDb.systemConfig = { app_version: "1.32.0" };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(true);
  });

  it("retorna false quando app_version é null (banco legado)", () => {
    fakeDb.systemConfig = { app_version: null };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna false quando app_version é undefined (coluna ausente)", () => {
    fakeDb.systemConfig = {};
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna false quando app_version é string vazia", () => {
    fakeDb.systemConfig = { app_version: "" };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });
});
