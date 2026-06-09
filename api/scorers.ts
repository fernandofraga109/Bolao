/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/scorers.ts
 * Busca artilheiros da competição na Football Data API
 */

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  const url = new URL(req.url, "http://localhost");
  const competitionCode = (
    url.searchParams.get("competition") || "WC"
  ).toUpperCase();
  const season =
    url.searchParams.get("season") || new Date().getFullYear().toString();

  const targetUrl = `${BASE_URL}/competitions/${competitionCode}/scorers?season=${encodeURIComponent(season)}`;

  if (!API_TOKEN) {
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message:
          "A variável FOOTBALL_DATA_TOKEN não foi encontrada.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const data = await (async () => {
      // Tentativa 1: Com Temporada (ano atual por padrão)
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
        const fallbackUrl = `${BASE_URL}/competitions/${competitionCode}/scorers`;
        const res2 = await fetch(fallbackUrl, {
          method: "GET",
          headers: {
            "X-Auth-Token": API_TOKEN,
            "Content-Type": "application/json",
          },
        });

        if (res2.ok) return res2.json();

        // Se falhar tudo, retornamos algo vazio para não quebrar a UI
        return {
          scorers: [],
          message: "Artilheiros indisponíveis na API externa.",
        };
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
      JSON.stringify({ error: "Erro de conexão", message: "Falha ao buscar artilheiros." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
