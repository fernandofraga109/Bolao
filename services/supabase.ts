import { createClient } from "@supabase/supabase-js";

/**
 * CONFIGURAÇÃO DO SUPABASE (PROTEGIDA)
 * -----------------------------------
 * Não deixamos mais as chaves expostas no código-fonte.
 * Elas agora são lidas das variáveis de ambiente do Vite.
 *
 * NO DESENVOLVIMENTO LOCAL:
 * Crie um arquivo chamado ".env" na raiz do projeto e adicione:
 * VITE_SUPABASE_URL=sua_url_aqui
 * VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
 *
 * NA VERCEL:
 * Adicione essas mesmas chaves em Settings > Environment Variables.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const SUPABASE_SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || "public";
console.log("🔌 [Supabase] Schema em uso pelo Frontend:", SUPABASE_SCHEMA);

// Verificação de configuração
const isConfigured =
  SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;

if (!isConfigured && typeof window !== "undefined") {
  console.warn(
    "⚠️ Supabase: URL ou Anon Key não configuradas.\n" +
      "Certifique-se de definir VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no seu ambiente.",
  );
}

const rawSupabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      db: { schema: SUPABASE_SCHEMA },
    })
  : null;

// Monkeypatch / Proxy para interceptar as chamadas de tabela (.from)
// E aplicar o prefixo dinamicamente se estiver definido no .env
export const supabase = rawSupabase
  ? new Proxy(rawSupabase, {
      get(target, prop, receiver) {
        if (prop === "from") {
          return (relation: string) => {
            const prefix = import.meta.env.VITE_DB_TABLE_PREFIX || "";
            const prefixed = prefix ? `${prefix}${relation}` : relation;
            return target.from(prefixed);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    })
  : null;

/**
 * Por que não usamos um Proxy no Servidor para o Supabase?
 * 1. O Supabase usa a anon key no front-end para habilitar o Realtime (WebSockets).
 *    Se passarmos por um proxy de servidor comum, perdemos as atualizações ao vivo.
 * 2. A segurança é garantida pelas RLS (Row Level Security) que já aplicamos no seu SQL.
 */
export const isSupabaseEnabled = () => !!supabase;
