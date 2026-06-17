import { describe, it, expect } from "vitest";
import { maskValue, unmaskValue } from "./storageMask";

describe("storageMask", () => {
  it("mascara e desmascara um email corretamente", () => {
    const email = "usuario@exemplo.com";
    const masked = maskValue(email);
    expect(masked).not.toBe(email);
    expect(masked.startsWith("ctk_")).toBe(true);
    expect(unmaskValue(masked)).toBe(email);
  });

  it("preserva valor ja mascarado se desmascarado duas vezes", () => {
    const email = "teste@bolao.com";
    const once = maskValue(email);
    const twice = maskValue(once);
    expect(unmaskValue(twice)).toBe(email);
  });

  it("mantem compatibilidade com valores antigos sem prefixo", () => {
    const plain = "email@antigo.com";
    expect(unmaskValue(plain)).toBe(plain);
  });

  it("retorna valor original em caso de erro de codificacao", () => {
    // btoa falha em caracteres fora do range latin1
    const invalid = "\uD800"; // lone surrogate
    expect(maskValue(invalid)).toBe(invalid);
  });
});
