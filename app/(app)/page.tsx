"use client";

import { useCallback, useEffect, useState } from "react";
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
  CookingPot,
  WifiOff,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfMonth, endOfMonth, format, isToday } from "date-fns";

export default function DashboardPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [estoqueBaixo, setEstoqueBaixo] = useState<Ingrediente[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const supabase = createClient();
    const hoje = new Date();
    const inicioMes = format(startOfMonth(hoje), "yyyy-MM-dd");
    const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

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
    if (entregasRes.error || movRes.error || ingRes.error) {
      setErro(true);
      setCarregando(false);
      return;
    }
    setEntregas((entregasRes.data as Pedido[]) ?? []);
    setMovimentos((movRes.data as MovimentoFinanceiro[]) ?? []);
    setEstoqueBaixo(
      ((ingRes.data as Ingrediente[]) ?? []).filter(
        (i) => i.estoque_minimo > 0 && i.estoque_atual < i.estoque_minimo
      )
    );
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const entradas = movimentos
    .filter((m) => m.tipo === "entrada")
    .reduce((s, m) => s + m.valor, 0);
  const saidas = movimentos
    .filter((m) => m.tipo === "saida")
    .reduce((s, m) => s + m.valor, 0);

  const entregasHoje = entregas.filter(
    (p) => p.data_entrega && isToday(new Date(p.data_entrega))
  );

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 text-center">
        <WifiOff className="size-8 text-muted-foreground/60" />
        <p className="font-medium text-muted-foreground">Sem conexão</p>
        <p className="max-w-xs text-sm text-muted-foreground/70">
          Não consegui carregar os dados. Verifique a internet e tente de
          novo.
        </p>
        <Button variant="outline" size="sm" onClick={carregar}>
          <RotateCw className="size-4" />
          Tentar de novo
        </Button>
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

      <Card className="border-primary/30 bg-secondary/50">
        <CardContent className="flex items-center gap-3 p-4">
          <CookingPot className="size-5 shrink-0 text-primary" />
          <p className="text-sm">
            <strong className="text-foreground">Hoje:</strong>{" "}
            {entregasHoje.length === 0
              ? "nenhuma entrega agendada"
              : `${entregasHoje.length} ${entregasHoje.length === 1 ? "entrega" : "entregas"}`}
            {estoqueBaixo.length > 0 && (
              <>
                {" · "}
                {estoqueBaixo.length}{" "}
                {estoqueBaixo.length === 1 ? "ingrediente" : "ingredientes"} em
                falta
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-[#8c9a5d]/40 bg-[#8c9a5d]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#5f6a3d]">
              <TrendingUp className="size-4" />
              <span className="text-xs font-medium">Entradas</span>
            </div>
            <p className="mt-1 text-lg font-bold text-[#3a4720]">
              {formatBRL(entradas)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <TrendingDown className="size-4" />
              <span className="text-xs font-medium">Saídas</span>
            </div>
            <p className="mt-1 text-lg font-bold text-destructive">
              {formatBRL(saidas)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm font-medium text-muted-foreground">
            Saldo do mês
          </span>
          <span
            className={
              entradas - saidas >= 0
                ? "text-lg font-bold text-[#3a4720]"
                : "text-lg font-bold text-destructive"
            }
          >
            {formatBRL(entradas - saidas)}
          </span>
        </CardContent>
      </Card>

      {estoqueBaixo.length > 0 && (
        <Link href="/compras" className="block">
          <Card className="border-[#b3a268]/50 bg-[#b3a268]/10">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="size-5 shrink-0 text-[#8a7a3f]" />
              <div className="text-sm">
                <p className="font-medium text-[#3a4720]">
                  {estoqueBaixo.length}{" "}
                  {estoqueBaixo.length === 1
                    ? "ingrediente abaixo"
                    : "ingredientes abaixo"}{" "}
                  do estoque mínimo
                </p>
                <p className="text-[#6b5e2e]">
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
