/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/live-details.ts
 *
 * Proxy para a api-sports.io (v3.football.api-sports.io). Busca os jogos ao
 * vivo da competição configurada (default: Copa do Mundo, league=1) e devolve
 * o payload bruto. O cliente normaliza/casa com os jogos internos.
 *
 * Estes dados servem APENAS para o "minuto a minuto" (relógio, eventos,
 * árbitro, estádio). NÃO entram em nenhum cálculo de pontos/ranking.
 *
 * Variáveis de ambiente (server-side):
 *   - FOOTBALL_API_LIVE_DATA        URL completa (ex.: .../fixtures?live=all&league=1)
 *   - FOOTBALL_API_LIVE_DATA_TOKEN  token da api-sports (header x-apisports-key)
 */

export const config = { runtime: "edge" };

const DEFAULT_URL = "https://v3.football.api-sports.io/fixtures?live=all&league=1";

export default async function handler(_req: Request) {
  const TOKEN = process.env.FOOTBALL_API_LIVE_DATA_TOKEN;
  const targetUrl = process.env.FOOTBALL_API_LIVE_DATA || DEFAULT_URL;

  if (!TOKEN) {
    return new Response(
      JSON.stringify({
        error: "Configuração Incompleta",
        message:
          "Nenhum token da api-sports (FOOTBALL_API_LIVE_DATA_TOKEN) foi encontrado no ambiente.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    console.log(
      `[PROXY LIVE-DETAILS] Chamando api-sports: ${targetUrl}`,
    );
    const startedAt = Date.now();
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": TOKEN,
        "Content-Type": "application/json",
      },
    });
    console.log(
      `[PROXY LIVE-DETAILS] api-sports respondeu status ${res.status} em ${Date.now() - startedAt}ms`,
    );

    // ── Telemetria de cota (fonte: headers da própria api-sports) ────────────
    // A api-sports devolve o orçamento DIÁRIO e por MINUTO em cada resposta.
    // Logamos para medir o consumo real/dia (greppável no log da Vercel) e
    // repassamos ao cliente para um eventual indicador no Admin.
    const dailyLimit = res.headers.get("x-ratelimit-requests-limit");
    const dailyRemaining = res.headers.get("x-ratelimit-requests-remaining");
    const minuteLimit = res.headers.get("X-RateLimit-Limit");
    const minuteRemaining = res.headers.get("X-RateLimit-Remaining");
    console.log(
      `[PROXY LIVE-DETAILS][QUOTA] dia: ${dailyRemaining ?? "?"}/${dailyLimit ?? "?"} restantes · minuto: ${minuteRemaining ?? "?"}/${minuteLimit ?? "?"} restantes`,
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          error: "Erro API",
          message: (errorData as any)?.message || `Status ${res.status}`,
        }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const fixtureCount = Array.isArray((data as any)?.response)
      ? (data as any).response.length
      : 0;
    console.log(
      `[PROXY LIVE-DETAILS] api-sports devolveu ${fixtureCount} fixture(s) ao vivo.`,
    );

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        // Repassa a cota da api-sports para o cliente (telemetria/indicador).
        ...(dailyRemaining ? { "x-quota-daily-remaining": dailyRemaining } : {}),
        ...(dailyLimit ? { "x-quota-daily-limit": dailyLimit } : {}),
      },
    });
  } catch (error: any) {
    console.error(`[PROXY LIVE-DETAILS] Erro interno:`, error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
