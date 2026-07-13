"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatDataEntrega } from "@/lib/format";
import {
  STATUS_CORES,
  STATUS_LABELS,
  type Ingrediente,
  type MovimentoFinanceiro,
  type Pedido,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Croissant,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ClipboardList,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default function DashboardPage() {
  const [carregando, setCarregando] = useState(true);
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [estoqueBaixo, setEstoqueBaixo] = useState<Ingrediente[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const hoje = new Date();
    const inicioMes = format(startOfMonth(hoje), "yyyy-MM-dd");
    const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

    async function carregar() {
      const [entregasRes, movRes, ingRes] = await Promise.all([
        supabase
          .from("pedidos")
          .select("*, cliente:clientes(*)")
          .in("status", ["confirmado", "em_producao", "pronto"])
          .order("data_entrega", { ascending: true, nullsFirst: false })
          .limit(6),
        supabase
          .from("movimentos_financeiros")
          .select("*")
          .gte("data", inicioMes)
          .lte("data", fimMes),
        supabase.from("ingredientes").select("*"),
      ]);
      setEntregas((entregasRes.data as Pedido[]) ?? []);
      setMovimentos((movRes.data as MovimentoFinanceiro[]) ?? []);
      setEstoqueBaixo(
        ((ingRes.data as Ingrediente[]) ?? []).filter(
          (i) => i.estoque_minimo > 0 && i.estoque_atual < i.estoque_minimo
        )
      );
      setCarregando(false);
    }
    carregar();
  }, []);

  const entradas = movimentos
    .filter((m) => m.tipo === "entrada")
    .reduce((s, m) => s + m.valor, 0);
  const saidas = movimentos
    .filter((m) => m.tipo === "saida")
    .reduce((s, m) => s + m.valor, 0);

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-primary">Olá! 🌾</h1>
          <p className="text-sm text-muted-foreground">
            Resumo da Maná neste mês
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/pedidos/novo">
            <Plus className="size-4" />
            Pedido
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-700">
              <TrendingUp className="size-4" />
              <span className="text-xs font-medium">Entradas</span>
            </div>
            <p className="mt-1 text-lg font-bold text-green-800">
              {formatBRL(entradas)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <TrendingDown className="size-4" />
              <span className="text-xs font-medium">Saídas</span>
            </div>
            <p className="mt-1 text-lg font-bold text-red-800">
              {formatBRL(saidas)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm font-medium text-muted-foreground">
            Lucro do mês
          </span>
          <span
            className={
              entradas - saidas >= 0
                ? "text-lg font-bold text-green-700"
                : "text-lg font-bold text-red-700"
            }
          >
            {formatBRL(entradas - saidas)}
          </span>
        </CardContent>
      </Card>

      {estoqueBaixo.length > 0 && (
        <Link href="/compras" className="block">
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="size-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">
                  {estoqueBaixo.length}{" "}
                  {estoqueBaixo.length === 1
                    ? "ingrediente abaixo"
                    : "ingredientes abaixo"}{" "}
                  do estoque mínimo
                </p>
                <p className="text-amber-700">
                  {estoqueBaixo
                    .slice(0, 3)
                    .map((i) => i.nome)
                    .join(", ")}
                  {estoqueBaixo.length > 3 ? "…" : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Próximas entregas</h2>
          <Link href="/agenda" className="text-sm text-primary">
            Ver agenda
          </Link>
        </div>
        {entregas.length === 0 ? (
          <EmptyState
            icone={ClipboardList}
            titulo="Nenhuma entrega pendente"
            descricao="Os pedidos confirmados aparecem aqui."
          />
        ) : (
          <div className="space-y-2">
            {entregas.map((p) => (
              <Link key={p.id} href={`/pedidos/${p.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {p.cliente?.nome ?? "Sem cliente"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDataEntrega(p.data_entrega)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={STATUS_CORES[p.status]}
                    >
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Atalhos</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="h-auto justify-start py-3">
            <Link href="/produtos">
              <Croissant className="size-4 text-primary" />
              Meus produtos
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto justify-start py-3">
            <Link href="/compras">
              <ShoppingCart className="size-4 text-primary" />
              Lista de compras
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
