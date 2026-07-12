"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  custoComFixos,
  custoIngredientes,
  precoSugerido,
} from "@/lib/calc";
import { formatBRL, parseDecimalSimples } from "@/lib/format";
import type {
  Cliente,
  CustoFixo,
  Produto,
  Receita,
  ReceitaIngrediente,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type ReceitaComItens = Receita & { itens: ReceitaIngrediente[] };

type ItemForm = {
  produto_id: string;
  descricao: string;
  quantidade: string;
  preco_unitario: string;
};

export default function NovoPedidoPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [receitas, setReceitas] = useState<ReceitaComItens[]>([]);
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [desconto, setDesconto] = useState("");
  const [sinal, setSinal] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const [cliRes, prodRes, recRes, cfRes] = await Promise.all([
        supabase.from("clientes").select("*").order("nome"),
        supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
        supabase
          .from("receitas")
          .select(
            "*, itens:receita_ingredientes(*, ingrediente:ingredientes(*))"
          ),
        supabase.from("custos_fixos").select("*"),
      ]);
      setClientes((cliRes.data as Cliente[]) ?? []);
      setProdutos((prodRes.data as Produto[]) ?? []);
      setReceitas((recRes.data as ReceitaComItens[]) ?? []);
      setCustosFixos((cfRes.data as CustoFixo[]) ?? []);
    }
    carregar();
  }, []);

  const custoPorReceita = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of receitas) {
      const total = custoComFixos(custoIngredientes(r.itens), custosFixos);
      mapa.set(r.id, r.rendimento_qtd > 0 ? total / r.rendimento_qtd : total);
    }
    return mapa;
  }, [receitas, custosFixos]);

  function precoDoProduto(p: Produto): number {
    if (p.preco_venda != null) return p.preco_venda;
    const custo =
      p.custo_manual != null
        ? p.custo_manual
        : p.receita_id
          ? (custoPorReceita.get(p.receita_id) ?? 0)
          : 0;
    return precoSugerido(custo, p.margem);
  }

  function adicionarItem() {
    setItens([
      ...itens,
      { produto_id: "", descricao: "", quantidade: "1", preco_unitario: "" },
    ]);
  }

  function atualizarItem(idx: number, mudancas: Partial<ItemForm>) {
    setItens(itens.map((it, i) => (i === idx ? { ...it, ...mudancas } : it)));
  }

  function escolherProduto(idx: number, produtoId: string) {
    const p = produtos.find((x) => x.id === produtoId);
    if (!p) return;
    atualizarItem(idx, {
      produto_id: produtoId,
      descricao: p.nome,
      preco_unitario: precoDoProduto(p).toFixed(2).replace(".", ","),
    });
  }

  const subtotal = itens.reduce(
    (s, it) =>
      s + parseDecimalSimples(it.quantidade) * parseDecimalSimples(it.preco_unitario),
    0
  );
  const total = Math.max(0, subtotal - parseDecimalSimples(desconto));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const itensValidos = itens.filter(
      (it) => it.descricao.trim() && parseDecimalSimples(it.quantidade) > 0
    );
    if (itensValidos.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_id: clienteId || null,
        data_entrega: dataEntrega ? new Date(dataEntrega).toISOString() : null,
        desconto: parseDecimalSimples(desconto),
        sinal: parseDecimalSimples(sinal),
        observacoes: observacoes.trim() || null,
        status: "orcamento",
      })
      .select()
      .single();
    if (error || !pedido) {
      setSalvando(false);
      toast.error("Erro ao criar pedido");
      return;
    }
    const { error: erroItens } = await supabase.from("pedido_itens").insert(
      itensValidos.map((it) => ({
        pedido_id: pedido.id,
        produto_id: it.produto_id || null,
        descricao: it.descricao.trim(),
        quantidade: parseDecimalSimples(it.quantidade),
        preco_unitario: parseDecimalSimples(it.preco_unitario),
      }))
    );
    setSalvando(false);
    if (erroItens) {
      toast.error("Pedido criado, mas houve erro ao salvar itens");
    }
    router.push(`/pedidos/${pedido.id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="font-serif text-2xl text-primary">Novo pedido</h1>
      </div>

      <form onSubmit={salvar} className="space-y-5">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entrega">Data e hora da entrega</Label>
              <Input
                id="entrega"
                type="datetime-local"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Label>Itens</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={adicionarItem}
              >
                <Plus className="size-4" />
                Item
              </Button>
            </div>
            {itens.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Nenhum item ainda.
              </p>
            )}
            {itens.map((item, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={item.produto_id}
                      onValueChange={(v) => escolherProduto(idx, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Produto do catálogo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} ({formatBRL(precoDoProduto(p))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setItens(itens.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  placeholder="Descrição (ex: Bolo de chocolate 2kg)"
                  value={item.descricao}
                  onChange={(e) =>
                    atualizarItem(idx, { descricao: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Qtd
                    </Label>
                    <Input
                      inputMode="decimal"
                      value={item.quantidade}
                      onChange={(e) =>
                        atualizarItem(idx, { quantidade: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Preço un. (R$)
                    </Label>
                    <Input
                      inputMode="decimal"
                      value={item.preco_unitario}
                      onChange={(e) =>
                        atualizarItem(idx, { preco_unitario: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="desconto">Desconto (R$)</Label>
                <Input
                  id="desconto"
                  inputMode="decimal"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sinal">Sinal (R$)</Label>
                <Input
                  id="sinal"
                  inputMode="decimal"
                  value={sinal}
                  onChange={(e) => setSinal(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Tema da festa, cor, recado no bolo..."
              />
            </div>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-primary">{formatBRL(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={salvando}>
          {salvando ? "Salvando..." : "Criar pedido"}
        </Button>
      </form>
    </div>
  );
}
