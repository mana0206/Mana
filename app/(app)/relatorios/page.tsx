"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/format";
import type { MovimentoFinanceiro } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3 } from "lucide-react";

type ItemVendido = { descricao: string; quantidade: number; total: number };

export default function RelatoriosPage() {
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [maisVendidos, setMaisVendidos] = useState<ItemVendido[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const inicio = format(
        startOfMonth(subMonths(new Date(), 5)),
        "yyyy-MM-dd"
      );
      const [movRes, itensRes] = await Promise.all([
        supabase
          .from("movimentos_financeiros")
          .select("*")
          .gte("data", inicio),
        supabase
          .from("pedido_itens")
          .select("descricao, quantidade, preco_unitario, pedido:pedidos!inner(status)")
          .eq("pedido.status", "entregue"),
      ]);
      setMovimentos((movRes.data as MovimentoFinanceiro[]) ?? []);

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
    }
    carregar();
  }, []);

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
      Lucro: entradas - saidas,
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

  const temDados = movimentos.length > 0 || maisVendidos.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader titulo="Relatórios" />

      {!carregando && !temDados ? (
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
              <ResponsiveContainer width="100%" height={220}>
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
                  <Bar
                    dataKey="Entradas"
                    fill="var(--chart-5)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Saídas"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

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
