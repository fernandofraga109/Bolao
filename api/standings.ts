/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/standings.ts
 */

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  const url = new URL(req.url);
  const competitionCode = (
    url.searchParams.get("competition") || "WC"
  ).toUpperCase();
  const season = url.searchParams.get("season") || "2026";

  const targetUrl = `${BASE_URL}/competitions/${competitionCode}/standings?season=${encodeURIComponent(season)}`;

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
    console.log(`[PROXY] Consultando standings: ${targetUrl}`);

    let response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "X-Auth-Token": API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      console.log(`[PROXY] 404 com season=${season}. Tentando sem season para ${competitionCode}...`);
      const fallbackUrl = `${BASE_URL}/competitions/${competitionCode}/standings`;
      response = await fetch(fallbackUrl, {
        method: "GET",
        headers: {
          "X-Auth-Token": API_TOKEN,
          "Content-Type": "application/json",
        },
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(
        "[PROXY] Aviso da API Football-Data (standings):",
        response.status,
        errorData,
      );

      // Se for 404 ou 403, retornamos sucesso com array vazio para não quebrar o frontend
      if (response.status === 404 || response.status === 403) {
        return new Response(
          JSON.stringify({
            standings: [],
            message: "Tabela não disponível ou acesso restrito pela API externa.",
            isFallback: true
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: `Erro na API externa (${response.status})`,
          message:
            errorData.message || "Recurso não encontrado ou acesso negado.",
          hint: "Verifique o plano da Football-Data.org para standings da competição.",
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[PROXY] Erro interno (standings):", error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
