/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/live-matches.ts
 * 
 * Este endpoint busca APENAS os jogos ao vivo na football-data.org,
 * retornando o campo "minute" que não está disponível no endpoint de competição.
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  if (!API_TOKEN) {
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message:
          "A variável FOOTBALL_DATA_TOKEN não foi encontrada no ambiente da Vercel.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Busca os jogos que estão IN_PLAY ou PAUSED agora
  const targetUrl = `${BASE_URL}/matches?status=IN_PLAY`;

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "X-Auth-Token": API_TOKEN,
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
    console.error(`[PROXY LIVE] Erro interno:`, error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
