"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { totalPedido } from "@/lib/calc";
import { formatBRL } from "@/lib/format";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCw, WifiOff } from "lucide-react";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function AgendaPage() {
  const [mes, setMes] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const inicio = startOfWeek(startOfMonth(mes));
    const fim = endOfWeek(endOfMonth(mes));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pedidos")
      .select("*, cliente:clientes(*), itens:pedido_itens(*)")
      .gte("data_entrega", inicio.toISOString())
      .lte("data_entrega", fim.toISOString())
      .neq("status", "cancelado")
      .order("data_entrega");
    if (error) {
      setErro(true);
      setCarregando(false);
      return;
    }
    setPedidos((data as Pedido[]) ?? []);
    setCarregando(false);
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const dias = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(mes)),
        end: endOfWeek(endOfMonth(mes)),
      }),
    [mes]
  );

  function entregasDoDia(dia: Date) {
    return pedidos.filter(
      (p) => p.data_entrega && isSameDay(new Date(p.data_entrega), dia)
    );
  }

  function irParaHoje() {
    const hoje = new Date();
    setMes(hoje);
    setDiaSelecionado(hoje);
  }

  const doDiaSelecionado = entregasDoDia(diaSelecionado);
  const estaNoMesAtual = isSameMonth(mes, new Date());

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Agenda"
        acao={
          !estaNoMesAtual && (
            <Button size="sm" variant="outline" onClick={irParaHoje}>
              Hoje
            </Button>
          )
        }
      />

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Mês anterior"
          onClick={() => setMes(subMonths(mes, 1))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span className="font-semibold capitalize">
          {format(mes, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Próximo mês"
          onClick={() => setMes(addMonths(mes, 1))}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {carregando ? (
        <Skeleton className="h-72" />
      ) : erro ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <WifiOff className="size-8 text-muted-foreground/60" />
          <p className="font-medium text-muted-foreground">Sem conexão</p>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RotateCw className="size-4" />
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DIAS_SEMANA.map((d, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="py-1 text-xs font-medium text-muted-foreground"
              >
                {d}
              </span>
            ))}
            {dias.map((dia) => {
              const entregas = entregasDoDia(dia);
              const selecionado = isSameDay(dia, diaSelecionado);
              return (
                <button
                  key={dia.toISOString()}
                  onClick={() => setDiaSelecionado(dia)}
                  aria-current={selecionado ? "date" : undefined}
                  aria-label={format(dia, "EEEE, dd 'de' MMMM", {
                    locale: ptBR,
                  })}
                  className={cn(
                    "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                    !isSameMonth(dia, mes) && "text-muted-foreground/40",
                    isToday(dia) && "font-bold text-primary",
                    selecionado
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {format(dia, "d")}
                  {entregas.length > 0 && (
                    <span className="absolute bottom-1 flex gap-0.5">
                      {Array.from({ length: Math.min(entregas.length, 3) }).map(
                        (_, i) => (
                          <span
                            key={i}
                            className={cn(
                              "size-1.5 rounded-full",
                              selecionado ? "bg-primary-foreground" : "bg-primary"
                            )}
                          />
                        )
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <section>
            <h2 className="mb-2 font-semibold capitalize">
              {format(diaSelecionado, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            {doDiaSelecionado.length === 0 ? (
              <EmptyState
                icone={CalendarDays}
                titulo="Nenhuma entrega neste dia"
              />
            ) : (
              <div className="space-y-2">
                {doDiaSelecionado.map((p) => (
                  <Link key={p.id} href={`/pedidos/${p.id}`} className="block">
                    <Card className="transition-colors hover:bg-accent/50">
                      <CardContent className="flex items-center justify-between gap-2 p-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {p.cliente?.nome ?? "Sem cliente"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {p.data_entrega &&
                            format(new Date(p.data_entrega), "HH:mm") !==
                              "00:00"
                              ? format(new Date(p.data_entrega), "HH:mm")
                              : "Sem horário"}{" "}
                            · {formatBRL(totalPedido(p, p.itens ?? []))}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={STATUS_CORES[p.status]}
                        >
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
