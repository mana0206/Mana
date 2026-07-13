"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

/** Aplica a máscara DD/MM/AA HH:MM conforme o usuário digita. */
function mascarar(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 10);
  let saida = "";
  for (let i = 0; i < d.length; i++) {
    if (i === 2 || i === 4) saida += "/";
    if (i === 6) saida += " ";
    if (i === 8) saida += ":";
    saida += d[i];
  }
  return saida;
}

/** Converte "DD/MM/AA HH:MM" em ISO; null se inválido ou incompleto. */
export function dataHoraParaISO(texto: string): string | null {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, aa, hh, min] = m;
  const data = new Date(
    2000 + Number(aa),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min)
  );
  const valida =
    data.getDate() === Number(dd) &&
    data.getMonth() === Number(mm) - 1 &&
    Number(hh) <= 23 &&
    Number(min) <= 59;
  return valida ? data.toISOString() : null;
}

/** Formata um ISO para exibição no padrão DD/MM/AA HH:MM. */
export function isoParaDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${p(d.getFullYear() % 100)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function partesDoTexto(texto: string): {
  data: Date | undefined;
  hora: string;
} {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) {
    const soData = texto.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (soData) {
      const [, dd, mm, aa] = soData;
      return {
        data: new Date(2000 + Number(aa), Number(mm) - 1, Number(dd)),
        hora: "",
      };
    }
    return { data: undefined, hora: "" };
  }
  const [, dd, mm, aa, hh, min] = m;
  return {
    data: new Date(2000 + Number(aa), Number(mm) - 1, Number(dd)),
    hora: `${hh}:${min}`,
  };
}

function formatarComData(data: Date, hora: string): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const [hh, min] = hora.split(":");
  return `${p(data.getDate())}/${p(data.getMonth() + 1)}/${p(data.getFullYear() % 100)} ${hh ?? "00"}:${min ?? "00"}`;
}

export function DataHoraInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (texto: string) => void;
  id?: string;
}) {
  const [popoverAberto, setPopoverAberto] = useState(false);
  const incompleto = value.length > 0 && value.length < 14;
  const invalido = value.length === 14 && !dataHoraParaISO(value);
  const { data: dataSelecionada, hora } = partesDoTexto(value);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="numeric"
          placeholder="dd/mm/aa hh:mm"
          value={value}
          onChange={(e) => onChange(mascarar(e.target.value))}
          className={cn(
            "flex-1",
            invalido && "border-destructive ring-destructive/30"
          )}
        />
        <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0">
              <CalendarIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dataSelecionada}
              defaultMonth={dataSelecionada}
              onSelect={(dia) => {
                if (!dia) return;
                onChange(formatarComData(dia, hora || "12:00"));
              }}
              autoFocus
            />
            <div className="flex items-center gap-2 border-t p-3">
              <label className="text-sm text-muted-foreground">Hora</label>
              <Input
                type="time"
                className="flex-1"
                value={hora}
                onChange={(e) => {
                  const base = dataSelecionada ?? new Date();
                  onChange(formatarComData(base, e.target.value));
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => setPopoverAberto(false)}
              >
                OK
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {(incompleto || invalido) && (
        <p className="text-xs text-destructive">
          {invalido
            ? "Data ou hora inválida"
            : "Complete no formato dd/mm/aa hh:mm"}
        </p>
      )}
    </div>
  );
}
