"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { custoComFixos, custoIngredientes } from "@/lib/calc";
import { formatBRL, formatQtd, parseDecimalSimples } from "@/lib/format";
import type { CustoFixo, Receita, ReceitaIngrediente } from "@/lib/types";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, BookOpen, ChevronRight } from "lucide-react";

type ReceitaComItens = Receita & { itens: ReceitaIngrediente[] };

export default function ReceitasPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [receitas, setReceitas] = useState<ReceitaComItens[]>([]);
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [rendQtd, setRendQtd] = useState("");
  const [rendUnidade, setRendUnidade] = useState("un");

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const [recRes, cfRes] = await Promise.all([
        supabase
          .from("receitas")
          .select("*, itens:receita_ingredientes(*, ingrediente:ingredientes(*))")
          .order("nome"),
        supabase.from("custos_fixos").select("*"),
      ]);
      setReceitas((recRes.data as ReceitaComItens[]) ?? []);
      setCustosFixos((cfRes.data as CustoFixo[]) ?? []);
      setCarregando(false);
    }
    carregar();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("receitas")
      .insert({
        nome: nome.trim(),
        rendimento_qtd: parseDecimalSimples(rendQtd) || 1,
        rendimento_unidade: rendUnidade.trim() || "un",
      })
      .select()
      .single();
    setSalvando(false);
    if (error || !data) {
      toast.error("Erro ao criar receita");
      return;
    }
    router.push(`/receitas/${data.id}`);
  }

  return (
    <div>
      <PageHeader
        titulo="Receitas"
        acao={
          <Button size="sm" onClick={() => setDialogAberto(true)}>
            <Plus className="size-4" />
            Nova
          </Button>
        }
      />

      {carregando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : receitas.length === 0 ? (
        <EmptyState
          icone={BookOpen}
          titulo="Nenhuma receita"
          descricao="Monte a ficha técnica: ingredientes + quantidades = custo exato."
        />
      ) : (
        <div className="space-y-2">
          {receitas.map((r) => {
            const base = custoIngredientes(r.itens);
            const total = custoComFixos(base, custosFixos);
            const porUnidade =
              r.rendimento_qtd > 0 ? total / r.rendimento_qtd : total;
            return (
              <Link key={r.id} href={`/receitas/${r.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="font-medium">{r.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Rende {formatQtd(r.rendimento_qtd)}{" "}
                        {r.rendimento_unidade} · {r.itens.length}{" "}
                        {r.itens.length === 1 ? "ingrediente" : "ingredientes"}
                      </p>
                      <p className="text-sm font-medium text-primary">
                        {formatBRL(total)} ({formatBRL(porUnidade)}/
                        {r.rendimento_unidade})
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova receita</DialogTitle>
          </DialogHeader>
          <form onSubmit={criar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Pão de fermentação natural"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rqtd">Rendimento</Label>
                <Input
                  id="rqtd"
                  inputMode="decimal"
                  value={rendQtd}
                  onChange={(e) => setRendQtd(e.target.value)}
                  placeholder="20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="run">Unidade</Label>
                <Input
                  id="run"
                  value={rendUnidade}
                  onChange={(e) => setRendUnidade(e.target.value)}
                  placeholder="un, fatias, kg..."
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? "Criando..." : "Criar e montar ficha técnica"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
