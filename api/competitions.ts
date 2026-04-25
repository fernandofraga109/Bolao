/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/competitions.ts
 */

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  const targetUrl = `${BASE_URL}/competitions`;

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
    console.log(`[PROXY] Consultando: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "X-Auth-Token": API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(
        `[PROXY] Erro da API Football-Data:`,
        response.status,
        errorData,
      );

      return new Response(
        JSON.stringify({
          error: `Erro na API externa (${response.status})`,
          message:
            errorData.message || "Recurso não encontrado ou acesso negado.",
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
    console.error(`[PROXY] Erro interno:`, error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
