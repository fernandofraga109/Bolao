/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/matches.ts
 */

export const config = { runtime: "edge" };

import { resolveSeason } from "./_lib/seasonPolicy";

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  const url = new URL(req.url, "http://localhost");
  const COMPETITION_CODE = (
    url.searchParams.get("competition") || "WC"
  ).toUpperCase();

  // Season decidida SERVER-SIDE; ignora `season` do cliente (abas stale). Sem
  // season → seedless (temporada corrente).
  const SEASON = resolveSeason(COMPETITION_CODE);
  const targetUrl = SEASON
    ? `${BASE_URL}/competitions/${COMPETITION_CODE}/matches?season=${encodeURIComponent(SEASON)}`
    : `${BASE_URL}/competitions/${COMPETITION_CODE}/matches`;

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

  try {
    const data = await (async () => {
      // Tentativa 1: Com Temporada (ano atual por padrão)
      console.log(`[PROXY] Tentativa 1: ${targetUrl}`);
      const res1 = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "X-Auth-Token": API_TOKEN,
          "Content-Type": "application/json",
        },
      });

      if (res1.ok) return res1.json();

      // Se der 404 ou 403, tenta sem a temporada
      if (res1.status === 404 || res1.status === 403) {
        const fallbackUrl = `${BASE_URL}/competitions/${COMPETITION_CODE}/matches`;
        console.log(`[PROXY] Tentativa 2 (Fallback): ${fallbackUrl}`);
        const res2 = await fetch(fallbackUrl, {
          method: "GET",
          headers: {
            "X-Auth-Token": API_TOKEN,
            "Content-Type": "application/json",
          },
        });

        if (res2.ok) return res2.json();

        const errorData = await res2.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Erro API (Status ${res2.status})`,
        );
      }

      const errorData = await res1.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro API (Status ${res1.status})`);
    })();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[PROXY] Erro interno:`, error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
