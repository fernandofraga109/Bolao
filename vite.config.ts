import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
/// <reference types="vitest" />

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const footballDataToken = env.FOOTBALL_DATA_TOKEN;

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
