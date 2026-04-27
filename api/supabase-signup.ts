/**
 * VERCEL SERVERLESS FUNCTION (SUPABASE AUTH PROXY)
 * ------------------------------------------------
 * Encapsula o endpoint de signup do Supabase para evitar expor URL/chave no fluxo de cadastro.
 *
 * Vars esperadas no ambiente da Vercel:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 */

type SignupPayload = {
  name?: string;
  email?: string;
  password?: string;
};

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed", message: "Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message:
          "Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente da Vercel.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: SignupPayload;
  try {
    body = (await req.json()) as SignupPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: "Payload inválido", message: "JSON inválido." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const email = (body.email || "").trim();
  const password = (body.password || "").trim();
  const name = (body.name || "").trim();

  if (!email || !password || !name) {
    return new Response(
      JSON.stringify({
        error: "Campos obrigatórios",
        message: "name, email e password são obrigatórios.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          display_name: name,
          full_name: name,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: payload?.error || "Erro no cadastro",
          message: payload?.msg || payload?.message || "Falha ao criar conta.",
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        user: payload?.user || null,
        session: payload?.session || null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        message: error?.message || "Falha ao chamar Supabase Auth.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
