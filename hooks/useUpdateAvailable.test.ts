import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * UPDATE-AVAILABLE — lógica derivada de "há versão mais nova publicada
 * PARA ESTE DEPLOY?" (`hooks/useUpdateAvailable.ts`).
 *
 * Comportamento esperado: compara a versão publicada pelo servidor PARA O
 * DEPLOY ATUAL (`systemConfig.app_versions[DEPLOY_TARGET]`) com a versão
 * embutida no bundle (`CURRENT_VERSION`). Qualquer divergência = `true`.
 * Guarda anti falso-positivo: ausência da chave / valores falsy nunca
 * disparam. Crucial: a versão de OUTRO deploy nunca dispara o banner.
 *
 * Em ambiente de teste `import.meta.env.VITE_DEPLOY_TARGET` é undefined,
 * então DEPLOY_TARGET cai no fallback "bolao".
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
  it("retorna false quando app_versions está ausente (banco legado)", () => {
    fakeDb.systemConfig = {};
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna false quando app_versions é undefined", () => {
    fakeDb.systemConfig = { app_versions: undefined };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna false quando app_versions é null", () => {
    fakeDb.systemConfig = { app_versions: null };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna false quando app_versions não tem a chave do deploy atual", () => {
    fakeDb.systemConfig = { app_versions: { outroDeploy: "9.9.9" } };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna false quando a versão do deploy atual é igual à versão em execução", () => {
    fakeDb.systemConfig = { app_versions: { bolao: "1.31.0" } };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna true quando a versão publicada para o deploy atual é diferente", () => {
    fakeDb.systemConfig = { app_versions: { bolao: "1.32.0" } };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(true);
  });

  it("retorna false quando apenas OUTRO deploy tem versão nova (sem chave do deploy atual)", () => {
    fakeDb.systemConfig = { app_versions: { miguelfork: "1.32.0" } };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });

  it("retorna false quando o deploy atual está atualizado e OUTRO deploy tem versão nova", () => {
    fakeDb.systemConfig = {
      app_versions: { bolao: "1.31.0", miguelfork: "1.32.0" },
    };
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
  });
});
