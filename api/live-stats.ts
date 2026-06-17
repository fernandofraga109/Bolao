/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/live-stats.ts
 *
 * Proxy para a api-sports.io (v3.football.api-sports.io). Busca as ESTATÍSTICAS
 * de um fixture específico (`/fixtures/statistics?fixture=<id>`) e devolve o
 * payload bruto. O cliente normaliza/casa com os jogos internos.
 *
 * Estes dados servem APENAS para o painel de estatísticas ao vivo (posse de
 * bola, finalizações, escanteios, etc.). NÃO entram em nenhum cálculo de
 * pontos/ranking.
 *
 * Compartilha a MESMA chave e cota da api-sports usada por /api/live-details —
 * por isso o cliente só chama isto sob o mesmo throttle do minuto-a-minuto.
 *
 * Variáveis de ambiente (server-side):
 *   - FOOTBALL_API_LIVE_DATA        URL completa do live (deriva a origem)
 *   - FOOTBALL_API_LIVE_DATA_TOKEN  token da api-sports (header x-apisports-key)
 */

export const config = { runtime: "edge" };

const DEFAULT_ORIGIN = "https://v3.football.api-sports.io";

function resolveOrigin(): string {
  const raw = process.env.FOOTBALL_API_LIVE_DATA;
  if (!raw) return DEFAULT_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

export default async function handler(req: Request) {
  const TOKEN = process.env.FOOTBALL_API_LIVE_DATA_TOKEN;

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

  const fixture = new URL(req.url).searchParams.get("fixture");
  if (!fixture) {
    return new Response(
      JSON.stringify({
        error: "Parâmetro ausente",
        message: "É obrigatório informar ?fixture=<id> na chamada.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const targetUrl = `${resolveOrigin()}/fixtures/statistics?fixture=${encodeURIComponent(
    fixture,
  )}`;

  try {
    console.log(`[PROXY LIVE-STATS] Chamando api-sports: ${targetUrl}`);
    const startedAt = Date.now();
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "x-apisports-key": TOKEN,
        "Content-Type": "application/json",
      },
    });
    console.log(
      `[PROXY LIVE-STATS] api-sports respondeu status ${res.status} em ${Date.now() - startedAt}ms`,
    );

    // ── Telemetria de cota (fonte: headers da própria api-sports) ────────────
    const dailyLimit = res.headers.get("x-ratelimit-requests-limit");
    const dailyRemaining = res.headers.get("x-ratelimit-requests-remaining");
    const minuteLimit = res.headers.get("X-RateLimit-Limit");
    const minuteRemaining = res.headers.get("X-RateLimit-Remaining");
    console.log(
      `[PROXY LIVE-STATS][QUOTA] dia: ${dailyRemaining ?? "?"}/${dailyLimit ?? "?"} restantes · minuto: ${minuteRemaining ?? "?"}/${minuteLimit ?? "?"} restantes`,
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

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...(dailyRemaining ? { "x-quota-daily-remaining": dailyRemaining } : {}),
        ...(dailyLimit ? { "x-quota-daily-limit": dailyLimit } : {}),
      },
    });
  } catch (error: any) {
    console.error(`[PROXY LIVE-STATS] Erro interno:`, error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
