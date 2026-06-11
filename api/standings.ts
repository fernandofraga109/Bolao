/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/standings.ts
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  const url = new URL(req.url, "http://localhost");
  const competitionCode = (
    url.searchParams.get("competition") || "WC"
  ).toUpperCase();

  // `season` é OPT-IN: só repassamos à API externa quando o caller envia
  // explicitamente. Sem season, a football-data.org devolve a classificação da
  // temporada corrente (o que queremos para um torneio ao vivo). Atenção: para
  // a WC, `?season=2026` retorna um snapshot desatualizado — por isso o app NÃO
  // deve mandar season para standings de competição ativa. Pinne uma season
  // apenas quando precisar de dados históricos de uma edição específica
  // (ver STANDINGS_SEASON_OVERRIDE em services/liveScoreService.ts).
  const season = url.searchParams.get("season");
  const targetUrl = season
    ? `${BASE_URL}/competitions/${competitionCode}/standings?season=${encodeURIComponent(season)}`
    : `${BASE_URL}/competitions/${competitionCode}/standings`;

  if (!API_TOKEN) {
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message: "A variável FOOTBALL_DATA_TOKEN não foi encontrada.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const data = await (async () => {
      console.log(`[PROXY] Standings: ${targetUrl}`);
      const res = await fetch(targetUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          "X-Auth-Token": API_TOKEN,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) return res.json();

      // Se falhar, retornamos algo vazio para não quebrar a UI
      if (res.status === 404 || res.status === 403) {
        return {
          standings: [],
          message: "Tabela indisponível na API externa.",
        };
      }

      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro API (Status ${res.status})`);
    })();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("[PROXY] Erro interno (standings):", error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
