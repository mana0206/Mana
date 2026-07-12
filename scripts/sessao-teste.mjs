// Cria um usuário de teste, faz login via API e exporta os cookies de sessão
// no formato do @supabase/ssr, para testes de UI autenticados.
// Uso: node scripts/sessao-teste.mjs <arquivo-saida.json>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ref = new URL(URL_SB).hostname.split(".")[0];
const email = `ui-${Date.now()}@mana-teste.dev`;
const senha = randomUUID();

const resAdmin = await fetch(`${URL_SB}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password: senha, email_confirm: true }),
});
const usuario = await resAdmin.json();
if (!usuario.id) {
  console.error("Falha ao criar usuário:", resAdmin.status);
  process.exit(1);
}

const sb = createClient(URL_SB, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
if (error) {
  console.error("Falha no login:", error.message);
  process.exit(1);
}

// formato de cookie do @supabase/ssr: "base64-" + base64url(JSON da sessão), em pedaços de 3180
const valor =
  "base64-" +
  Buffer.from(JSON.stringify(data.session))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const nome = `sb-${ref}-auth-token`;
const TAM = 3180;
const cookies = [];
if (valor.length <= TAM) {
  cookies.push({ nome, valor });
} else {
  for (let i = 0; i * TAM < valor.length; i++) {
    cookies.push({ nome: `${nome}.${i}`, valor: valor.slice(i * TAM, (i + 1) * TAM) });
  }
}

writeFileSync(process.argv[2], JSON.stringify({ userId: usuario.id, cookies }, null, 2));
console.log(`Sessão criada para ${email} — ${cookies.length} cookie(s) → ${process.argv[2]}`);
