"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatQtd, parseDecimalSimples } from "@/lib/format";
import type { CustoFixo } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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
import { toast } from "sonner";
import { Plus, Settings, Pencil, Trash2 } from "lucide-react";

export default function ConfigPage() {
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<CustoFixo | null>(null);

  const [nome, setNome] = useState("");
  const [tipoCusto, setTipoCusto] = useState<"fixo" | "percentual">("fixo");
  const [valor, setValor] = useState("");

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("custos_fixos")
      .select("*")
      .order("nome");
    setCustos((data as CustoFixo[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setTipoCusto("fixo");
    setValor("");
    setDialogAberto(true);
  }

  function abrirEdicao(c: CustoFixo) {
    setEditando(c);
    setNome(c.nome);
    setTipoCusto(c.tipo);
    setValor(String(c.valor).replace(".", ","));
    setDialogAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const dados = {
      nome: nome.trim(),
      tipo: tipoCusto,
      valor: parseDecimalSimples(valor),
    };
    const { error } = editando
      ? await supabase.from("custos_fixos").update(dados).eq("id", editando.id)
      : await supabase.from("custos_fixos").insert(dados);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    setDialogAberto(false);
    carregar();
  }

  async function alternarAtivo(c: CustoFixo, ativo: boolean) {
    const supabase = createClient();
    await supabase.from("custos_fixos").update({ ativo }).eq("id", c.id);
    carregar();
  }

  async function excluir(c: CustoFixo) {
    const supabase = createClient();
    await supabase.from("custos_fixos").delete().eq("id", c.id);
    carregar();
  }

  return (
    <div>
      <PageHeader
        titulo="Custos fixos"
        acao={
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="size-4" />
            Novo
          </Button>
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">
        Estes custos entram no cálculo de toda receita: valores fixos são
        somados em R$; percentuais incidem sobre o custo dos ingredientes.
      </p>

      {!carregando && custos.length === 0 ? (
        <EmptyState
          icone={Settings}
          titulo="Nenhum custo fixo"
          descricao="Ex: gás, energia, embalagem, mão de obra."
        />
      ) : (
        <div className="space-y-2">
          {custos.map((c) => (
            <Card key={c.id} className={!c.ativo ? "opacity-60" : undefined}>
              <CardContent className="flex items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.tipo === "fixo"
                      ? `${formatBRL(c.valor)} por receita`
                      : `${formatQtd(c.valor)}% sobre ingredientes`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch
                    checked={c.ativo}
                    onCheckedChange={(v) => alternarAtivo(c, v)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => abrirEdicao(c)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => excluir(c)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar custo" : "Novo custo fixo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Gás e energia"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={tipoCusto}
                onValueChange={(v) => setTipoCusto(v as "fixo" | "percentual")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Valor fixo (R$ por receita)</SelectItem>
                  <SelectItem value="percentual">
                    Percentual (% sobre ingredientes)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tipoCusto === "fixo" ? "Valor (R$)" : "Percentual (%)"}</Label>
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
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
