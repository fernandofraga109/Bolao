/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/teams.ts
 * Endpoint externo: GET /v4/competitions/{code}/teams
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  const url = new URL(req.url, "http://localhost");
  const competitionCode = (
    url.searchParams.get("competition") || "WC"
  ).toUpperCase();
  const season = url.searchParams.get("season") || "";

  if (!API_TOKEN) {
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message: "A variável FOOTBALL_DATA_TOKEN não foi encontrada.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const buildUrl = (withSeason: boolean) => {
    const base = `${BASE_URL}/competitions/${competitionCode}/teams`;
    return withSeason && season ? `${base}?season=${encodeURIComponent(season)}` : base;
  };

  try {
    const data = await (async () => {
      // Tentativa 1: com temporada
      const res1 = await fetch(buildUrl(true), {
        method: "GET",
        headers: { "X-Auth-Token": API_TOKEN, "Content-Type": "application/json" },
      });

      if (res1.ok) return res1.json();

      // Fallback: sem temporada
      if (res1.status === 404 || res1.status === 403) {
        const res2 = await fetch(buildUrl(false), {
          method: "GET",
          headers: { "X-Auth-Token": API_TOKEN, "Content-Type": "application/json" },
        });

        if (res2.ok) return res2.json();

        return { teams: [], message: "Times indisponíveis na API externa." };
      }

      const errorData = await res1.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro API (Status ${res1.status})`);
    })();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: "Falha ao buscar times." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
