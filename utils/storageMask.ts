const MASK_PREFIX = "ctk_";

export function maskValue(value: string): string {
  if (typeof value !== "string") return value;
  if (value.startsWith(MASK_PREFIX)) return value;
  try {
    return `${MASK_PREFIX}${btoa(value)}`;
  } catch {
    return value;
  }
}

/**
 * Grava um valor mascarado no localStorage de forma segura.
 * No iOS Safari/WebKit a cota de localStorage é pequena e o base64 do
 * mascaramento infla o payload (~33%), podendo lançar QuotaExceededError.
 * Como não há Error Boundary, uma exceção aqui derrubaria o app inteiro
 * (tela azul após o login). Este helper engole o erro — o Supabase é a
 * fonte de verdade quando autenticado, então a persistência local é opcional.
 */
export function safeSetMaskedItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, maskValue(value));
  } catch (e) {
    console.warn(`[storage] falha ao persistir "${key}" (cota/privado?):`, e);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignorar */
    }
  }
}

export function unmaskValue(value: string): string {
  if (typeof value !== "string") return value;
  if (value.startsWith(MASK_PREFIX)) {
    try {
      return atob(value.slice(MASK_PREFIX.length));
    } catch {
      return value;
    }
  }
  return value;
}
