import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const footballDataToken = env.FOOTBALL_DATA_TOKEN;

  const apiProxy = footballDataToken
    ? {
        "/api/matches": {
          target: "https://api.football-data.org",
          changeOrigin: true,
          secure: true,
          rewrite: () => "/v4/competitions/WC/matches",
          configure: (proxy: any) => {
            proxy.on("proxyReq", (proxyReq: any) => {
              proxyReq.setHeader("X-Auth-Token", footballDataToken);
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
        "/api/standings": {
          target: "https://api.football-data.org",
          changeOrigin: true,
          secure: true,
          rewrite: () => "/v4/competitions/WC/standings",
          configure: (proxy: any) => {
            proxy.on("proxyReq", (proxyReq: any) => {
              proxyReq.setHeader("X-Auth-Token", footballDataToken);
              proxyReq.setHeader("Content-Type", "application/json");
            });
          },
        },
      }
    : undefined;

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
