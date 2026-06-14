/**
 * VERCEL SERVERLESS FUNCTION (PROXY SEGURO)
 * -----------------------------------------
 * Local: /api/scorers.ts
 * Busca artilheiros da competição na Football Data API
 */

export const config = { runtime: "edge" };

import { resolveSeason } from "./_lib/seasonPolicy";

// A Football Data API devolve apenas os 10 primeiros artilheiros por padrão e
// NÃO oferece paginação por offset — o único controle é o query param `limit`,
// que retorna os top-N. Para cobrir todos os artilheiros sem hardcodar um teto,
// paginamos: começamos com `PAGE_SIZE` e, enquanto a resposta vier "cheia"
// (length >= limit), pedimos mais uma página aumentando o `limit`, até a API
// devolver menos que o pedido (acabaram os artilheiros) ou batermos no `MAX`.
const PAGE_SIZE = 50;
const MAX_LIMIT = 300;

export default async function handler(req: Request) {
  const API_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
  const BASE_URL = "https://api.football-data.org/v4";

  const url = new URL(req.url, "http://localhost");
  const competitionCode = (
    url.searchParams.get("competition") || "WC"
  ).toUpperCase();

  // Season decidida SERVER-SIDE; ignora `season` do cliente (abas stale). Sem
  // season → seedless (temporada corrente).
  const season = resolveSeason(competitionCode);

  // Monta a URL do endpoint com `season` (opcional) e `limit` paginado.
  const buildUrl = (limit: number, withSeason: boolean): string => {
    const params = new URLSearchParams();
    if (withSeason && season) params.set("season", season);
    params.set("limit", String(limit));
    return `${BASE_URL}/competitions/${competitionCode}/scorers?${params.toString()}`;
  };

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

  // Busca uma única "página" (top-`limit` artilheiros) e devolve o payload bruto.
  const fetchPage = (targetUrl: string) =>
    fetch(targetUrl, {
      method: "GET",
      headers: {
        "X-Auth-Token": API_TOKEN,
        "Content-Type": "application/json",
      },
    });

  // Pagina aumentando o `limit` até a resposta não vir mais cheia ou bater o teto.
  const paginate = async (withSeason: boolean) => {
    let limit = PAGE_SIZE;
    let lastPayload: any = null;

    while (true) {
      const targetUrl = buildUrl(limit, withSeason);
      console.log(
        `[PROXY] Scorers página (limit=${limit}, season=${withSeason ? season ?? "—" : "—"}): ${targetUrl}`,
      );
      const res = await fetchPage(targetUrl);

      if (!res.ok) {
        return { ok: false as const, status: res.status, payload: lastPayload, res };
      }

      const payload = await res.json();
      lastPayload = payload;
      const count = Array.isArray(payload?.scorers) ? payload.scorers.length : 0;

      // Resposta não veio cheia → já temos todos os artilheiros.
      if (count < limit || limit >= MAX_LIMIT) {
        console.log(
          `[PROXY] Scorers paginação concluída: ${count} artilheiros (limit final=${limit}).`,
        );
        return { ok: true as const, payload };
      }

      // Veio cheia → pode haver mais. Pede a próxima página (limit maior).
      limit = Math.min(limit + PAGE_SIZE, MAX_LIMIT);
    }
  };

  try {
    const data = await (async () => {
      // Tentativa 1: Com Temporada (ano atual por padrão), paginada
      const attempt1 = await paginate(true);
      if (attempt1.ok) return attempt1.payload;

      // Se der 404 ou 403, tenta sem a temporada (também paginada)
      if (attempt1.status === 404 || attempt1.status === 403) {
        console.log("[PROXY] Scorers fallback sem season (paginado).");
        const attempt2 = await paginate(false);
        if (attempt2.ok) return attempt2.payload;

        // Se falhar tudo, retornamos algo vazio para não quebrar a UI
        return {
          scorers: [],
          message: "Artilheiros indisponíveis na API externa.",
        };
      }

      const errorData = await attempt1.res.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Erro API (Status ${attempt1.status})`,
      );
    })();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[PROXY] Erro interno (scorers):", error);
    return new Response(
      JSON.stringify({ error: "Erro de conexão", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
