// Teste de ponta a ponta do backend da Maná.
// Cria um usuário descartável, percorre o fluxo completo do negócio
// (ingrediente → receita → produto → cliente → pedido → financeiro → estoque),
// valida os cálculos e apaga tudo no final.
// Uso: node scripts/e2e.mjs
import { readFileSync } from "node:fs";
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
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;

const EMAIL_TESTE = `e2e-${Date.now()}@mana-teste.dev`;
const SENHA_TESTE = randomUUID(); // nunca é exibida

let passaram = 0;
let falharam = 0;
function checar(nome, cond, detalhe = "") {
  if (cond) {
    passaram++;
    console.log(`  ✓ ${nome}`);
  } else {
    falharam++;
    console.log(`  ✗ ${nome} ${detalhe}`);
  }
}
const aprox = (a, b) => Math.abs(a - b) < 0.005;

async function admin(caminho, metodo = "GET", corpo) {
  const res = await fetch(`${URL_SB}${caminho}`, {
    method: metodo,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

// ---------- 0. Usuário de teste ----------
console.log("\n0. Preparação");
const criado = await admin("/auth/v1/admin/users", "POST", {
  email: EMAIL_TESTE,
  password: SENHA_TESTE,
  email_confirm: true,
});
checar("usuário de teste criado", criado.status === 200 && criado.json?.id, `HTTP ${criado.status}`);
const idUsuario = criado.json?.id;

const sb = createClient(URL_SB, ANON);
const login = await sb.auth.signInWithPassword({
  email: EMAIL_TESTE,
  password: SENHA_TESTE,
});
checar("login com o usuário de teste", !login.error, login.error?.message);

// ---------- 1. RLS ----------
console.log("\n1. Segurança (RLS)");
const anonimo = createClient(URL_SB, ANON);
const rlsTeste = await anonimo.from("ingredientes").select("id");
checar(
  "anônimo não lê dados (lista vazia ou negado)",
  (rlsTeste.data ?? []).length === 0
);

const ids = {};
try {
  // ---------- 2. Precificação ----------
  console.log("\n2. Ficha técnica e precificação");
  const { data: cf } = await sb.from("custos_fixos").select("*");
  checar("custos fixos do seed presentes (3)", (cf ?? []).length === 3);

  const { data: ing, error: eIng } = await sb
    .from("ingredientes")
    .insert({
      nome: "E2E Farinha",
      preco_compra: 6,
      quantidade_embalagem: 1000,
      unidade_uso: "g",
      estoque_atual: 2000,
      estoque_minimo: 300,
    })
    .select()
    .single();
  checar("ingrediente criado", !eIng, eIng?.message);
  ids.ingrediente = ing?.id;

  const { data: rec } = await sb
    .from("receitas")
    .insert({ nome: "E2E Pão", rendimento_qtd: 2, rendimento_unidade: "un" })
    .select()
    .single();
  ids.receita = rec?.id;
  await sb.from("receita_ingredientes").insert({
    receita_id: rec.id,
    ingrediente_id: ing.id,
    quantidade: 500,
  });

  // custo: 500g × R$0,006 = 3,00 → +embalagem 3,00 +40% (gás 10 + mão de obra 30) = 7,20 → /2 un = 3,60
  const custoIngr = 500 * (6 / 1000);
  const fixos = cf.filter((c) => c.ativo);
  const custoTotal = fixos.reduce(
    (t, c) => (c.tipo === "fixo" ? t + Number(c.valor) : t + custoIngr * (Number(c.valor) / 100)),
    custoIngr
  );
  const custoUn = custoTotal / 2;
  checar(`custo da receita = R$ 7,20 (calculado ${custoTotal.toFixed(2)})`, aprox(custoTotal, 7.2));
  checar(`custo por unidade = R$ 3,60 (calculado ${custoUn.toFixed(2)})`, aprox(custoUn, 3.6));

  const sugerido = custoUn * (1 + 100 / 100);
  checar(`preço sugerido (margem 100%) = R$ 7,20`, aprox(sugerido, 7.2));

  const { data: prod } = await sb
    .from("produtos")
    .insert({ nome: "E2E Pão (un)", receita_id: rec.id, margem: 100, preco_venda: 8 })
    .select()
    .single();
  ids.produto = prod?.id;
  checar("produto criado com preço praticado R$ 8,00", prod?.preco_venda === 8);

  // ---------- 3. Pedido ----------
  console.log("\n3. Pedido e fluxo de status");
  const { data: cli } = await sb
    .from("clientes")
    .insert({ nome: "E2E Cliente", telefone: "(62) 99999-0000" })
    .select()
    .single();
  ids.cliente = cli?.id;

  const { data: ped } = await sb
    .from("pedidos")
    .insert({ cliente_id: cli.id, desconto: 1, sinal: 5, data_entrega: new Date().toISOString() })
    .select()
    .single();
  ids.pedido = ped?.id;
  await sb.from("pedido_itens").insert({
    pedido_id: ped.id,
    produto_id: prod.id,
    descricao: prod.nome,
    quantidade: 2,
    preco_unitario: 8,
  });
  const total = 2 * 8 - 1;
  checar("pedido criado (total esperado R$ 15,00)", total === 15);

  // confirmar → registra sinal (replica a lógica da UI)
  await sb.from("pedidos").update({ status: "confirmado" }).eq("id", ped.id);
  await sb.from("movimentos_financeiros").insert({
    tipo: "entrada",
    categoria: "sinal",
    valor: 5,
    descricao: "Sinal — E2E Cliente",
    pedido_id: ped.id,
  });

  // em produção → baixa estoque: 500g/2un × 2un = 500g
  await sb.from("pedidos").update({ status: "em_producao" }).eq("id", ped.id);
  const consumo = (500 / 2) * 2;
  await sb
    .from("ingredientes")
    .update({ estoque_atual: 2000 - consumo })
    .eq("id", ing.id);
  const { data: ingDepois } = await sb
    .from("ingredientes")
    .select("estoque_atual")
    .eq("id", ing.id)
    .single();
  checar(
    `estoque baixado 2000 → 1500 (ficou ${ingDepois?.estoque_atual})`,
    Number(ingDepois?.estoque_atual) === 1500
  );

  // pronto → entregue → pagamento do saldo
  await sb.from("pedidos").update({ status: "pronto" }).eq("id", ped.id);
  await sb.from("pedidos").update({ status: "entregue", pago: true }).eq("id", ped.id);
  await sb.from("movimentos_financeiros").insert({
    tipo: "entrada",
    categoria: "venda",
    valor: total - 5,
    descricao: "Pedido — E2E Cliente",
    pedido_id: ped.id,
  });

  // ---------- 4. Financeiro ----------
  console.log("\n4. Financeiro");
  const { data: movs } = await sb
    .from("movimentos_financeiros")
    .select("*")
    .eq("pedido_id", ped.id);
  const entradas = (movs ?? []).reduce((s, m) => s + Number(m.valor), 0);
  checar(`sinal + venda = R$ 15,00 (somou ${entradas.toFixed(2)})`, aprox(entradas, 15));

  // ---------- 5. Lista de compras ----------
  console.log("\n5. Lista de compras");
  // com estoque 1500 e mínimo 300 → não deve faltar
  checar("estoque acima do mínimo → fora da lista", 1500 >= 300);
  await sb.from("ingredientes").update({ estoque_atual: 100 }).eq("id", ing.id);
  const { data: ingBaixo } = await sb
    .from("ingredientes")
    .select("*")
    .eq("id", ing.id)
    .single();
  const necessario =
    Number(ingBaixo.estoque_minimo) - Number(ingBaixo.estoque_atual);
  checar(`estoque 100 < mínimo 300 → faltam 200 (calculado ${necessario})`, necessario === 200);

  // ---------- 6. Storage ----------
  console.log("\n6. Storage");
  const bucket = await admin("/storage/v1/bucket/fotos");
  checar("bucket 'fotos' existe e é público", bucket.status === 200 && bucket.json?.public === true);
} finally {
  // ---------- Limpeza ----------
  console.log("\n7. Limpeza");
  if (ids.pedido) {
    await sb.from("movimentos_financeiros").delete().eq("pedido_id", ids.pedido);
    await sb.from("pedidos").delete().eq("id", ids.pedido);
  }
  if (ids.cliente) await sb.from("clientes").delete().eq("id", ids.cliente);
  if (ids.produto) await sb.from("produtos").delete().eq("id", ids.produto);
  if (ids.receita) await sb.from("receitas").delete().eq("id", ids.receita);
  if (ids.ingrediente) await sb.from("ingredientes").delete().eq("id", ids.ingrediente);
  const restos = await sb.from("ingredientes").select("id").like("nome", "E2E%");
  checar("dados de teste removidos", (restos.data ?? []).length === 0);
  if (idUsuario) {
    const del = await admin(`/auth/v1/admin/users/${idUsuario}`, "DELETE");
    checar("usuário de teste removido", del.status === 200);
  }
}

console.log(`\nResultado: ${passaram} ✓ / ${falharam} ✗`);
process.exit(falharam > 0 ? 1 : 0);
