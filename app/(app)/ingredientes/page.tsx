"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { custoUnitario } from "@/lib/calc";
import { formatBRL, formatQtd, parseDecimalSimples } from "@/lib/format";
import type { Ingrediente, UnidadeUso } from "@/lib/types";
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
  DialogTrigger,
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
import { toast } from "sonner";
import { Plus, Wheat, Pencil, Trash2, AlertTriangle } from "lucide-react";

const UNIDADES: { valor: UnidadeUso; rotulo: string }[] = [
  { valor: "g", rotulo: "gramas (g)" },
  { valor: "ml", rotulo: "mililitros (ml)" },
  { valor: "un", rotulo: "unidades (un)" },
];

type Formulario = {
  nome: string;
  preco_compra: string;
  quantidade_embalagem: string;
  unidade_uso: UnidadeUso;
  estoque_atual: string;
  estoque_minimo: string;
};

const formVazio: Formulario = {
  nome: "",
  preco_compra: "",
  quantidade_embalagem: "",
  unidade_uso: "g",
  estoque_atual: "0",
  estoque_minimo: "0",
};

export default function IngredientesPage() {
  const [carregando, setCarregando] = useState(true);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Ingrediente | null>(null);
  const [excluindo, setExcluindo] = useState<Ingrediente | null>(null);
  const [form, setForm] = useState<Formulario>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  async function carregar() {
    const supabase = createClient();
    const { data } = await supabase
      .from("ingredientes")
      .select("*")
      .order("nome");
    setIngredientes((data as Ingrediente[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio);
    setDialogAberto(true);
  }

  function abrirEdicao(ing: Ingrediente) {
    setEditando(ing);
    setForm({
      nome: ing.nome,
      preco_compra: String(ing.preco_compra).replace(".", ","),
      quantidade_embalagem: String(ing.quantidade_embalagem).replace(".", ","),
      unidade_uso: ing.unidade_uso,
      estoque_atual: String(ing.estoque_atual).replace(".", ","),
      estoque_minimo: String(ing.estoque_minimo).replace(".", ","),
    });
    setDialogAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const supabase = createClient();
    const dados = {
      nome: form.nome.trim(),
      preco_compra: parseDecimalSimples(form.preco_compra),
      quantidade_embalagem: parseDecimalSimples(form.quantidade_embalagem) || 1,
      unidade_uso: form.unidade_uso,
      estoque_atual: parseDecimalSimples(form.estoque_atual),
      estoque_minimo: parseDecimalSimples(form.estoque_minimo),
    };
    const { error } = editando
      ? await supabase.from("ingredientes").update(dados).eq("id", editando.id)
      : await supabase.from("ingredientes").insert(dados);
    setSalvando(false);
    if (error) {
      toast.error("Erro ao salvar ingrediente");
      return;
    }
    toast.success(editando ? "Ingrediente atualizado" : "Ingrediente criado");
    setDialogAberto(false);
    carregar();
  }

  async function excluir() {
    if (!excluindo) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("ingredientes")
      .delete()
      .eq("id", excluindo.id);
    if (error) {
      toast.error(
        "Não foi possível excluir — este ingrediente é usado em alguma receita."
      );
    } else {
      toast.success("Ingrediente excluído");
      carregar();
    }
    setExcluindo(null);
  }

  const filtrados = ingredientes.filter((i) =>
    i.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        titulo="Ingredientes"
        acao={
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo
          </Button>
        }
      />

      <Input
        placeholder="Buscar ingrediente..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-4"
      />

      {carregando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icone={Wheat}
          titulo="Nenhum ingrediente"
          descricao="Cadastre farinha, açúcar, leite condensado... com o preço que você paga."
        />
      ) : (
        <div className="space-y-2">
          {filtrados.map((ing) => {
            const baixo =
              ing.estoque_minimo > 0 && ing.estoque_atual < ing.estoque_minimo;
            return (
              <Card key={ing.id}>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      {ing.nome}
                      {baixo && (
                        <AlertTriangle className="size-4 text-amber-500" />
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatBRL(ing.preco_compra)} /{" "}
                      {formatQtd(ing.quantidade_embalagem)} {ing.unidade_uso}
                      {" · "}
                      <span className="text-primary">
                        {formatBRL(custoUnitario(ing))}/{ing.unidade_uso}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Estoque: {formatQtd(ing.estoque_atual)} {ing.unidade_uso}
                      {ing.estoque_minimo > 0 &&
                        ` (mín. ${formatQtd(ing.estoque_minimo)})`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirEdicao(ing)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExcluindo(ing)}
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
              {editando ? "Editar ingrediente" : "Novo ingrediente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Farinha de trigo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade de uso nas receitas</Label>
              <Select
                value={form.unidade_uso}
                onValueChange={(v) =>
                  setForm({ ...form, unidade_uso: v as UnidadeUso })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.valor} value={u.valor}>
                      {u.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="preco">Preço pago (R$)</Label>
                <Input
                  id="preco"
                  inputMode="decimal"
                  value={form.preco_compra}
                  onChange={(e) =>
                    setForm({ ...form, preco_compra: e.target.value })
                  }
                  placeholder="6,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtd">
                  Conteúdo ({form.unidade_uso})
                </Label>
                <Input
                  id="qtd"
                  inputMode="decimal"
                  value={form.quantidade_embalagem}
                  onChange={(e) =>
                    setForm({ ...form, quantidade_embalagem: e.target.value })
                  }
                  placeholder="1000"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Ex: pacote de farinha de 1 kg por R$ 6,00 → preço 6,00 e conteúdo
              1000 g.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="estoque">
                  Estoque atual ({form.unidade_uso})
                </Label>
                <Input
                  id="estoque"
                  inputMode="decimal"
                  value={form.estoque_atual}
                  onChange={(e) =>
                    setForm({ ...form, estoque_atual: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimo">
                  Estoque mínimo ({form.unidade_uso})
                </Label>
                <Input
                  id="minimo"
                  inputMode="decimal"
                  value={form.estoque_minimo}
                  onChange={(e) =>
                    setForm({ ...form, estoque_minimo: e.target.value })
                  }
                />
              </div>
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
            <AlertDialogTitle>Excluir ingrediente?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{excluindo?.nome}&quot; será removido. Essa ação não pode
              ser desfeita.
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
