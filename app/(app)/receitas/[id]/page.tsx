"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  custoComFixos,
  custoIngredientes,
  custoUnitario,
} from "@/lib/calc";
import { formatBRL, formatQtd, parseDecimalSimples } from "@/lib/format";
import type {
  CustoFixo,
  Ingrediente,
  Produto,
  Receita,
  ReceitaIngrediente,
  UnidadeUso,
} from "@/lib/types";
import { FotoUpload } from "@/components/foto-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { ArrowLeft, CookingPot, Plus, Trash2 } from "lucide-react";

export default function ReceitaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [receita, setReceita] = useState<Receita | null>(null);
  const [itens, setItens] = useState<ReceitaIngrediente[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [dialogItem, setDialogItem] = useState(false);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [ingSelecionado, setIngSelecionado] = useState("");
  const [qtdItem, setQtdItem] = useState("");
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novoConteudo, setNovoConteudo] = useState("");
  const [novaUnidade, setNovaUnidade] = useState<UnidadeUso>("g");
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [dialogProducao, setDialogProducao] = useState(false);
  const [multiplicador, setMultiplicador] = useState("1");
  const [produtoDestino, setProdutoDestino] = useState("nenhum");
  const [produzindo, setProduzindo] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [recRes, itensRes, ingRes, cfRes, prodRes] = await Promise.all([
      supabase.from("receitas").select("*").eq("id", id).single(),
      supabase
        .from("receita_ingredientes")
        .select("*, ingrediente:ingredientes(*)")
        .eq("receita_id", id),
      supabase.from("ingredientes").select("*").order("nome"),
      supabase.from("custos_fixos").select("*"),
      supabase.from("produtos").select("*").eq("receita_id", id),
    ]);
    setReceita(recRes.data as Receita);
    setItens((itensRes.data as ReceitaIngrediente[]) ?? []);
    setIngredientes((ingRes.data as Ingrediente[]) ?? []);
    setCustosFixos((cfRes.data as CustoFixo[]) ?? []);
    const prods = (prodRes.data as Produto[]) ?? [];
    setProdutos(prods);
    if (prods.length === 1) setProdutoDestino(prods[0].id);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarCampo(campo: Partial<Receita>) {
    const supabase = createClient();
    const { error } = await supabase
      .from("receitas")
      .update(campo)
      .eq("id", id);
    if (error) toast.error("Erro ao salvar");
  }

  async function adicionarItem(e: React.FormEvent) {
    e.preventDefault();
    if (!ingSelecionado) return;
    const supabase = createClient();
    const { error } = await supabase.from("receita_ingredientes").insert({
      receita_id: id,
      ingrediente_id: ingSelecionado,
      quantidade: parseDecimalSimples(qtdItem),
    });
    if (error) {
      toast.error("Erro ao adicionar ingrediente");
      return;
    }
    const nome = ingredientes.find((i) => i.id === ingSelecionado)?.nome;
    toast.success(`${nome ?? "Ingrediente"} adicionado — pode incluir o próximo`);
    setIngSelecionado("");
    setQtdItem("");
    carregar();
  }

  async function criarNovoIngrediente() {
    if (!novoNome.trim()) {
      toast.error("Dê um nome ao ingrediente");
      return;
    }
    if (parseDecimalSimples(novoPreco) <= 0) {
      toast.error("Informe o preço pago pelo ingrediente");
      return;
    }
    if (parseDecimalSimples(novoConteudo) <= 0) {
      toast.error(
        `Informe o conteúdo da embalagem em ${novaUnidade} — ex.: caixa de leite de 1 L = 1000 ml`
      );
      return;
    }
    setSalvandoNovo(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ingredientes")
      .insert({
        nome: novoNome.trim(),
        preco_compra: parseDecimalSimples(novoPreco),
        quantidade_embalagem: parseDecimalSimples(novoConteudo) || 1,
        unidade_uso: novaUnidade,
        estoque_atual: 0,
        estoque_minimo: 0,
      })
      .select()
      .single();
    setSalvandoNovo(false);
    if (error || !data) {
      toast.error("Erro ao criar ingrediente");
      return;
    }
    const novo = data as Ingrediente;
    setIngredientes((prev) =>
      [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setIngSelecionado(novo.id);
    setCriandoNovo(false);
    setNovoNome("");
    setNovoPreco("");
    setNovoConteudo("");
    toast.success(`${novo.nome} cadastrado — agora informe a quantidade usada`);
  }

  async function removerItem(itemId: string) {
    const supabase = createClient();
    await supabase.from("receita_ingredientes").delete().eq("id", itemId);
    carregar();
  }

  async function produzir(e: React.FormEvent) {
    e.preventDefault();
    if (!receita) return;
    const mult = parseDecimalSimples(multiplicador) || 1;
    setProduzindo(true);
    const supabase = createClient();

    // baixa cada ingrediente da ficha técnica (quantidade × multiplicador)
    await Promise.all(
      itens
        .filter((item) => item.ingrediente)
        .map((item) =>
          supabase
            .from("ingredientes")
            .update({
              estoque_atual: Math.max(
                0,
                Number(item.ingrediente!.estoque_atual) - item.quantidade * mult
              ),
            })
            .eq("id", item.ingrediente_id)
        )
    );

    // credita o produto acabado
    const produzido = receita.rendimento_qtd * mult;
    if (produtoDestino !== "nenhum") {
      const prod = produtos.find((p) => p.id === produtoDestino);
      if (prod) {
        await supabase
          .from("produtos")
          .update({ estoque_atual: Number(prod.estoque_atual) + produzido })
          .eq("id", prod.id);
      }
    }

    await supabase.from("producoes").insert({
      receita_id: id,
      produto_id: produtoDestino !== "nenhum" ? produtoDestino : null,
      multiplicador: mult,
      quantidade_produzida: produzido,
    });

    setProduzindo(false);
    setDialogProducao(false);
    toast.success(
      `Produção registrada: ${formatQtd(produzido)} ${receita.rendimento_unidade} — ingredientes baixados do estoque`
    );
    carregar();
  }

  async function excluirReceita() {
    const supabase = createClient();
    const { error } = await supabase.from("receitas").delete().eq("id", id);
    if (error) {
      toast.error(
        "Não foi possível excluir — existe produto usando esta receita."
      );
      setConfirmaExcluir(false);
      return;
    }
    toast.success("Receita excluída");
    router.push("/receitas");
  }

  if (carregando || !receita) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const base = custoIngredientes(itens);
  const total = custoComFixos(base, custosFixos);
  const porUnidade =
    receita.rendimento_qtd > 0 ? total / receita.rendimento_qtd : total;
  const fixosAtivos = custosFixos.filter((c) => c.ativo);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Voltar"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 truncate font-serif text-2xl text-primary">
          {receita.nome}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Excluir receita"
          onClick={() => setConfirmaExcluir(true)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <Card className="border-primary/30 bg-secondary/50">
        <CardContent className="space-y-1 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ingredientes</span>
            <span>{formatBRL(base)}</span>
          </div>
          {fixosAtivos.map((c) => (
            <div key={c.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {c.nome} {c.tipo === "percentual" && `(${formatQtd(c.valor)}%)`}
              </span>
              <span>
                {formatBRL(
                  c.tipo === "fixo" ? c.valor : base * (c.valor / 100)
                )}
              </span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>Custo total</span>
            <span className="text-primary">{formatBRL(total)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span className="text-muted-foreground">
              Por {receita.rendimento_unidade}
            </span>
            <span>{formatBRL(porUnidade)}</span>
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={() => setDialogProducao(true)}
        disabled={itens.length === 0}
      >
        <CookingPot className="size-5" />
        Produzir esta receita
      </Button>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Ingredientes</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogItem(true)}>
            <Plus className="size-4" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {itens.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Adicione os ingredientes e as quantidades usadas.
            </p>
          )}
          {itens.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.ingrediente?.nome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatQtd(item.quantidade)} {item.ingrediente?.unidade_uso}{" "}
                  ·{" "}
                  {formatBRL(
                    item.ingrediente
                      ? item.quantidade * custoUnitario(item.ingrediente)
                      : 0
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Remover ${item.ingrediente?.nome}`}
                onClick={() => removerItem(item.id)}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              defaultValue={receita.nome}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== receita.nome) {
                  setReceita({ ...receita, nome: v });
                  salvarCampo({ nome: v });
                }
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rendimento</Label>
              <Input
                inputMode="decimal"
                defaultValue={formatQtd(receita.rendimento_qtd)}
                onBlur={(e) => {
                  const v = parseDecimalSimples(e.target.value) || 1;
                  setReceita({ ...receita, rendimento_qtd: v });
                  salvarCampo({ rendimento_qtd: v });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input
                defaultValue={receita.rendimento_unidade}
                onBlur={(e) => {
                  const v = e.target.value.trim() || "un";
                  setReceita({ ...receita, rendimento_unidade: v });
                  salvarCampo({ rendimento_unidade: v });
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações / modo de preparo</Label>
            <Textarea
              defaultValue={receita.observacoes ?? ""}
              rows={3}
              onBlur={(e) => salvarCampo({ observacoes: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Foto</Label>
            <FotoUpload
              url={receita.foto_url}
              pasta="receitas"
              onChange={(url) => {
                setReceita({ ...receita, foto_url: url });
                salvarCampo({ foto_url: url });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogItem}
        onOpenChange={(aberto) => {
          setDialogItem(aberto);
          if (!aberto) {
            setCriandoNovo(false);
            setIngSelecionado("");
            setQtdItem("");
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar ingredientes</DialogTitle>
          </DialogHeader>

          {itens.length > 0 && (
            <div className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Já na receita:{" "}
              {itens.map((item) => item.ingrediente?.nome).join(", ")}
            </div>
          )}

          {criandoNovo || ingredientes.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cadastre o ingrediente rapidinho — ele já fica salvo para as
                próximas receitas.
              </p>
              <div className="space-y-2">
                <Label htmlFor="novo-nome">Nome</Label>
                <Input
                  id="novo-nome"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: Leite integral"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade de uso nas receitas</Label>
                <Select
                  value={novaUnidade}
                  onValueChange={(v) => setNovaUnidade(v as UnidadeUso)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">gramas (g)</SelectItem>
                    <SelectItem value="ml">mililitros (ml)</SelectItem>
                    <SelectItem value="un">unidades (un)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="novo-preco">Preço pago (R$)</Label>
                  <Input
                    id="novo-preco"
                    inputMode="decimal"
                    value={novoPreco}
                    onChange={(e) => setNovoPreco(e.target.value)}
                    placeholder="6,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-conteudo">
                    Conteúdo ({novaUnidade})
                  </Label>
                  <Input
                    id="novo-conteudo"
                    inputMode="decimal"
                    value={novoConteudo}
                    onChange={(e) => setNovoConteudo(e.target.value)}
                    placeholder="1000"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ex: caixa de leite de 1 L por R$ 6,00 → preço 6,00 e conteúdo
                1000 ml.
              </p>
              <div className="flex gap-2">
                {ingredientes.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCriandoNovo(false)}
                  >
                    Voltar
                  </Button>
                )}
                <Button
                  type="button"
                  className="flex-1"
                  disabled={salvandoNovo}
                  onClick={criarNovoIngrediente}
                >
                  {salvandoNovo ? "Salvando..." : "Cadastrar"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={adicionarItem} className="space-y-4">
              <div className="space-y-2">
                <Label>Ingrediente</Label>
                <Select value={ingSelecionado} onValueChange={setIngSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredientes.map((ing) => (
                      <SelectItem key={ing.id} value={ing.id}>
                        {ing.nome} ({formatBRL(custoUnitario(ing))}/
                        {ing.unidade_uso})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="text-sm text-primary underline underline-offset-2"
                  onClick={() => setCriandoNovo(true)}
                >
                  Não achou? Cadastrar ingrediente novo
                </button>
              </div>
              <div className="space-y-2">
                <Label>
                  Quantidade usada (
                  {ingredientes.find((i) => i.id === ingSelecionado)
                    ?.unidade_uso ?? "un"}
                  )
                </Label>
                <Input
                  inputMode="decimal"
                  value={qtdItem}
                  onChange={(e) => setQtdItem(e.target.value)}
                  placeholder="500"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={!ingSelecionado}
              >
                Adicionar à receita
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setDialogItem(false)}
              >
                Concluir
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogProducao} onOpenChange={setDialogProducao}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Produzir — {receita.nome}</DialogTitle>
          </DialogHeader>
          <form onSubmit={produzir} className="space-y-4">
            <div className="space-y-2">
              <Label>Quantas vezes a receita?</Label>
              <Input
                inputMode="decimal"
                value={multiplicador}
                onChange={(e) => setMultiplicador(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Produz{" "}
                <strong>
                  {formatQtd(
                    receita.rendimento_qtd *
                      (parseDecimalSimples(multiplicador) || 0)
                  )}{" "}
                  {receita.rendimento_unidade}
                </strong>
              </p>
            </div>

            <div className="space-y-1 rounded-lg bg-secondary p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Baixa de ingredientes
              </p>
              {itens.map((item) => {
                const necessario =
                  item.quantidade * (parseDecimalSimples(multiplicador) || 0);
                const disponivel = Number(item.ingrediente?.estoque_atual ?? 0);
                const falta = necessario > disponivel;
                return (
                  <div
                    key={item.id}
                    className="flex justify-between text-sm"
                  >
                    <span className={falta ? "text-destructive" : undefined}>
                      {item.ingrediente?.nome}
                    </span>
                    <span
                      className={
                        falta
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {formatQtd(necessario)} / {formatQtd(disponivel)}{" "}
                      {item.ingrediente?.unidade_uso}
                    </span>
                  </div>
                );
              })}
              {itens.some(
                (item) =>
                  item.quantidade * (parseDecimalSimples(multiplicador) || 0) >
                  Number(item.ingrediente?.estoque_atual ?? 0)
              ) && (
                <p className="pt-1 text-xs text-destructive">
                  ⚠ Estoque insuficiente em algum item — a baixa vai até zero.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Lançar produto acabado em</Label>
              <Select value={produtoDestino} onValueChange={setProdutoDestino}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} (estoque: {formatQtd(p.estoque_atual)})
                    </SelectItem>
                  ))}
                  <SelectItem value="nenhum">
                    Não lançar (só baixar ingredientes)
                  </SelectItem>
                </SelectContent>
              </Select>
              {produtos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum produto usa esta receita ainda — crie um em Produtos
                  para controlar o estoque do item acabado.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={produzindo}>
              {produzindo ? "Registrando..." : "Confirmar produção"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmaExcluir} onOpenChange={setConfirmaExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{receita.nome}&quot; e sua ficha técnica serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirReceita}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
