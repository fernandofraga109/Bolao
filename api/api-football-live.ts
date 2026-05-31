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
  console.log(`[PROXY API-FOOTBALL] Iniciando handler...`);

  const API_KEY = process.env.API_FOOTBALL_KEY;
  const API_HOST = "v3.football.api-sports.io";
  const BASE_URL = `https://${API_HOST}`;

  console.log(`[PROXY API-FOOTBALL] API_KEY existe:`, !!API_KEY);

  if (!API_KEY) {
    console.error(`[PROXY API-FOOTBALL] API_KEY não encontrada`);
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message:
          "A variável API_FOOTBALL_KEY não foi encontrada no ambiente da Vercel.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Busca os jogos ao vivo
  const targetUrl = `${BASE_URL}/fixtures?live=all`;
  console.log(`[PROXY API-FOOTBALL] Target URL:`, targetUrl);

  try {
    console.log(`[PROXY API-FOOTBALL] Fazendo fetch...`);
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": API_KEY,
        "Content-Type": "application/json",
      },
    });

    console.log(`[PROXY API-FOOTBALL] Status da resposta:`, res.status);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(`[PROXY API-FOOTBALL] Erro na API:`, errorData);
      return new Response(
        JSON.stringify({ error: "Erro API", message: errorData.message || `Status ${res.status}` }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    console.log(`[PROXY API-FOOTBALL] Dados recebidos:`, JSON.stringify(data).slice(0, 200));

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[PROXY API-FOOTBALL] Erro interno:`, error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
