"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format, addDays } from "date-fns";
import type { PedidoItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, RotateCw, WifiOff } from "lucide-react";

type ItemComIngredientes = PedidoItem & {
  ingredientes: string[];
};

export default function EtiquetasPedidoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [itens, setItens] = useState<ItemComIngredientes[]>([]);
  const [validadeDias, setValidadeDias] = useState(3);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const supabase = createClient();
    const { data: pedidoItens, error } = await supabase
      .from("pedido_itens")
      .select(
        "*, produto:produtos(nome, receita:receitas(itens:receita_ingredientes(ingrediente:ingredientes(nome))))"
      )
      .eq("pedido_id", id);
    if (error) {
      setErro(true);
      setCarregando(false);
      return;
    }
    type Linha = PedidoItem & {
      produto: {
        nome: string;
        receita: {
          itens: { ingrediente: { nome: string } | null }[];
        } | null;
      } | null;
    };
    const resolvidos = ((pedidoItens ?? []) as unknown as Linha[]).map(
      (item) => ({
        ...item,
        ingredientes:
          item.produto?.receita?.itens
            .map((ri) => ri.ingrediente?.nome)
            .filter((n): n is string => !!n) ?? [],
      })
    );
    setItens(resolvidos);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const hoje = new Date();
  const validade = addDays(hoje, validadeDias);

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 text-center">
        <WifiOff className="size-8 text-muted-foreground/60" />
        <p className="font-medium text-muted-foreground">Sem conexão</p>
        <Button variant="outline" size="sm" onClick={carregar}>
          <RotateCw className="size-4" />
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 print:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Voltar"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 font-serif text-2xl text-primary">Etiquetas</h1>
      </div>

      <div className="flex items-center gap-3 print:hidden">
        <label className="text-sm text-muted-foreground" htmlFor="validade">
          Validade (dias após a fabricação)
        </label>
        <input
          id="validade"
          type="number"
          min={1}
          value={validadeDias}
          onChange={(e) => setValidadeDias(Number(e.target.value) || 1)}
          className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
        />
      </div>

      <Button
        size="lg"
        className="w-full print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="size-5" />
        Imprimir {itens.length} {itens.length === 1 ? "etiqueta" : "etiquetas"}
      </Button>

      <div className="grid grid-cols-1 gap-6 print:grid-cols-2 print:gap-4">
        {itens.map((item) => (
          <div
            key={item.id}
            className="mx-auto flex w-full max-w-[380px] flex-col items-center rounded-2xl border-2 border-dashed p-7 print:break-inside-avoid"
            style={{
              backgroundColor: "#efe9da",
              borderColor: "#b9b196",
              color: "#2a2a20",
            }}
          >
            <div
              className="font-serif text-4xl tracking-wide"
              style={{ color: "#3a4720" }}
            >
              MANÁ
            </div>
            <div
              className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: "#8a9468" }}
            >
              Pães &amp; Mais
            </div>
            <div
              className="mt-4 h-px w-full"
              style={{ backgroundColor: "#cfc8b2" }}
            />

            <div className="mt-4 w-full">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: "#586b32" }}
              >
                Produto
              </div>
              <div
                className="mt-1.5 pb-1 text-sm font-medium"
                style={{ borderBottom: "1.5px dotted #b3a268" }}
              >
                {item.descricao}
              </div>
            </div>

            <div className="mt-4 flex w-full gap-5">
              <div className="flex-1">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#586b32" }}
                >
                  Fabricação
                </div>
                <div
                  className="mt-1.5 pb-1 text-center text-sm"
                  style={{ borderBottom: "1.5px dotted #b3a268" }}
                >
                  {format(hoje, "dd/MM/yy")}
                </div>
              </div>
              <div className="flex-1">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#586b32" }}
                >
                  Validade
                </div>
                <div
                  className="mt-1.5 pb-1 text-center text-sm"
                  style={{ borderBottom: "1.5px dotted #b3a268" }}
                >
                  {format(validade, "dd/MM/yy")}
                </div>
              </div>
            </div>

            {item.ingredientes.length > 0 && (
              <div className="mt-4 w-full">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#586b32" }}
                >
                  Ingredientes
                </div>
                <p className="mt-1.5 text-xs leading-relaxed">
                  {item.ingredientes.join(", ")}
                </p>
              </div>
            )}

            <div
              className="mt-5 flex w-full items-center justify-between pt-3 text-[10px] uppercase tracking-[0.12em]"
              style={{ borderTop: "1px solid #cfc8b2", color: "#7a8060" }}
            >
              <span>Conserve em local fresco e seco</span>
              <span
                className="font-script text-sm normal-case tracking-normal"
                style={{ color: "#b3a268" }}
              >
                @mana.paes
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
