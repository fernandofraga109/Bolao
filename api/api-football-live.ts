/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/api-football-live.ts
 * 
 * Este endpoint é um proxy para a API-Football (via RapidAPI)
 * para testar jogos ao vivo. Não integrado à app ainda.
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const API_KEY = process.env.API_FOOTBALL_KEY;
  const API_HOST = "v3.football.api-sports.io";
  const BASE_URL = `https://${API_HOST}`;

  if (!API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message:
          "A variável API_FOOTBALL_KEY não foi encontrada no ambiente da Vercel.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const targetUrl = `${BASE_URL}/fixtures?live=all`;

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: "Erro API", message: errorData.message || `Status ${res.status}` }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
