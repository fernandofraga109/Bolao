import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolveDeployTarget } from "./scripts/deploy-target.mjs";
/// <reference types="vitest" />

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const footballDataToken = env.FOOTBALL_DATA_TOKEN;
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
        const seasonQuery = season
          ? `?season=${encodeURIComponent(season)}`
          : "";
        return `/v4/competitions/${competition}/scorers${seasonQuery}`;
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
