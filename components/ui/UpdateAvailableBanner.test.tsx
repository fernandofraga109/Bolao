import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * UPDATE-AVAILABLE — Banner "Nova versão disponível"
 * (`components/ui/UpdateAvailableBanner.tsx`).
 *
 * Comportamento esperado:
 *   - Não renderiza nada quando a versão em execução é a mais recente.
 *   - Quando há versão mais nova publicada, mostra o aviso e o botão "Atualizar".
 *   - "Atualizar" recarrega a página (window.location.reload).
 *   - "Dispensar" esconde o banner.
 */

let fakeDb: any;

vi.mock("../../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

// Fixa CURRENT_VERSION para controlar o estado "stale" pelo app_version.
vi.mock("../../data/releases", () => ({
  CURRENT_VERSION: "1.31.0",
}));

import UpdateAvailableBanner from "./UpdateAvailableBanner";

const TEXT = "Nova versão disponível";

beforeEach(() => {
  fakeDb = { systemConfig: {} };
});

describe("UpdateAvailableBanner", () => {
  it("não renderiza nada quando a versão em execução é a mais recente", () => {
    fakeDb.systemConfig = { app_version: "1.31.0" };
    render(<UpdateAvailableBanner />);
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });

  it("não renderiza nada quando não há versão publicada (legado)", () => {
    fakeDb.systemConfig = {};
    render(<UpdateAvailableBanner />);
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
  });

  it("mostra o aviso e o botão Atualizar quando há versão mais nova", () => {
    fakeDb.systemConfig = { app_version: "1.32.0" };
    render(<UpdateAvailableBanner />);
    expect(screen.getByText(TEXT)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /atualizar/i })
    ).toBeInTheDocument();
  });

  describe("interações com versão mais nova publicada", () => {
    const reload = vi.fn();

    beforeEach(() => {
      fakeDb.systemConfig = { app_version: "1.32.0" };
      reload.mockClear();
      // happy-dom: location.reload não é trivialmente espionável; redefinimos location.
      Object.defineProperty(window, "location", {
        value: { reload },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("clicar em Atualizar recarrega a página", async () => {
      const user = userEvent.setup();
      render(<UpdateAvailableBanner />);
      await user.click(screen.getByRole("button", { name: /atualizar/i }));
      expect(reload).toHaveBeenCalled();
    });

    it("clicar em Dispensar esconde o banner", async () => {
      const user = userEvent.setup();
      render(<UpdateAvailableBanner />);
      expect(screen.getByText(TEXT)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /dispensar/i }));
      expect(screen.queryByText(TEXT)).not.toBeInTheDocument();
    });
  });
});
