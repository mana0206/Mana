"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ClipboardList, RotateCw, WifiOff } from "lucide-react";

const ATIVOS = ["orcamento", "confirmado", "em_producao", "pronto"];

export default function PedidosPage() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aba, setAba] = useState("ativos");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pedidos")
      .select("*, cliente:clientes(*), itens:pedido_itens(*)")
      .order("data_entrega", { ascending: true, nullsFirst: false });
    if (error) {
      setErro(true);
      setCarregando(false);
      return;
    }
    setPedidos((data as Pedido[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      const doStatus =
        aba === "ativos"
          ? ATIVOS.includes(p.status)
          : !ATIVOS.includes(p.status);
      if (!doStatus) return false;
      if (!buscaNorm) return true;
      const noCliente = p.cliente?.nome?.toLowerCase().includes(buscaNorm);
      const noItem = (p.itens ?? []).some((i) =>
        i.descricao.toLowerCase().includes(buscaNorm)
      );
      return noCliente || noItem;
    });
  }, [pedidos, aba, busca]);

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

      <Input
        placeholder="Buscar por cliente ou item..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-3"
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
      ) : erro ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <WifiOff className="size-8 text-muted-foreground/60" />
          <p className="font-medium text-muted-foreground">Sem conexão</p>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RotateCw className="size-4" />
            Tentar de novo
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icone={ClipboardList}
          titulo={
            busca
              ? "Nenhum pedido encontrado"
              : aba === "ativos"
                ? "Nenhum pedido ativo"
                : "Nenhum pedido concluído"
          }
          descricao={
            busca
              ? "Tente buscar por outro nome ou item."
              : "Toque em Novo para registrar uma encomenda ou orçamento."
          }
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
