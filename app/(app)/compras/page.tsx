"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatQtd, parseDecimalSimples } from "@/lib/format";
import type { Compra, Ingrediente } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, ShoppingCart, Package, QrCode } from "lucide-react";

type Demanda = { ingrediente: Ingrediente; necessario: number };

export default function ComprasPage() {
  const [aba, setAba] = useState("lista");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [manuais, setManuais] = useState<Compra[]>([]);
  const [demandaPedidos, setDemandaPedidos] = useState<Map<string, number>>(
    new Map()
  );

  // diálogo de compra efetuada (item automático)
  const [comprando, setComprando] = useState<Demanda | null>(null);
  const [qtdComprada, setQtdComprada] = useState("");
  const [valorCompra, setValorCompra] = useState("");

  // diálogo de item manual
  const [dialogManual, setDialogManual] = useState(false);
  const [descManual, setDescManual] = useState("");

  // diálogo de ajuste de estoque
  const [ajustando, setAjustando] = useState<Ingrediente | null>(null);
  const [novoEstoque, setNovoEstoque] = useState("");

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [ingRes, manRes, pedRes] = await Promise.all([
      supabase.from("ingredientes").select("*").order("nome"),
      supabase
        .from("compras")
        .select("*, ingrediente:ingredientes(*)")
        .eq("comprado", false)
        .order("created_at"),
      supabase
        .from("pedidos")
        .select(
          "id, status, itens:pedido_itens(quantidade, produto:produtos(receita:receitas(rendimento_qtd, itens:receita_ingredientes(ingrediente_id, quantidade))))"
        )
        .eq("status", "confirmado"),
    ]);
    setIngredientes((ingRes.data as Ingrediente[]) ?? []);
    setManuais((manRes.data as Compra[]) ?? []);

    // demanda de ingredientes dos pedidos confirmados
    const demanda = new Map<string, number>();
    type PedidoDemanda = {
      itens: {
        quantidade: number;
        produto: {
          receita: {
            rendimento_qtd: number;
            itens: { ingrediente_id: string; quantidade: number }[];
          } | null;
        } | null;
      }[];
    };
    for (const ped of (pedRes.data ?? []) as unknown as PedidoDemanda[]) {
      for (const item of ped.itens) {
        const receita = item.produto?.receita;
        if (!receita || receita.rendimento_qtd <= 0) continue;
        for (const ri of receita.itens) {
          const usado =
            (ri.quantidade / receita.rendimento_qtd) * item.quantidade;
          demanda.set(
            ri.ingrediente_id,
            (demanda.get(ri.ingrediente_id) ?? 0) + usado
          );
        }
      }
    }
    setDemandaPedidos(demanda);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const listaAutomatica: Demanda[] = useMemo(() => {
    return ingredientes
      .map((ing) => {
        const demanda = demandaPedidos.get(ing.id) ?? 0;
        const necessario = ing.estoque_minimo + demanda - ing.estoque_atual;
        return { ingrediente: ing, necessario };
      })
      .filter((d) => d.necessario > 0);
  }, [ingredientes, demandaPedidos]);

  function abrirCompra(d: Demanda) {
    setComprando(d);
    setQtdComprada(String(Math.ceil(d.necessario)));
    setValorCompra("");
  }

  async function confirmarCompra(e: React.FormEvent) {
    e.preventDefault();
    if (!comprando) return;
    const supabase = createClient();
    const qtd = parseDecimalSimples(qtdComprada);
    const valor = parseDecimalSimples(valorCompra);
    await supabase
      .from("ingredientes")
      .update({
        estoque_atual: comprando.ingrediente.estoque_atual + qtd,
      })
      .eq("id", comprando.ingrediente.id);
    if (valor > 0) {
      await supabase.from("movimentos_financeiros").insert({
        tipo: "saida",
        categoria: "ingredientes",
        valor,
        descricao: `Compra — ${comprando.ingrediente.nome}`,
      });
    }
    toast.success("Estoque atualizado" + (valor > 0 ? " e gasto lançado" : ""));
    setComprando(null);
    carregar();
  }

  async function adicionarManual(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("compras").insert({ descricao: descManual.trim() });
    setDescManual("");
    setDialogManual(false);
    carregar();
  }

  async function marcarManualComprado(item: Compra) {
    const supabase = createClient();
    await supabase.from("compras").update({ comprado: true }).eq("id", item.id);
    carregar();
  }

  async function salvarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!ajustando) return;
    const supabase = createClient();
    await supabase
      .from("ingredientes")
      .update({ estoque_atual: parseDecimalSimples(novoEstoque) })
      .eq("id", ajustando.id);
    setAjustando(null);
    carregar();
  }

  return (
    <div>
      <PageHeader
        titulo="Compras & Estoque"
        acao={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/compras/nota">
                <QrCode className="size-4" />
                Nota
              </Link>
            </Button>
            {aba === "lista" && (
              <Button size="sm" onClick={() => setDialogManual(true)}>
                <Plus className="size-4" />
                Item
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={aba} onValueChange={setAba} className="mb-4">
        <TabsList className="w-full">
          <TabsTrigger value="lista" className="flex-1">
            Lista de compras
          </TabsTrigger>
          <TabsTrigger value="estoque" className="flex-1">
            Estoque
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {aba === "lista" ? (
        <div className="space-y-4">
          {listaAutomatica.length === 0 && manuais.length === 0 ? (
            <EmptyState
              icone={ShoppingCart}
              titulo="Nada para comprar 🎉"
              descricao="Itens aparecem aqui quando o estoque fica abaixo do mínimo ou pedidos confirmados precisam de ingredientes."
            />
          ) : (
            <>
              {listaAutomatica.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Ingredientes em falta
                  </h2>
                  {listaAutomatica.map((d) => (
                    <Card key={d.ingrediente.id}>
                      <CardContent className="flex items-center justify-between gap-2 p-4">
                        <div>
                          <p className="font-medium">{d.ingrediente.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            Faltam {formatQtd(d.necessario)}{" "}
                            {d.ingrediente.unidade_uso} (tem{" "}
                            {formatQtd(d.ingrediente.estoque_atual)})
                          </p>
                        </div>
                        <Button size="sm" onClick={() => abrirCompra(d)}>
                          Comprei
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              )}
              {manuais.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Outros itens
                  </h2>
                  {manuais.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <Checkbox
                          onCheckedChange={() => marcarManualComprado(item)}
                        />
                        <p className="flex-1 font-medium">{item.descricao}</p>
                      </CardContent>
                    </Card>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {ingredientes.length === 0 ? (
            <EmptyState
              icone={Package}
              titulo="Nenhum ingrediente cadastrado"
            />
          ) : (
            ingredientes.map((ing) => (
              <Card key={ing.id}>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{ing.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatQtd(ing.estoque_atual)} {ing.unidade_uso}
                      {ing.estoque_minimo > 0 &&
                        ` · mín. ${formatQtd(ing.estoque_minimo)}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAjustando(ing);
                      setNovoEstoque(
                        String(ing.estoque_atual).replace(".", ",")
                      );
                    }}
                  >
                    Ajustar
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog
        open={!!comprando}
        onOpenChange={(aberto) => !aberto && setComprando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprei {comprando?.ingrediente.nome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={confirmarCompra} className="space-y-4">
            <div className="space-y-2">
              <Label>
                Quantidade comprada ({comprando?.ingrediente.unidade_uso})
              </Label>
              <Input
                inputMode="decimal"
                value={qtdComprada}
                onChange={(e) => setQtdComprada(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Valor gasto (R$) — opcional</Label>
              <Input
                inputMode="decimal"
                value={valorCompra}
                onChange={(e) => setValorCompra(e.target.value)}
                placeholder="Lança como saída no financeiro"
              />
            </div>
            <Button type="submit" className="w-full">
              Confirmar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogManual} onOpenChange={setDialogManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar à lista</DialogTitle>
          </DialogHeader>
          <form onSubmit={adicionarManual} className="space-y-4">
            <div className="space-y-2">
              <Label>O que comprar?</Label>
              <Input
                value={descManual}
                onChange={(e) => setDescManual(e.target.value)}
                placeholder="Ex: forminhas nº 4, fita rosa..."
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Adicionar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!ajustando}
        onOpenChange={(aberto) => !aberto && setAjustando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar estoque — {ajustando?.nome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarAjuste} className="space-y-4">
            <div className="space-y-2">
              <Label>Estoque atual ({ajustando?.unidade_uso})</Label>
              <Input
                inputMode="decimal"
                value={novoEstoque}
                onChange={(e) => setNovoEstoque(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
