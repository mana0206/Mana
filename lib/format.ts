import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatBRL(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatQtd(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
}

/** Aceita "12,50" ou "12.50" e devolve número (0 se inválido). */
export function parseDecimal(texto: string): number {
  const n = parseFloat(texto.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(n)) {
    const n2 = parseFloat(texto.replace(",", "."));
    return Number.isNaN(n2) ? 0 : n2;
  }
  return n;
}

/** Versão simples: troca vírgula por ponto, sem tratar milhar. */
export function parseDecimalSimples(texto: string): number {
  const n = parseFloat(texto.replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

export function formatDataEntrega(iso: string | null): string {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  const hora = format(d, "HH:mm");
  const comHora = hora !== "00:00" ? ` às ${hora}` : "";
  if (isToday(d)) return `Hoje${comHora}`;
  if (isTomorrow(d)) return `Amanhã${comHora}`;
  return format(d, "EEE, dd/MM", { locale: ptBR }) + comHora;
}

/** Datas "yyyy-mm-dd" (sem hora) são interpretadas no fuso local —
 * `new Date("2026-07-06")` seria UTC e exibiria o dia anterior no Brasil. */
function comoDataLocal(iso: string): Date {
  const soData = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (soData) {
    return new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]));
  }
  return new Date(iso);
}

export function formatData(iso: string | null): string {
  if (!iso) return "—";
  return format(comoDataLocal(iso), "dd/MM/yyyy");
}

export function formatMesAno(d: Date): string {
  return format(d, "MMMM 'de' yyyy", { locale: ptBR });
}

/** Telefone só com dígitos para link wa.me (assume Brasil +55). */
export function telefoneParaWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}
