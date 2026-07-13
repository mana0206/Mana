"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

export function DataHoraInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (texto: string) => void;
  id?: string;
}) {
  const incompleto = value.length > 0 && value.length < 14;
  const invalido = value.length === 14 && !dataHoraParaISO(value);
  return (
    <div className="space-y-1">
      <Input
        id={id}
        inputMode="numeric"
        placeholder="dd/mm/aa hh:mm"
        value={value}
        onChange={(e) => onChange(mascarar(e.target.value))}
        className={cn(invalido && "border-destructive ring-destructive/30")}
      />
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
