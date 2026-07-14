"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatQtd, parseDecimalSimples } from "@/lib/format";
import type { Compra, Ingrediente, Produto } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus,
  ShoppingCart,
  Package,
  QrCode,
  Croissant,
  RotateCw,
  WifiOff,
} from "lucide-react";

type Demanda = { ingrediente: Ingrediente; necessario: number };

export default function ComprasPage() {
  const [aba, setAba] = useState("lista");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [manuais, setManuais] = useState<Compra[]>([]);
  const [demandaPedidos, setDemandaPedidos] = useState<Map<string, number>>(
    new Map()
  );

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  // diálogo de compra efetuada (item automático)
  const [comprando, setComprando] = useState<Demanda | null>(null);
  const [qtdComprada, setQtdComprada] = useState("");
  const [valorCompra, setValorCompra] = useState("");
  const [novaEmbalagemQtd, setNovaEmbalagemQtd] = useState("");
  const [processandoCompra, setProcessandoCompra] = useState(false);

  // diálogo de item manual
  const [dialogManual, setDialogManual] = useState(false);
  const [descManual, setDescManual] = useState("");

  // diálogo de ajuste de estoque (ingredientes)
  const [ajustando, setAjustando] = useState<Ingrediente | null>(null);
  const [novoEstoque, setNovoEstoque] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");

  // diálogo de ajuste de estoque (produtos prontos)
  const [ajustandoProduto, setAjustandoProduto] = useState<Produto | null>(
    null
  );
  const [novoEstoqueProduto, setNovoEstoqueProduto] = useState("");
  const [motivoAjusteProduto, setMotivoAjusteProduto] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const supabase = createClient();
    const [ingRes, prodRes, manRes, pedRes] = await Promise.all([
      supabase.from("ingredientes").select("*").order("nome"),
      supabase.from("produtos").select("*").order("nome"),
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
    if (ingRes.error || prodRes.error || manRes.error || pedRes.error) {
      setErro(true);
      setCarregando(false);
      return;
    }
    setIngredientes((ingRes.data as Ingrediente[]) ?? []);
    setProdutos((prodRes.data as Produto[]) ?? []);
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
    setCarregando(false);
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
    setNovaEmbalagemQtd("");
  }

  async function confirmarCompra(e: React.FormEvent) {
    e.preventDefault();
    if (!comprando) return;
    setProcessandoCompra(true);
    const supabase = createClient();
    const qtd = parseDecimalSimples(qtdComprada);
    const valor = parseDecimalSimples(valorCompra);
    const conteudoEmbalagem = parseDecimalSimples(novaEmbalagemQtd);

    const atualizacaoEstoque: Record<string, number> = {
      estoque_atual: comprando.ingrediente.estoque_atual + qtd,
    };
    // se informou o conteúdo da embalagem e o valor pago, recalcula o
    // custo do ingrediente pela compra mais recente (correção: antes só
    // a importação de nota QR atualizava o custo, deixando a ficha
    // técnica com preço defasado quando a compra era manual)
    if (conteudoEmbalagem > 0 && valor > 0) {
      atualizacaoEstoque.preco_compra = valor;
      atualizacaoEstoque.quantidade_embalagem = conteudoEmbalagem;
    }

    const { error: erroEstoque } = await supabase
      .from("ingredientes")
      .update(atualizacaoEstoque)
      .eq("id", comprando.ingrediente.id);
    if (erroEstoque) {
      setProcessandoCompra(false);
      toast.error("Erro ao atualizar o estoque");
      return;
    }
    if (valor > 0) {
      const { error: erroMov } = await supabase
        .from("movimentos_financeiros")
        .insert({
          tipo: "saida",
          categoria: "ingredientes",
          valor,
          descricao: `Compra — ${comprando.ingrediente.nome}`,
        });
      if (erroMov) {
        setProcessandoCompra(false);
        toast.error("Estoque atualizado, mas houve erro ao lançar o gasto");
        return;
      }
    }
    setProcessandoCompra(false);
    toast.success(
      "Estoque atualizado" +
        (valor > 0 ? " e gasto lançado" : "") +
        (conteudoEmbalagem > 0 && valor > 0 ? " · custo recalculado" : "")
    );
    setComprando(null);
    carregar();
  }

  async function adicionarManual(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase
      .from("compras")
      .insert({ descricao: descManual.trim() });
    if (error) {
      toast.error("Erro ao adicionar item");
      return;
    }
    setDescManual("");
    setDialogManual(false);
    carregar();
  }

  async function marcarManualComprado(item: Compra) {
    const supabase = createClient();
    const { error } = await supabase
      .from("compras")
      .update({ comprado: true })
      .eq("id", item.id);
    if (error) {
      toast.error("Erro ao marcar como comprado");
      return;
    }
    carregar();
  }

  async function salvarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!ajustando) return;
    const supabase = createClient();
    const novoValor = parseDecimalSimples(novoEstoque);
    const { error } = await supabase
      .from("ingredientes")
      .update({ estoque_atual: novoValor })
      .eq("id", ajustando.id);
    if (error) {
      toast.error("Erro ao ajustar o estoque");
      return;
    }
    await supabase.from("ajustes_estoque").insert({
      ingrediente_id: ajustando.id,
      estoque_anterior: ajustando.estoque_atual,
      estoque_novo: novoValor,
      motivo: motivoAjuste.trim() || null,
    });
    setAjustando(null);
    setMotivoAjuste("");
    carregar();
  }

  async function salvarAjusteProduto(e: React.FormEvent) {
    e.preventDefault();
    if (!ajustandoProduto) return;
    const supabase = createClient();
    const novoValor = parseDecimalSimples(novoEstoqueProduto);
    const { error } = await supabase
      .from("produtos")
      .update({ estoque_atual: novoValor })
      .eq("id", ajustandoProduto.id);
    if (error) {
      toast.error("Erro ao ajustar o estoque");
      return;
    }
    await supabase.from("ajustes_estoque").insert({
      produto_id: ajustandoProduto.id,
      estoque_anterior: ajustandoProduto.estoque_atual,
      estoque_novo: novoValor,
      motivo: motivoAjusteProduto.trim() || null,
    });
    setAjustandoProduto(null);
    setMotivoAjusteProduto("");
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
            Compras
          </TabsTrigger>
          <TabsTrigger value="estoque" className="flex-1">
            Ingredientes
          </TabsTrigger>
          <TabsTrigger value="prontos" className="flex-1">
            Prontos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {carregando ? (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
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
      ) : aba === "lista" ? (
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
      ) : aba === "estoque" ? (
        <div className="space-y-2">
          <p className="mb-1 text-sm text-muted-foreground">
            Matéria-prima usada nas receitas (farinha, leite, ovos, óleo...).
          </p>
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
                      setMotivoAjuste("");
                    }}
                  >
                    Ajustar
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="mb-1 text-sm text-muted-foreground">
            Produtos prontos para vender (bolo, enroladinho, pão...),
            creditados quando você registra uma produção.
          </p>
          {produtos.length === 0 ? (
            <EmptyState icone={Croissant} titulo="Nenhum produto cadastrado" />
          ) : (
            produtos.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatQtd(p.estoque_atual)} em estoque
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAjustandoProduto(p);
                      setNovoEstoqueProduto(
                        String(p.estoque_atual).replace(".", ",")
                      );
                      setMotivoAjusteProduto("");
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
              <Label>Valor pago (R$) — opcional</Label>
              <Input
                inputMode="decimal"
                value={valorCompra}
                onChange={(e) => setValorCompra(e.target.value)}
                placeholder="Lança como saída no financeiro"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Conteúdo da embalagem comprada ({comprando?.ingrediente.unidade_uso}) — opcional
              </Label>
              <Input
                inputMode="decimal"
                value={novaEmbalagemQtd}
                onChange={(e) => setNovaEmbalagemQtd(e.target.value)}
                placeholder="Ex: 1000 (se comprou um pacote de 1kg)"
              />
              <p className="text-xs text-muted-foreground">
                Informe junto com o valor pago para atualizar o custo do
                ingrediente nas receitas.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={processandoCompra}>
              {processandoCompra ? "Confirmando..." : "Confirmar"}
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
            <div className="space-y-2">
              <Label>Motivo do ajuste — opcional</Label>
              <Input
                value={motivoAjuste}
                onChange={(e) => setMotivoAjuste(e.target.value)}
                placeholder="Ex: perda, inventário, correção..."
              />
            </div>
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!ajustandoProduto}
        onOpenChange={(aberto) => !aberto && setAjustandoProduto(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar estoque — {ajustandoProduto?.nome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarAjusteProduto} className="space-y-4">
            <div className="space-y-2">
              <Label>Quantidade em estoque</Label>
              <Input
                inputMode="decimal"
                value={novoEstoqueProduto}
                onChange={(e) => setNovoEstoqueProduto(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo do ajuste — opcional</Label>
              <Input
                value={motivoAjusteProduto}
                onChange={(e) => setMotivoAjusteProduto(e.target.value)}
                placeholder="Ex: perda, inventário, correção..."
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
