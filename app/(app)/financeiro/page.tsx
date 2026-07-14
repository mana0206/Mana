"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { saldoPedido } from "@/lib/calc";
import { formatBRL, formatData, formatMesAno, parseDecimalSimples } from "@/lib/format";
import {
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SAIDA,
  type MovimentoFinanceiro,
  type Pedido,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  WifiOff,
} from "lucide-react";

export default function FinanceiroPage() {
  const [mes, setMes] = useState(new Date());
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [aReceber, setAReceber] = useState<Pedido[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [excluindoMov, setExcluindoMov] = useState<MovimentoFinanceiro | null>(
    null
  );

  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("outros");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const supabase = createClient();
    const inicio = format(startOfMonth(mes), "yyyy-MM-dd");
    const fim = format(endOfMonth(mes), "yyyy-MM-dd");
    const [movRes, pedRes] = await Promise.all([
      supabase
        .from("movimentos_financeiros")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("pedidos")
        .select("*, cliente:clientes(*), itens:pedido_itens(*)")
        .eq("pago", false)
        .in("status", ["confirmado", "em_producao", "pronto", "entregue"]),
    ]);
    if (movRes.error || pedRes.error) {
      setErro(true);
      setCarregando(false);
      return;
    }
    setMovimentos((movRes.data as MovimentoFinanceiro[]) ?? []);
    setAReceber(
      ((pedRes.data as Pedido[]) ?? []).filter(
        (p) => saldoPedido(p, p.itens ?? []) > 0
      )
    );
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const entradas = movimentos
    .filter((m) => m.tipo === "entrada")
    .reduce((s, m) => s + m.valor, 0);
  const saidas = movimentos
    .filter((m) => m.tipo === "saida")
    .reduce((s, m) => s + m.valor, 0);
  const totalReceber = aReceber.reduce(
    (s, p) => s + saldoPedido(p, p.itens ?? []),
    0
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from("movimentos_financeiros").insert({
      tipo,
      categoria,
      valor: parseDecimalSimples(valor),
      descricao: descricao.trim() || null,
      data,
    });
    if (error) {
      toast.error("Erro ao lançar");
      return;
    }
    toast.success("Lançamento registrado");
    setDialogAberto(false);
    setValor("");
    setDescricao("");
    carregar();
  }

  async function excluir() {
    if (!excluindoMov) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("movimentos_financeiros")
      .delete()
      .eq("id", excluindoMov.id);
    setExcluindoMov(null);
    if (error) {
      toast.error("Erro ao excluir o lançamento");
      return;
    }
    toast.success("Lançamento excluído");
    carregar();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Financeiro"
        acao={
          <Button size="sm" onClick={() => setDialogAberto(true)}>
            <Plus className="size-4" />
            Lançar
          </Button>
        }
      />

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Mês anterior"
          onClick={() => setMes(subMonths(mes, 1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="font-semibold capitalize">{formatMesAno(mes)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Próximo mês"
          onClick={() => setMes(addMonths(mes, 1))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {carregando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-40" />
        </div>
      ) : erro ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <WifiOff className="size-8 text-muted-foreground/60" />
          <p className="font-medium text-muted-foreground">Sem conexão</p>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RotateCw className="size-4" />
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Card className="border-[#8c9a5d]/40 bg-[#8c9a5d]/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 text-[#5f6a3d]">
                  <TrendingUp className="size-3.5" />
                  <span className="text-[11px] font-medium">Entradas</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-[#3a4720]">
                  {formatBRL(entradas)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-1 text-destructive">
                  <TrendingDown className="size-3.5" />
                  <span className="text-[11px] font-medium">Saídas</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-destructive">
                  {formatBRL(saidas)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Wallet className="size-3.5" />
                  <span className="text-[11px] font-medium">Saldo</span>
                </div>
                <p
                  className={
                    "mt-0.5 text-sm font-bold " +
                    (entradas - saidas >= 0
                      ? "text-[#3a4720]"
                      : "text-destructive")
                  }
                >
                  {formatBRL(entradas - saidas)}
                </p>
              </CardContent>
            </Card>
          </div>

          {aReceber.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                A receber — {formatBRL(totalReceber)}
              </h2>
              <div className="space-y-2">
                {aReceber.map((p) => (
                  <Link key={p.id} href={`/pedidos/${p.id}`} className="block">
                    <Card className="border-[#b3a268]/40 bg-[#b3a268]/10 transition-colors hover:bg-[#b3a268]/20">
                      <CardContent className="flex items-center justify-between p-3 text-sm">
                        <span className="font-medium">
                          {p.cliente?.nome ?? "Sem cliente"}
                        </span>
                        <span className="font-semibold text-[#6b5e2e]">
                          {formatBRL(saldoPedido(p, p.itens ?? []))}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Lançamentos do mês
            </h2>
            {movimentos.length === 0 ? (
              <EmptyState
                icone={Wallet}
                titulo="Nenhum lançamento"
                descricao="Entradas de pedidos pagos e gastos aparecem aqui."
              />
            ) : (
              <div className="space-y-2">
                {movimentos.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {m.descricao || m.categoria}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatData(m.data)} · {m.categoria}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span
                          className={
                            "text-sm font-semibold " +
                            (m.tipo === "entrada"
                              ? "text-[#3a4720]"
                              : "text-destructive")
                          }
                        >
                          {m.tipo === "entrada" ? "+" : "-"}
                          {formatBRL(m.valor)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          aria-label={`Excluir lançamento ${m.descricao || m.categoria}`}
                          onClick={() => setExcluindoMov(m)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <Tabs
              value={tipo}
              onValueChange={(v) => {
                setTipo(v as "entrada" | "saida");
                setCategoria("outros");
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="saida" className="flex-1">
                  Saída
                </TabsTrigger>
                <TabsTrigger value="entrada" className="flex-1">
                  Entrada
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(tipo === "entrada"
                    ? CATEGORIAS_ENTRADA
                    : CATEGORIAS_SAIDA
                  ).map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: gás, feira, embalagens..."
              />
            </div>
            <Button type="submit" className="w-full">
              Lançar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!excluindoMov}
        onOpenChange={(aberto) => !aberto && setExcluindoMov(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindoMov?.tipo === "entrada" ? "Entrada" : "Saída"} de{" "}
              {formatBRL(excluindoMov?.valor ?? 0)}
              {excluindoMov?.descricao ? ` — ${excluindoMov.descricao}` : ""}.
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
