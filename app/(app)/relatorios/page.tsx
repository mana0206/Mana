"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { custoComFixos, custoIngredientes } from "@/lib/calc";
import { formatBRL } from "@/lib/format";
import type {
  CustoFixo,
  MovimentoFinanceiro,
  Produto,
  Receita,
  ReceitaIngrediente,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, RotateCw, WifiOff } from "lucide-react";

type ItemVendido = { descricao: string; quantidade: number; total: number };
type ReceitaComItens = Receita & { itens: ReceitaIngrediente[] };
type MargemProduto = {
  nome: string;
  custo: number;
  preco: number;
  margemPct: number;
};

export default function RelatoriosPage() {
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [maisVendidos, setMaisVendidos] = useState<ItemVendido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [receitas, setReceitas] = useState<ReceitaComItens[]>([]);
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const supabase = createClient();
    const inicio = format(
      startOfMonth(subMonths(new Date(), 5)),
      "yyyy-MM-dd"
    );
    const [movRes, itensRes, prodRes, recRes, cfRes] = await Promise.all([
      supabase.from("movimentos_financeiros").select("*").gte("data", inicio),
      supabase
        .from("pedido_itens")
        .select(
          "descricao, quantidade, preco_unitario, pedido:pedidos!inner(status)"
        )
        .eq("pedido.status", "entregue"),
      supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
      supabase
        .from("receitas")
        .select(
          "*, itens:receita_ingredientes(*, ingrediente:ingredientes(*))"
        ),
      supabase.from("custos_fixos").select("*"),
    ]);
    if (
      movRes.error ||
      itensRes.error ||
      prodRes.error ||
      recRes.error ||
      cfRes.error
    ) {
      setErro(true);
      setCarregando(false);
      return;
    }
    setMovimentos((movRes.data as MovimentoFinanceiro[]) ?? []);
    setProdutos((prodRes.data as Produto[]) ?? []);
    setReceitas((recRes.data as ReceitaComItens[]) ?? []);
    setCustosFixos((cfRes.data as CustoFixo[]) ?? []);

    const porItem = new Map<string, ItemVendido>();
    type ItemRow = {
      descricao: string;
      quantidade: number;
      preco_unitario: number;
    };
    for (const item of (itensRes.data ?? []) as unknown as ItemRow[]) {
      const chave = item.descricao.toLowerCase();
      const atual = porItem.get(chave) ?? {
        descricao: item.descricao,
        quantidade: 0,
        total: 0,
      };
      atual.quantidade += item.quantidade;
      atual.total += item.quantidade * item.preco_unitario;
      porItem.set(chave, atual);
    }
    setMaisVendidos(
      Array.from(porItem.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // agrega por mês (últimos 6)
  const meses = Array.from({ length: 6 }, (_, i) =>
    startOfMonth(subMonths(new Date(), 5 - i))
  );
  const dadosMensais = meses.map((m) => {
    const chave = format(m, "yyyy-MM");
    const doMes = movimentos.filter((mov) => mov.data.startsWith(chave));
    const entradas = doMes
      .filter((mov) => mov.tipo === "entrada")
      .reduce((s, mov) => s + mov.valor, 0);
    const saidas = doMes
      .filter((mov) => mov.tipo === "saida")
      .reduce((s, mov) => s + mov.valor, 0);
    return {
      mes: format(m, "MMM", { locale: ptBR }),
      Entradas: entradas,
      Saídas: saidas,
    };
  });

  const gastosPorCategoria = Object.entries(
    movimentos
      .filter((m) => m.tipo === "saida")
      .reduce<Record<string, number>>((acc, m) => {
        acc[m.categoria] = (acc[m.categoria] ?? 0) + m.valor;
        return acc;
      }, {})
  ).sort((a, b) => b[1] - a[1]);

  const custoPorReceita = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of receitas) {
      const total = custoComFixos(custoIngredientes(r.itens), custosFixos);
      mapa.set(r.id, r.rendimento_qtd > 0 ? total / r.rendimento_qtd : total);
    }
    return mapa;
  }, [receitas, custosFixos]);

  const margemPorProduto: MargemProduto[] = useMemo(() => {
    return produtos
      .map((p) => {
        const custo =
          p.custo_manual != null
            ? p.custo_manual
            : p.receita_id
              ? (custoPorReceita.get(p.receita_id) ?? 0)
              : 0;
        const preco = p.preco_venda ?? custo * (1 + p.margem / 100);
        const margemPct = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
        return { nome: p.nome, custo, preco, margemPct };
      })
      .filter((m) => m.preco > 0)
      .sort((a, b) => a.margemPct - b.margemPct);
  }, [produtos, custoPorReceita]);

  const temDados = movimentos.length > 0 || maisVendidos.length > 0;

  if (carregando) {
    return (
      <div className="space-y-4">
        <PageHeader titulo="Relatórios" />
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <PageHeader titulo="Relatórios" />
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <WifiOff className="size-8 text-muted-foreground/60" />
          <p className="font-medium text-muted-foreground">Sem conexão</p>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RotateCw className="size-4" />
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader titulo="Relatórios" />

      {!temDados ? (
        <EmptyState
          icone={BarChart3}
          titulo="Ainda sem dados"
          descricao="Conforme você registra pedidos e lançamentos, os gráficos aparecem aqui."
        />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Entradas × Saídas (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" fontSize={12} tickLine={false} />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                    width={40}
                  />
                  <Tooltip
                    formatter={(v) => formatBRL(Number(v))}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="Entradas"
                    fill="#8c9a5d"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="Saídas" fill="#b3a268" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {margemPorProduto.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Margem por produto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {margemPorProduto.map((m) => (
                    <div key={m.nome}>
                      <div className="mb-0.5 flex justify-between text-sm">
                        <span className="truncate">{m.nome}</span>
                        <span
                          className={
                            "shrink-0 font-semibold " +
                            (m.margemPct < 30
                              ? "text-destructive"
                              : m.margemPct < 50
                                ? "text-[#8a7a3f]"
                                : "text-[#3a4720]")
                          }
                        >
                          {m.margemPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={
                            "h-full rounded-full " +
                            (m.margemPct < 30
                              ? "bg-destructive"
                              : m.margemPct < 50
                                ? "bg-[#b3a268]"
                                : "bg-[#586b32]")
                          }
                          style={{
                            width: `${Math.max(4, Math.min(100, m.margemPct))}%`,
                          }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Custo {formatBRL(m.custo)} · Preço {formatBRL(m.preco)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mais vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {maisVendidos.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Nenhum pedido entregue ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {maisVendidos.map((item, i) => (
                    <div
                      key={item.descricao}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="mr-2 font-semibold text-primary">
                          {i + 1}º
                        </span>
                        {item.descricao}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {item.quantidade.toLocaleString("pt-BR")}x ·{" "}
                        <span className="font-medium text-foreground">
                          {formatBRL(item.total)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Gastos por categoria (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gastosPorCategoria.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Nenhum gasto registrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {gastosPorCategoria.map(([cat, total]) => {
                    const max = gastosPorCategoria[0][1];
                    return (
                      <div key={cat}>
                        <div className="mb-0.5 flex justify-between text-sm">
                          <span className="capitalize">{cat}</span>
                          <span className="font-medium">
                            {formatBRL(total)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(total / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
