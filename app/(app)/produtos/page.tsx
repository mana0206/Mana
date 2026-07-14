"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  custoComFixos,
  custoIngredientes,
  precoSugerido,
} from "@/lib/calc";
import { formatBRL, parseDecimalSimples } from "@/lib/format";
import type {
  CustoFixo,
  Produto,
  Receita,
  ReceitaIngrediente,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FotoUpload } from "@/components/foto-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Croissant, Pencil, Trash2 } from "lucide-react";

type ReceitaComItens = Receita & { itens: ReceitaIngrediente[] };

type Formulario = {
  nome: string;
  origem: "receita" | "manual";
  receita_id: string;
  custo_manual: string;
  margem: string;
  preco_venda: string;
  foto_url: string | null;
  ativo: boolean;
};

const formVazio: Formulario = {
  nome: "",
  origem: "receita",
  receita_id: "",
  custo_manual: "",
  margem: "100",
  preco_venda: "",
  foto_url: null,
  ativo: true,
};

export default function ProdutosPage() {
  const [carregando, setCarregando] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [receitas, setReceitas] = useState<ReceitaComItens[]>([]);
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [excluindo, setExcluindo] = useState<Produto | null>(null);
  const [form, setForm] = useState<Formulario>(formVazio);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [prodRes, recRes, cfRes] = await Promise.all([
      supabase.from("produtos").select("*").order("nome"),
      supabase
        .from("receitas")
        .select("*, itens:receita_ingredientes(*, ingrediente:ingredientes(*))"),
      supabase.from("custos_fixos").select("*"),
    ]);
    setProdutos((prodRes.data as Produto[]) ?? []);
    setReceitas((recRes.data as ReceitaComItens[]) ?? []);
    setCustosFixos((cfRes.data as CustoFixo[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const custoPorReceita = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const r of receitas) {
      const total = custoComFixos(custoIngredientes(r.itens), custosFixos);
      mapa.set(r.id, r.rendimento_qtd > 0 ? total / r.rendimento_qtd : total);
    }
    return mapa;
  }, [receitas, custosFixos]);

  function custoDoProduto(p: {
    receita_id: string | null;
    custo_manual: number | null;
  }): number {
    if (p.custo_manual != null) return p.custo_manual;
    if (p.receita_id) return custoPorReceita.get(p.receita_id) ?? 0;
    return 0;
  }

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio);
    setDialogAberto(true);
  }

  function abrirEdicao(p: Produto) {
    setEditando(p);
    setForm({
      nome: p.nome,
      origem: p.custo_manual != null ? "manual" : "receita",
      receita_id: p.receita_id ?? "",
      custo_manual:
        p.custo_manual != null ? String(p.custo_manual).replace(".", ",") : "",
      margem: String(p.margem).replace(".", ","),
      preco_venda:
        p.preco_venda != null ? String(p.preco_venda).replace(".", ",") : "",
      foto_url: p.foto_url,
      ativo: p.ativo,
    });
    setDialogAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const supabase = createClient();
    const dados = {
      nome: form.nome.trim(),
      receita_id: form.origem === "receita" ? form.receita_id || null : null,
      custo_manual:
        form.origem === "manual"
          ? parseDecimalSimples(form.custo_manual)
          : null,
      margem: parseDecimalSimples(form.margem),
      preco_venda: form.preco_venda
        ? parseDecimalSimples(form.preco_venda)
        : null,
      foto_url: form.foto_url,
      ativo: form.ativo,
    };
    const { error } = editando
      ? await supabase.from("produtos").update(dados).eq("id", editando.id)
      : await supabase.from("produtos").insert(dados);
    setSalvando(false);
    if (error) {
      toast.error("Erro ao salvar produto");
      return;
    }
    toast.success(editando ? "Produto atualizado" : "Produto criado");
    setDialogAberto(false);
    carregar();
  }

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", excluindo.id);
    if (error) {
      toast.error("Erro ao excluir — produto usado em pedidos.");
    } else {
      toast.success("Produto excluído");
      carregar();
    }
    setExcluindo(null);
  }

  // Preview do cálculo dentro do formulário
  const custoForm =
    form.origem === "manual"
      ? parseDecimalSimples(form.custo_manual)
      : form.receita_id
        ? (custoPorReceita.get(form.receita_id) ?? 0)
        : 0;
  const sugeridoForm = precoSugerido(custoForm, parseDecimalSimples(form.margem));

  return (
    <div>
      <PageHeader
        titulo="Produtos"
        acao={
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo
          </Button>
        }
      />

      {carregando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <EmptyState
          icone={Croissant}
          titulo="Nenhum produto"
          descricao="Crie os itens que você vende, ligados às receitas, e veja o preço ideal."
        />
      ) : (
        <div className="space-y-2">
          {produtos.map((p) => {
            const custo = custoDoProduto(p);
            const sugerido = precoSugerido(custo, p.margem);
            const praticado = p.preco_venda ?? sugerido;
            const lucro = praticado - custo;
            return (
              <Card key={p.id} className={!p.ativo ? "opacity-60" : undefined}>
                <CardContent className="flex gap-3 p-4">
                  {p.foto_url ? (
                    <Image
                      src={p.foto_url}
                      alt={p.nome}
                      width={64}
                      height={64}
                      className="size-16 shrink-0 rounded-xl object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <Croissant className="size-6 text-primary/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{p.nome}</p>
                      {!p.ativo && (
                        <Badge variant="outline" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Custo {formatBRL(custo)} · Margem{" "}
                      {p.margem.toLocaleString("pt-BR")}% · Estoque{" "}
                      {Number(p.estoque_atual ?? 0).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold text-primary">
                        {formatBRL(praticado)}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        (sugerido {formatBRL(sugerido)} · lucro{" "}
                        {formatBRL(lucro)})
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Editar ${p.nome}`}
                      onClick={() => abrirEdicao(p)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Excluir ${p.nome}`}
                      onClick={() => setExcluindo(p)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar produto" : "Novo produto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pnome">Nome</Label>
              <Input
                id="pnome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Pão italiano (un)"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Origem do custo</Label>
              <Select
                value={form.origem}
                onValueChange={(v) =>
                  setForm({ ...form, origem: v as "receita" | "manual" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">
                    Ficha técnica (receita)
                  </SelectItem>
                  <SelectItem value="manual">Custo manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.origem === "receita" ? (
              <div className="space-y-2">
                <Label>Receita</Label>
                <Select
                  value={form.receita_id}
                  onValueChange={(v) => setForm({ ...form, receita_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a receita..." />
                  </SelectTrigger>
                  <SelectContent>
                    {receitas.length === 0 && (
                      <SelectItem value="__vazio__" disabled>
                        Nenhuma receita — crie na tela Receitas
                      </SelectItem>
                    )}
                    {receitas.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome} (
                        {formatBRL(custoPorReceita.get(r.id) ?? 0)}/
                        {r.rendimento_unidade})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="cmanual">Custo por unidade (R$)</Label>
                <Input
                  id="cmanual"
                  inputMode="decimal"
                  value={form.custo_manual}
                  onChange={(e) =>
                    setForm({ ...form, custo_manual: e.target.value })
                  }
                  placeholder="2,50"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="margem">Margem desejada (%)</Label>
                <Input
                  id="margem"
                  inputMode="decimal"
                  value={form.margem}
                  onChange={(e) => setForm({ ...form, margem: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pvenda">Preço praticado (R$)</Label>
                <Input
                  id="pvenda"
                  inputMode="decimal"
                  value={form.preco_venda}
                  onChange={(e) =>
                    setForm({ ...form, preco_venda: e.target.value })
                  }
                  placeholder={
                    sugeridoForm > 0
                      ? sugeridoForm.toFixed(2).replace(".", ",")
                      : "deixe vazio p/ usar sugerido"
                  }
                />
              </div>
            </div>

            <div className="rounded-lg bg-secondary p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo</span>
                <span>{formatBRL(custoForm)}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary">
                <span>Preço sugerido</span>
                <span>{formatBRL(sugeridoForm)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Foto</Label>
              <FotoUpload
                url={form.foto_url}
                pasta="produtos"
                onChange={(url) => setForm({ ...form, foto_url: url })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Produto ativo</Label>
              <Switch
                id="ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>

            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!excluindo}
        onOpenChange={(aberto) => !aberto && setExcluindo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{excluindo?.nome}&quot; será removido do catálogo.
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
