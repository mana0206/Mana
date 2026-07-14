"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { totalPedido } from "@/lib/calc";
import { formatBRL, formatDataEntrega, telefoneParaWhatsApp } from "@/lib/format";
import {
  STATUS_CORES,
  STATUS_LABELS,
  type Pedido,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  ArrowLeft,
  Cake,
  ClipboardList,
  MessageCircle,
  RotateCw,
  Star,
  Wallet,
  WifiOff,
} from "lucide-react";

export default function PerfilClientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [cliente, setCliente] = useState<{
    id: string;
    nome: string;
    telefone: string | null;
    endereco: string | null;
    observacoes: string | null;
  } | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const supabase = createClient();
    const [cliRes, pedRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", id).single(),
      supabase
        .from("pedidos")
        .select("*, itens:pedido_itens(*)")
        .eq("cliente_id", id)
        .order("data_entrega", { ascending: false, nullsFirst: false }),
    ]);
    if (cliRes.error || pedRes.error) {
      setErro(true);
      setCarregando(false);
      return;
    }
    setCliente(cliRes.data);
    setPedidos((pedRes.data as Pedido[]) ?? []);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pedidosEntregues = useMemo(
    () => pedidos.filter((p) => p.status === "entregue"),
    [pedidos]
  );
  const totalGasto = useMemo(
    () =>
      pedidosEntregues.reduce(
        (s, p) => s + totalPedido(p, p.itens ?? []),
        0
      ),
    [pedidosEntregues]
  );

  const produtoFavorito = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const p of pedidosEntregues) {
      for (const item of p.itens ?? []) {
        contagem.set(
          item.descricao,
          (contagem.get(item.descricao) ?? 0) + item.quantidade
        );
      }
    }
    let melhor: string | null = null;
    let melhorQtd = 0;
    for (const [nome, qtd] of contagem) {
      if (qtd > melhorQtd) {
        melhor = nome;
        melhorQtd = qtd;
      }
    }
    return melhor;
  }, [pedidosEntregues]);

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (erro || !cliente) {
    return (
      <div className="flex flex-col items-center gap-3 pt-20 text-center">
        <WifiOff className="size-8 text-muted-foreground/60" />
        <p className="font-medium text-muted-foreground">
          {erro ? "Sem conexão" : "Cliente não encontrado"}
        </p>
        {erro && (
          <Button variant="outline" size="sm" onClick={carregar}>
            <RotateCw className="size-4" />
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

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
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl text-primary">
            {cliente.nome}
          </h1>
          {cliente.telefone && (
            <p className="text-sm text-muted-foreground">
              {cliente.telefone}
            </p>
          )}
        </div>
        {cliente.telefone && (
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 border-[#8c9a5d]/50 text-[#586b32]"
            aria-label={`Chamar ${cliente.nome} no WhatsApp`}
            asChild
          >
            <a
              href={`https://wa.me/${telefoneParaWhatsApp(cliente.telefone)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" />
            </a>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-[#8c9a5d]/40 bg-[#8c9a5d]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#5f6a3d]">
              <Wallet className="size-4" />
              <span className="text-xs font-medium">Total gasto</span>
            </div>
            <p className="mt-1 text-lg font-bold text-[#3a4720]">
              {formatBRL(totalGasto)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ClipboardList className="size-4" />
              <span className="text-xs font-medium">Pedidos entregues</span>
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">
              {pedidosEntregues.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {produtoFavorito && (
        <Card className="border-[#b3a268]/40 bg-[#b3a268]/10">
          <CardContent className="flex items-center gap-3 p-4">
            <Star className="size-5 shrink-0 text-[#8a7a3f]" />
            <p className="text-sm">
              <strong className="text-[#3a4720]">Pede sempre:</strong>{" "}
              <span className="text-[#6b5e2e]">{produtoFavorito}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {cliente.endereco && (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="mb-1 font-medium text-muted-foreground">
              Endereço
            </p>
            {cliente.endereco}
          </CardContent>
        </Card>
      )}

      {cliente.observacoes && (
        <Card>
          <CardContent className="p-4 text-sm">
            <p className="mb-1 font-medium text-muted-foreground">
              Observações
            </p>
            {cliente.observacoes}
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Histórico de pedidos</h2>
        {pedidos.length === 0 ? (
          <EmptyState
            icone={Cake}
            titulo="Nenhum pedido ainda"
            descricao="Os pedidos deste cliente aparecem aqui."
          />
        ) : (
          <div className="space-y-2">
            {pedidos.map((p) => (
              <Link key={p.id} href={`/pedidos/${p.id}`} className="block">
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatDataEntrega(p.data_entrega)}
                      </span>
                      <Badge
                        variant="outline"
                        className={STATUS_CORES[p.status]}
                      >
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="truncate text-sm text-muted-foreground">
                        {(p.itens ?? [])
                          .map((i) => `${i.quantidade}x ${i.descricao}`)
                          .join(", ")}
                      </p>
                      <span className="shrink-0 pl-2 font-semibold text-foreground">
                        {formatBRL(totalPedido(p, p.itens ?? []))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
