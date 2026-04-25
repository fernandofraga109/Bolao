import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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
        return `/v4/competitions/${competition}/matches`;
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
  };
});
