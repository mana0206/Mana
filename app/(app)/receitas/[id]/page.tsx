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
  Receita,
  ReceitaIngrediente,
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

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

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [recRes, itensRes, ingRes, cfRes] = await Promise.all([
      supabase.from("receitas").select("*").eq("id", id).single(),
      supabase
        .from("receita_ingredientes")
        .select("*, ingrediente:ingredientes(*)")
        .eq("receita_id", id),
      supabase.from("ingredientes").select("*").order("nome"),
      supabase.from("custos_fixos").select("*"),
    ]);
    setReceita(recRes.data as Receita);
    setItens((itensRes.data as ReceitaIngrediente[]) ?? []);
    setIngredientes((ingRes.data as Ingrediente[]) ?? []);
    setCustosFixos((cfRes.data as CustoFixo[]) ?? []);
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
    setDialogItem(false);
    setIngSelecionado("");
    setQtdItem("");
    carregar();
  }

  async function removerItem(itemId: string) {
    const supabase = createClient();
    await supabase.from("receita_ingredientes").delete().eq("id", itemId);
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
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 truncate font-serif text-2xl text-primary">
          {receita.nome}
        </h1>
        <Button
          variant="ghost"
          size="icon"
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
                className="size-8 shrink-0"
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

      <Dialog open={dialogItem} onOpenChange={setDialogItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar ingrediente</DialogTitle>
          </DialogHeader>
          {ingredientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre ingredientes primeiro na tela de Ingredientes.
            </p>
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
                Adicionar
              </Button>
            </form>
          )}
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
