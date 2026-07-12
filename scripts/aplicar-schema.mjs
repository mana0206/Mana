// Aplica supabase/migrations/*.sql no projeto via Management API.
// Uso: node scripts/aplicar-schema.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const token = env.SUPABASE_ACCESS_TOKEN;

const pasta = join(raiz, "supabase", "migrations");
for (const arquivo of readdirSync(pasta).sort()) {
  if (!arquivo.endsWith(".sql")) continue;
  const sql = readFileSync(join(pasta, arquivo), "utf8");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const corpo = await res.text();
  console.log(`${arquivo}: HTTP ${res.status}`);
  if (!res.ok) {
    console.error(corpo.slice(0, 600));
    process.exit(1);
  }
}
console.log("Schema aplicado com sucesso.");
