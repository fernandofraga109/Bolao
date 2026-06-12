/**
 * PUBLICA A VERSÃO DA APP NO BANCO (Opção C do banner "Nova versão disponível").
 * -----------------------------------------------------------------------------
 * Roda como `postbuild` (após `vite build`). No deploy de produção da Vercel,
 * chama a função Postgres `publish_app_version(v)` via RPC, que grava
 * `system_config.app_version`. O Realtime do Supabase propaga a mudança para as
 * abas abertas, que então mostram o banner de atualização.
 *
 * SEGURANÇA: usa a ANON key (já pública, já no bundle) — NÃO usa service_role.
 * A escrita é feita por uma função `SECURITY DEFINER` restrita a setar a coluna
 * de versão (ver migration 0029). Blast radius se mal-usada: no máximo um banner.
 *
 * GUARDAS (para não publicar a partir de build local de desenvolvimento):
 *   - Só roda em deploy de PRODUÇÃO da Vercel (`VERCEL_ENV === "production"`).
 *   - Nunca derruba o build: qualquer erro é logado e o processo sai com 0.
 *
 * ENV VARS (todas já existem — nenhum segredo novo):
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *   - VITE_SUPABASE_SCHEMA  (default "public")
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { resolveDeployTarget } from "./deploy-target.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = (...a) => console.log("[publish-version]", ...a);

async function main() {
  // ── Guarda: só em produção na Vercel ────────────────────────────────────
  if (process.env.VERCEL_ENV !== "production") {
    log(`pulado: VERCEL_ENV="${process.env.VERCEL_ENV || "(local)"}" (só publica em produção).`);
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    log("pulado: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausente.");
    return;
  }

  // ── Lê CURRENT_VERSION de data/releases.ts (fonte única) ────────────────
  const releasesPath = join(__dirname, "..", "data", "releases.ts");
  const src = readFileSync(releasesPath, "utf8");
  const match = src.match(/CURRENT_VERSION\s*=\s*["']([^"']+)["']/);
  if (!match) {
    log("pulado: não consegui extrair CURRENT_VERSION de data/releases.ts.");
    return;
  }
  const version = match[1];

  // Alvo do deploy derivado do dono do repo (Vercel injeta em build). Cada deploy
  // publica só a sua própria chave em system_config.app_versions.
  const target = resolveDeployTarget(process.env.VERCEL_GIT_REPO_OWNER);

  const schema = process.env.VITE_SUPABASE_SCHEMA || "public";
  const supabase = createClient(url, anonKey, {
    db: { schema },
    auth: { persistSession: false },
  });

  // A função (SECURITY DEFINER) escreve só se a versão daquele deploy mudou.
  const { error } = await supabase.rpc("publish_app_version", { target, v: version });
  if (error) {
    log(`erro ao chamar publish_app_version:`, error.message);
    return;
  }

  log(`app_version publicada: "${version}" para deploy "${target}" (schema ${schema}). ✅`);
}

main().catch((e) => {
  // Nunca quebra o deploy por causa do banner.
  console.warn("[publish-version] falhou (não-fatal):", e?.message || e);
});
