import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolveDeployTarget } from "./scripts/deploy-target.mjs";
/// <reference types="vitest" />

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const footballDataToken = env.FOOTBALL_DATA_TOKEN;

  // api-sports.io (detalhes ao vivo / minuto a minuto). URL completa vem do .env
  // (ex.: https://v3.football.api-sports.io/fixtures?live=all&league=1).
  // Tokens da api-sports para rotação (multiplica a cota diária). Ordem:
  // FOOTBALL_API_LIVE_DATA_TOKEN, _TOKEN_2, _TOKEN_3, ... Basta adicionar env.
  const liveDataTokens: string[] = [];
  if (env.FOOTBALL_API_LIVE_DATA_TOKEN) liveDataTokens.push(env.FOOTBALL_API_LIVE_DATA_TOKEN);
  for (let i = 2; i <= 10; i++) {
    const t = env[`FOOTBALL_API_LIVE_DATA_TOKEN_${i}`];
    if (t) liveDataTokens.push(t);
  }
  const liveDataDefaultUrl =
    "https://v3.football.api-sports.io/fixtures?live=all&league=1";
  let liveDataOrigin = "https://v3.football.api-sports.io";
  let liveDataPath = "/fixtures?live=all&league=1";
  try {
    const parsed = new URL(env.FOOTBALL_API_LIVE_DATA || liveDataDefaultUrl);
    liveDataOrigin = parsed.origin;
    liveDataPath = parsed.pathname + parsed.search;
  } catch {
    // mantém defaults
  }
  // Alvo do deploy derivado do dono do repo (Vercel injeta em build). Embutido no
  // bundle para o banner "Nova versão" ler só a versão do próprio deploy.
  // Override opcional `VITE_DEPLOY_TARGET` só para teste local (ex.: simular o
  // miguelfork). Em produção a Vercel não define isso → deriva do dono do repo.
  const deployTarget =
    env.VITE_DEPLOY_TARGET || resolveDeployTarget(process.env.VERCEL_GIT_REPO_OWNER);

  const apiProxy = {
    "/api/matches": {
      target: "https://api.football-data.org",
      changeOrigin: true,
      secure: true,
      rewrite: (incomingPath: string) => {
        const [, search = ""] = incomingPath.split("?");
        const params = new URLSearchParams(search);
        const competition = (params.get("competition") || "WC").toUpperCase();
        const season = params.get("season");
        const seasonQuery = season
          ? `?season=${encodeURIComponent(season)}`
          : "";
        return `/v4/competitions/${competition}/matches${seasonQuery}`;
      },
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          if (footballDataToken) {
            proxyReq.setHeader("X-Auth-Token", footballDataToken);
          }
          proxyReq.setHeader("Content-Type", "application/json");
          // Desabilitar cache para sempre pegar dados frescos da API
          proxyReq.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          proxyReq.setHeader("Pragma", "no-cache");
          proxyReq.setHeader("Expires", "0");
        });
      },
    },
    "/api/standings": {
      target: "https://api.football-data.org",
      changeOrigin: true,
      secure: true,
      rewrite: (incomingPath: string) => {
        const [, search = ""] = incomingPath.split("?");
        const params = new URLSearchParams(search);
        const competition = (params.get("competition") || "WC").toUpperCase();
        const season = params.get("season");
        const seasonQuery = season
          ? `?season=${encodeURIComponent(season)}`
          : "";
        return `/v4/competitions/${competition}/standings${seasonQuery}`;
      },
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          if (footballDataToken) {
            proxyReq.setHeader("X-Auth-Token", footballDataToken);
          }
          proxyReq.setHeader("Content-Type", "application/json");
        });
      },
    },
    "/api/teams": {
      target: "https://api.football-data.org",
      changeOrigin: true,
      secure: true,
      rewrite: (incomingPath: string) => {
        const [, search = ""] = incomingPath.split("?");
        const params = new URLSearchParams(search);
        const competition = (params.get("competition") || "WC").toUpperCase();
        const season = params.get("season");
        const seasonQuery = season
          ? `?season=${encodeURIComponent(season)}`
          : "";
        return `/v4/competitions/${competition}/teams${seasonQuery}`;
      },
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          if (footballDataToken) {
            proxyReq.setHeader("X-Auth-Token", footballDataToken);
          }
          proxyReq.setHeader("Content-Type", "application/json");
        });
      },
    },
    "/api/competitions": {
      target: "https://api.football-data.org",
      changeOrigin: true,
      secure: true,
      rewrite: () => "/v4/competitions",
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          if (footballDataToken) {
            proxyReq.setHeader("X-Auth-Token", footballDataToken);
          }
          proxyReq.setHeader("Content-Type", "application/json");
        });
      },
    },
    "/api/live-matches": {
      target: "https://api.football-data.org",
      changeOrigin: true,
      secure: true,
      rewrite: () => "/v4/matches?status=IN_PLAY,PAUSED",
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          if (footballDataToken) {
            proxyReq.setHeader("X-Auth-Token", footballDataToken);
          }
          proxyReq.setHeader("Content-Type", "application/json");
        });
      },
    },
    "/api/scorers": {
      target: "https://api.football-data.org",
      changeOrigin: true,
      secure: true,
      rewrite: (incomingPath: string) => {
        const [, search = ""] = incomingPath.split("?");
        const params = new URLSearchParams(search);
        const competition = (params.get("competition") || "WC").toUpperCase();
        const season = params.get("season");
        // A football-data devolve só 10 artilheiros por padrão e não tem
        // paginação por offset. Em produção `api/scorers.ts` pagina via `limit`;
        // o proxy de dev é só um rewrite, então fixamos um `limit` alto para
        // paridade (cobre todos os artilheiros de uma copa numa única chamada).
        const query = new URLSearchParams();
        if (season) query.set("season", season);
        query.set("limit", "300");
        return `/v4/competitions/${competition}/scorers?${query.toString()}`;
      },
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any) => {
          if (footballDataToken) {
            proxyReq.setHeader("X-Auth-Token", footballDataToken);
          }
          proxyReq.setHeader("Content-Type", "application/json");
        });
      },
    },
    "/api/live-details": {
      target: liveDataOrigin,
      changeOrigin: true,
      secure: true,
      rewrite: () => liveDataPath,
      configure: (proxy: any) => {
        proxy.on("proxyReq", (proxyReq: any, req: any) => {
          if (liveDataTokens.length > 0) {
            // ?t=N seleciona o token (rotação: token = N % nº de tokens).
            let idx = 0;
            const match = /[?&]t=(\d+)/.exec(req.url || "");
            if (match) idx = Number(match[1]) % liveDataTokens.length;
            proxyReq.setHeader("x-apisports-key", liveDataTokens[idx]);
          }
          proxyReq.setHeader("Content-Type", "application/json");
          proxyReq.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        });
      },
    },
  };

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: apiProxy,
    },
    plugins: [react()],
    define: {
      "import.meta.env.VITE_DEPLOY_TARGET": JSON.stringify(deployTarget),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            supabase: ["@supabase/supabase-js"],
            gemini: ["@google/genai"],
          },
        },
      },
    },
    test: {
      environment: "happy-dom",
      setupFiles: ["src/test/setup.ts"],
      globals: true,
      // Testes E2E (Playwright) vivem em `tests/` e usam outro runner.
      // Excluí-los evita que o Vitest tente executá-los.
      exclude: ["**/node_modules/**", "**/dist/**", "tests/**"],
    },
  };
});
