"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saldoPedido, subtotalPedido, totalPedido } from "@/lib/calc";
import {
  formatBRL,
  formatDataEntrega,
  parseDecimalSimples,
  telefoneParaWhatsApp,
} from "@/lib/format";
import {
  PROXIMO_STATUS,
  STATUS_CORES,
  STATUS_LABELS,
  type Pedido,
  type PedidoItem,
  type Produto,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DataHoraInput,
  dataHoraParaISO,
  isoParaDataHora,
} from "@/components/data-hora-input";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

const STATUS_FINALIZADOS = ["entregue", "cancelado"];

export default function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [processando, setProcessando] = useState(false);
  const [confirmaCancelar, setConfirmaCancelar] = useState(false);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [dialogItem, setDialogItem] = useState(false);
  const [dialogEditar, setDialogEditar] = useState(false);

  // formulário de item
  const [itemProdutoId, setItemProdutoId] = useState("");
  const [itemDescricao, setItemDescricao] = useState("");
  const [itemQtd, setItemQtd] = useState("1");
  const [itemPreco, setItemPreco] = useState("");

  // formulário de edição
  const [editEntrega, setEditEntrega] = useState("");
  const [editDesconto, setEditDesconto] = useState("");
  const [editSinal, setEditSinal] = useState("");
  const [editObs, setEditObs] = useState("");

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [pedRes, prodRes] = await Promise.all([
      supabase
        .from("pedidos")
        .select("*, cliente:clientes(*), itens:pedido_itens(*)")
        .eq("id", id)
        .single(),
      supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
    ]);
    setPedido(pedRes.data as Pedido);
    setProdutos((prodRes.data as Produto[]) ?? []);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando || !pedido) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const itens = pedido.itens ?? [];
  const subtotal = subtotalPedido(itens);
  const total = totalPedido(pedido, itens);
  const saldo = saldoPedido(pedido, itens);
  const finalizado = STATUS_FINALIZADOS.includes(pedido.status);
  const proximo = PROXIMO_STATUS[pedido.status];

  async function registrarMovimentoUnico(
    categoria: string,
    valor: number,
    descricao: string
  ) {
    if (valor <= 0) return;
    const supabase = createClient();
    const { data: existentes } = await supabase
      .from("movimentos_financeiros")
      .select("id")
      .eq("pedido_id", id)
      .eq("categoria", categoria)
      .limit(1);
    if (existentes && existentes.length > 0) return;
    await supabase.from("movimentos_financeiros").insert({
      tipo: "entrada",
      categoria,
      valor,
      descricao,
      pedido_id: id,
    });
  }

  // Na entrega, baixa o estoque de produto acabado (a matéria-prima já foi
  // baixada quando a receita foi produzida, na tela da Receita).
  async function baixarEstoqueProdutos() {
    const supabase = createClient();
    const itensComProduto = itens.filter((i) => i.produto_id);
    if (itensComProduto.length === 0) return;
    const { data: prods } = await supabase
      .from("produtos")
      .select("id, estoque_atual")
      .in("id", itensComProduto.map((i) => i.produto_id));
    if (!prods) return;
    await Promise.all(
      prods.map((prod) => {
        const vendido = itensComProduto
          .filter((i) => i.produto_id === prod.id)
          .reduce((s, i) => s + i.quantidade, 0);
        return supabase
          .from("produtos")
          .update({ estoque_atual: Math.max(0, prod.estoque_atual - vendido) })
          .eq("id", prod.id);
      })
    );
    toast.info("Estoque de produtos baixado");
  }

  async function avancarStatus() {
    if (!proximo || !pedido) return;
    setProcessando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("pedidos")
      .update({ status: proximo })
      .eq("id", id);
    if (error) {
      setProcessando(false);
      toast.error("Erro ao atualizar status");
      return;
    }
    if (proximo === "confirmado" && pedido.sinal > 0) {
      await registrarMovimentoUnico(
        "sinal",
        pedido.sinal,
        `Sinal — ${pedido.cliente?.nome ?? "pedido"}`
      );
      toast.success("Sinal registrado no financeiro");
    }
    if (proximo === "entregue") {
      await baixarEstoqueProdutos();
    }
    setProcessando(false);
    carregar();
  }

  async function marcarPago() {
    if (!pedido) return;
    setProcessando(true);
    const supabase = createClient();
    await registrarMovimentoUnico(
      "venda",
      saldo,
      `Pedido — ${pedido.cliente?.nome ?? "sem cliente"}`
    );
    await supabase.from("pedidos").update({ pago: true }).eq("id", id);
    setProcessando(false);
    toast.success("Pagamento registrado no financeiro");
    carregar();
  }

  async function cancelar() {
    const supabase = createClient();
    await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", id);
    setConfirmaCancelar(false);
    carregar();
  }

  async function excluirPedido() {
    const supabase = createClient();
    await supabase.from("pedidos").delete().eq("id", id);
    router.push("/pedidos");
  }

  function abrirDialogItem() {
    setItemProdutoId("");
    setItemDescricao("");
    setItemQtd("1");
    setItemPreco("");
    setDialogItem(true);
  }

  function escolherProdutoItem(produtoId: string) {
    const p = produtos.find((x) => x.id === produtoId);
    setItemProdutoId(produtoId);
    if (p) {
      setItemDescricao(p.nome);
      if (p.preco_venda != null) {
        setItemPreco(String(p.preco_venda).replace(".", ","));
      }
    }
  }

  async function adicionarItem(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from("pedido_itens").insert({
      pedido_id: id,
      produto_id: itemProdutoId || null,
      descricao: itemDescricao.trim(),
      quantidade: parseDecimalSimples(itemQtd),
      preco_unitario: parseDecimalSimples(itemPreco),
    });
    if (error) {
      toast.error("Erro ao adicionar item");
      return;
    }
    setDialogItem(false);
    carregar();
  }

  async function removerItem(item: PedidoItem) {
    const supabase = createClient();
    await supabase.from("pedido_itens").delete().eq("id", item.id);
    carregar();
  }

  function abrirEditar() {
    setEditEntrega(isoParaDataHora(pedido?.data_entrega ?? null));
    setEditDesconto(String(pedido?.desconto ?? 0).replace(".", ","));
    setEditSinal(String(pedido?.sinal ?? 0).replace(".", ","));
    setEditObs(pedido?.observacoes ?? "");
    setDialogEditar(true);
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    const entregaISO = editEntrega ? dataHoraParaISO(editEntrega) : null;
    if (editEntrega && !entregaISO) {
      toast.error("Data de entrega inválida — use dd/mm/aa hh:mm");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("pedidos")
      .update({
        data_entrega: entregaISO,
        desconto: parseDecimalSimples(editDesconto),
        sinal: parseDecimalSimples(editSinal),
        observacoes: editObs.trim() || null,
      })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    setDialogEditar(false);
    carregar();
  }

  function textoOrcamento(): string {
    const linhas: string[] = [];
    linhas.push("🌾 *Orçamento — Maná · Pães & Mais*");
    linhas.push("");
    if (pedido?.cliente?.nome) linhas.push(`Cliente: ${pedido.cliente.nome}`);
    if (pedido?.data_entrega)
      linhas.push(`Entrega: ${formatDataEntrega(pedido.data_entrega)}`);
    linhas.push("");
    for (const item of itens) {
      linhas.push(
        `• ${item.quantidade}x ${item.descricao} — ${formatBRL(
          item.preco_unitario
        )} = ${formatBRL(item.quantidade * item.preco_unitario)}`
      );
    }
    linhas.push("");
    if ((pedido?.desconto ?? 0) > 0) {
      linhas.push(`Subtotal: ${formatBRL(subtotal)}`);
      linhas.push(`Desconto: ${formatBRL(pedido!.desconto)}`);
    }
    linhas.push(`*Total: ${formatBRL(total)}*`);
    if ((pedido?.sinal ?? 0) > 0)
      linhas.push(`Sinal para confirmar: ${formatBRL(pedido!.sinal)}`);
    if (pedido?.observacoes) {
      linhas.push("");
      linhas.push(pedido.observacoes);
    }
    linhas.push("");
    linhas.push("Feito em casa, com propósito e amor. 🤍");
    return linhas.join("\n");
  }

  async function enviarWhatsApp() {
    const texto = textoOrcamento();
    const telefone = pedido?.cliente?.telefone;
    if (telefone) {
      window.open(
        `https://wa.me/${telefoneParaWhatsApp(telefone)}?text=${encodeURIComponent(texto)}`,
        "_blank"
      );
    } else {
      await navigator.clipboard.writeText(texto);
      toast.success("Orçamento copiado! Cole no WhatsApp do cliente.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl text-primary">
            {pedido.cliente?.nome ?? "Pedido sem cliente"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDataEntrega(pedido.data_entrega)}
          </p>
        </div>
        <Badge variant="outline" className={STATUS_CORES[pedido.status]}>
          {STATUS_LABELS[pedido.status]}
        </Badge>
      </div>

      {!finalizado && (
        <div className="grid grid-cols-1 gap-2">
          {proximo && (
            <Button size="lg" onClick={avancarStatus} disabled={processando}>
              <ArrowRight className="size-5" />
              Marcar como {STATUS_LABELS[proximo].toLowerCase()}
            </Button>
          )}
          {pedido.status === "orcamento" && (
            <Button
              size="lg"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={enviarWhatsApp}
            >
              <MessageCircle className="size-5" />
              Enviar orçamento no WhatsApp
            </Button>
          )}
        </div>
      )}

      {pedido.status === "entregue" && !pedido.pago && (
        <Button
          size="lg"
          className="w-full bg-green-600 hover:bg-green-700"
          onClick={marcarPago}
          disabled={processando}
        >
          <CheckCircle2 className="size-5" />
          Registrar pagamento de {formatBRL(saldo)}
        </Button>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Itens</CardTitle>
          {!finalizado && (
            <Button size="sm" variant="outline" onClick={abrirDialogItem}>
              <Plus className="size-4" />
              Item
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          {itens.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.quantidade}x {item.descricao}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBRL(item.preco_unitario)} ={" "}
                  {formatBRL(item.quantidade * item.preco_unitario)}
                </p>
              </div>
              {!finalizado && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => removerItem(item)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          <Separator className="my-2" />
          <div className="space-y-1 text-sm">
            {pedido.desconto > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto</span>
                  <span>- {formatBRL(pedido.desconto)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatBRL(total)}</span>
            </div>
            {pedido.sinal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sinal</span>
                <span>{formatBRL(pedido.sinal)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">
                {pedido.pago ? "Pago" : "Saldo a receber"}
              </span>
              <span className={pedido.pago ? "text-green-600" : undefined}>
                {pedido.pago ? "✓" : formatBRL(saldo)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {pedido.observacoes && (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="mb-1 font-medium text-muted-foreground">
              Observações
            </p>
            {pedido.observacoes}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {!finalizado && (
          <>
            <Button variant="outline" className="flex-1" onClick={abrirEditar}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive"
              onClick={() => setConfirmaCancelar(true)}
            >
              <Ban className="size-4" />
              Cancelar
            </Button>
          </>
        )}
        {finalizado && (
          <Button
            variant="outline"
            className="flex-1 text-destructive"
            onClick={() => setConfirmaExcluir(true)}
          >
            <Trash2 className="size-4" />
            Excluir pedido
          </Button>
        )}
      </div>

      <Dialog open={dialogItem} onOpenChange={setDialogItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar item</DialogTitle>
          </DialogHeader>
          <form onSubmit={adicionarItem} className="space-y-4">
            <div className="space-y-2">
              <Label>Produto (opcional)</Label>
              <Select value={itemProdutoId} onValueChange={escolherProdutoItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher do catálogo..." />
                </SelectTrigger>
                <SelectContent>
                  {produtos.length === 0 && (
                    <SelectItem value="__vazio__" disabled>
                      Nenhum produto cadastrado — preencha a descrição
                    </SelectItem>
                  )}
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={itemDescricao}
                onChange={(e) => setItemDescricao(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  inputMode="decimal"
                  value={itemQtd}
                  onChange={(e) => setItemQtd(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Preço un. (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={itemPreco}
                  onChange={(e) => setItemPreco(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Adicionar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogEditar} onOpenChange={setDialogEditar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pedido</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarEdicao} className="space-y-4">
            <div className="space-y-2">
              <Label>Data e hora da entrega</Label>
              <DataHoraInput value={editEntrega} onChange={setEditEntrega} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={editDesconto}
                  onChange={(e) => setEditDesconto(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sinal (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={editSinal}
                  onChange={(e) => setEditSinal(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmaCancelar} onOpenChange={setConfirmaCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido ficará marcado como cancelado. O estoque não é
              devolvido automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={cancelar}>
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmaExcluir} onOpenChange={setConfirmaExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido e seus itens serão removidos definitivamente. Os
              lançamentos financeiros dele são mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirPedido}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
