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
import { toast } from "sonner";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

export default function FinanceiroPage() {
  const [mes, setMes] = useState(new Date());
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [aReceber, setAReceber] = useState<Pedido[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);

  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("outros");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));

  const carregar = useCallback(async () => {
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
    setMovimentos((movRes.data as MovimentoFinanceiro[]) ?? []);
    setAReceber(
      ((pedRes.data as Pedido[]) ?? []).filter(
        (p) => saldoPedido(p, p.itens ?? []) > 0
      )
    );
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

  async function excluir(m: MovimentoFinanceiro) {
    const supabase = createClient();
    await supabase.from("movimentos_financeiros").delete().eq("id", m.id);
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
          onClick={() => setMes(subMonths(mes, 1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="font-semibold capitalize">{formatMesAno(mes)}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMes(addMonths(mes, 1))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-green-700">
              <TrendingUp className="size-3.5" />
              <span className="text-[11px] font-medium">Entradas</span>
            </div>
            <p className="mt-0.5 text-sm font-bold text-green-800">
              {formatBRL(entradas)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-red-700">
              <TrendingDown className="size-3.5" />
              <span className="text-[11px] font-medium">Saídas</span>
            </div>
            <p className="mt-0.5 text-sm font-bold text-red-800">
              {formatBRL(saidas)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Wallet className="size-3.5" />
              <span className="text-[11px] font-medium">Lucro</span>
            </div>
            <p
              className={
                "mt-0.5 text-sm font-bold " +
                (entradas - saidas >= 0 ? "text-green-800" : "text-red-800")
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
                <Card className="border-amber-200 bg-amber-50/50 transition-colors hover:bg-amber-100/50">
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <span className="font-medium">
                      {p.cliente?.nome ?? "Sem cliente"}
                    </span>
                    <span className="font-semibold text-amber-800">
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
                          ? "text-green-700"
                          : "text-red-700")
                      }
                    >
                      {m.tipo === "entrada" ? "+" : "-"}
                      {formatBRL(m.valor)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => excluir(m)}
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
    </div>
  );
}
