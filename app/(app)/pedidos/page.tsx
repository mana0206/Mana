"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { totalPedido } from "@/lib/calc";
import { formatBRL, formatDataEntrega } from "@/lib/format";
import {
  STATUS_CORES,
  STATUS_LABELS,
  type Pedido,
} from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ClipboardList } from "lucide-react";

const ATIVOS = ["orcamento", "confirmado", "em_producao", "pronto"];

export default function PedidosPage() {
  const [carregando, setCarregando] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aba, setAba] = useState("ativos");

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("pedidos")
        .select("*, cliente:clientes(*), itens:pedido_itens(*)")
        .order("data_entrega", { ascending: true, nullsFirst: false });
      setPedidos((data as Pedido[]) ?? []);
      setCarregando(false);
    }
    carregar();
  }, []);

  const filtrados = pedidos.filter((p) =>
    aba === "ativos"
      ? ATIVOS.includes(p.status)
      : !ATIVOS.includes(p.status)
  );

  return (
    <div>
      <PageHeader
        titulo="Pedidos"
        acao={
          <Button size="sm" asChild>
            <Link href="/pedidos/novo">
              <Plus className="size-4" />
              Novo
            </Link>
          </Button>
        }
      />

      <Tabs value={aba} onValueChange={setAba} className="mb-4">
        <TabsList className="w-full">
          <TabsTrigger value="ativos" className="flex-1">
            Ativos
          </TabsTrigger>
          <TabsTrigger value="concluidos" className="flex-1">
            Concluídos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {carregando ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icone={ClipboardList}
          titulo={
            aba === "ativos"
              ? "Nenhum pedido ativo"
              : "Nenhum pedido concluído"
          }
          descricao="Toque em Novo para registrar uma encomenda ou orçamento."
        />
      ) : (
        <div className="space-y-2">
          {filtrados.map((p) => (
            <Link key={p.id} href={`/pedidos/${p.id}`} className="block">
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">
                      {p.cliente?.nome ?? "Sem cliente"}
                    </p>
                    <Badge variant="outline" className={STATUS_CORES[p.status]}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatDataEntrega(p.data_entrega)}</span>
                    <span className="font-semibold text-foreground">
                      {formatBRL(totalPedido(p, p.itens ?? []))}
                    </span>
                  </div>
                  {(p.itens?.length ?? 0) > 0 && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {p.itens!
                        .map((i) => `${i.quantidade}x ${i.descricao}`)
                        .join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
