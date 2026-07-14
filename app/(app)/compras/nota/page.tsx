"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { converterUnidade, type NotaNFCe } from "@/lib/nfce";
import { formatBRL, formatData, formatQtd } from "@/lib/format";
import type { Ingrediente } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Link2,
  Loader2,
  QrCode,
  ScanLine,
} from "lucide-react";

type Destino =
  | { tipo: "novo" }
  | { tipo: "existente"; ingredienteId: string }
  | { tipo: "ignorar" };

/** Normaliza para comparação: sem acentos, minúsculas, só letras/números. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pontua a similaridade entre descrição da nota e nome do ingrediente. */
function pontuar(descricao: string, nome: string): number {
  const a = new Set(normalizar(descricao).split(" ").filter((t) => t.length > 2));
  const b = new Set(normalizar(nome).split(" ").filter((t) => t.length > 2));
  if (a.size === 0 || b.size === 0) return 0;
  let comuns = 0;
  for (const t of b) {
    if (a.has(t)) comuns++;
    else if ([...a].some((x) => x.startsWith(t) || t.startsWith(x))) comuns += 0.5;
  }
  return comuns / b.size;
}

function nomeBonito(descricao: string): string {
  return descricao
    .toLowerCase()
    .split(" ")
    .map((p) => (p.length > 2 ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

export default function ImportarNotaPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"entrada" | "revisao" | "concluido">("entrada");
  const [lendo, setLendo] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [url, setUrl] = useState("");
  const [nota, setNota] = useState<NotaNFCe | null>(null);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [resumo, setResumo] = useState({ criados: 0, atualizados: 0 });
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  async function iniciarLeitura() {
    setLendo(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const leitor = new Html5Qrcode("leitor-qr");
      scannerRef.current = leitor;
      await leitor.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (texto) => {
          leitor.stop().catch(() => {});
          scannerRef.current = null;
          setLendo(false);
          consultar(texto);
        },
        () => {}
      );
    } catch {
      setLendo(false);
      toast.error("Não consegui acessar a câmera — cole o link do QR abaixo.");
    }
  }

  async function consultar(entrada: string) {
    setConsultando(true);
    try {
      const res = await fetch(`/api/nfce?q=${encodeURIComponent(entrada)}`);
      const corpo = await res.json();
      if (!res.ok) {
        toast.error(corpo.erro ?? "Falha ao consultar a nota");
        return;
      }
      const notaLida = corpo as NotaNFCe;

      const supabase = createClient();
      const [{ data: jaImportada }, { data: ings }] = await Promise.all([
        supabase.from("notas_importadas").select("id").eq("chave", notaLida.chave).limit(1),
        supabase.from("ingredientes").select("*").order("nome"),
      ]);
      if (jaImportada && jaImportada.length > 0) {
        toast.error("Esta nota já foi importada antes.");
        return;
      }
      const lista = (ings as Ingrediente[]) ?? [];
      setIngredientes(lista);
      setNota(notaLida);
      // sugestão automática: melhor ingrediente com pontuação >= 0.6
      setDestinos(
        notaLida.itens.map((item) => {
          let melhor: Ingrediente | null = null;
          let melhorNota = 0;
          for (const ing of lista) {
            const p = pontuar(item.descricao, ing.nome);
            if (p > melhorNota) {
              melhorNota = p;
              melhor = ing;
            }
          }
          return melhor && melhorNota >= 0.6
            ? { tipo: "existente" as const, ingredienteId: melhor.id }
            : { tipo: "novo" as const };
        })
      );
      setEtapa("revisao");
    } finally {
      setConsultando(false);
    }
  }

  async function confirmarImportacao() {
    if (!nota) return;
    setSalvando(true);
    const supabase = createClient();
    let criados = 0;
    let atualizados = 0;

    for (let i = 0; i < nota.itens.length; i++) {
      const item = nota.itens[i];
      const destino = destinos[i];
      if (destino.tipo === "ignorar") continue;
      const { unidade_uso, fator } = converterUnidade(item.unidade);
      const qtdConvertida = item.quantidade * fator;

      if (destino.tipo === "novo") {
        const { error } = await supabase.from("ingredientes").insert({
          nome: nomeBonito(item.descricao),
          preco_compra: item.valorTotal,
          quantidade_embalagem: qtdConvertida,
          unidade_uso,
          estoque_atual: qtdConvertida,
          estoque_minimo: 0,
        });
        if (!error) criados++;
      } else {
        const atual = ingredientes.find((x) => x.id === destino.ingredienteId);
        if (!atual) continue;
        // mesma unidade: soma o estoque; atualiza o custo pela compra mais recente
        const compativel = atual.unidade_uso === unidade_uso;
        const { error } = await supabase
          .from("ingredientes")
          .update({
            estoque_atual: Number(atual.estoque_atual) + (compativel ? qtdConvertida : item.quantidade),
            preco_compra: item.valorTotal,
            quantidade_embalagem: compativel ? qtdConvertida : item.quantidade,
          })
          .eq("id", atual.id);
        if (!error) atualizados++;
      }
    }

    // despesa no financeiro com o total da nota
    await supabase.from("movimentos_financeiros").insert({
      tipo: "saida",
      categoria: "ingredientes",
      valor: nota.valorTotal,
      data: nota.dataEmissao ?? undefined,
      descricao: `NFC-e — ${nota.emitente}`,
    });

    // marca a nota como importada (bloqueia duplicidade)
    await supabase.from("notas_importadas").insert({
      chave: nota.chave,
      emitente: nota.emitente,
      valor_total: nota.valorTotal,
      data_emissao: nota.dataEmissao,
      itens_importados: criados + atualizados,
    });

    setResumo({ criados, atualizados });
    setSalvando(false);
    setEtapa("concluido");
  }

  // ---------- etapa 1: entrada ----------
  if (etapa === "entrada") {
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
          <h1 className="font-serif text-2xl text-primary">Importar nota (QR)</h1>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Aponte a câmera para o QR code do cupom fiscal. Os itens da
              compra entram direto no estoque e a despesa vai para o
              financeiro.
            </p>
            <div
              id="leitor-qr"
              className={lendo ? "overflow-hidden rounded-xl" : "hidden"}
            />
            {!lendo && (
              <Button className="w-full" size="lg" onClick={iniciarLeitura} disabled={consultando}>
                <Camera className="size-5" />
                Escanear QR code
              </Button>
            )}
            {lendo && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  scannerRef.current?.stop().catch(() => {});
                  scannerRef.current = null;
                  setLendo(false);
                }}
              >
                Parar leitura
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Label className="flex items-center gap-2">
              <Link2 className="size-4" />
              Ou cole o link do QR code
            </Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://nfeweb.sefaz.go.gov.br/..."
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={!url.trim() || consultando}
              onClick={() => consultar(url.trim())}
            >
              {consultando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ScanLine className="size-4" />
              )}
              {consultando ? "Consultando a Sefaz..." : "Buscar nota"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- etapa 2: revisão ----------
  if (etapa === "revisao" && nota) {
    const importaveis = destinos.filter((d) => d.tipo !== "ignorar").length;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Voltar"
            onClick={() => setEtapa("entrada")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-2xl text-primary">
              {nota.emitente || "Nota fiscal"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatData(nota.dataEmissao)} ·{" "}
              <span className="font-semibold text-foreground">
                {formatBRL(nota.valorTotal)}
              </span>{" "}
              · {nota.itens.length} itens
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {nota.itens.map((item, i) => {
            const { unidade_uso, fator } = converterUnidade(item.unidade);
            const destino = destinos[i];
            return (
              <Card key={i} className={destino.tipo === "ignorar" ? "opacity-50" : undefined}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.descricao}</p>
                    <p className="shrink-0 text-sm font-semibold">
                      {formatBRL(item.valorTotal)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatQtd(item.quantidade)} {item.unidade} ={" "}
                    {formatQtd(item.quantidade * fator)} {unidade_uso} ·{" "}
                    {formatBRL(item.valorUnitario)}/{item.unidade}
                  </p>
                  <Select
                    value={
                      destino.tipo === "existente"
                        ? destino.ingredienteId
                        : destino.tipo
                    }
                    onValueChange={(v) =>
                      setDestinos(
                        destinos.map((d, j) =>
                          j === i
                            ? v === "novo" || v === "ignorar"
                              ? { tipo: v }
                              : { tipo: "existente", ingredienteId: v }
                            : d
                        )
                      )
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">
                        ➕ Criar: {nomeBonito(item.descricao)}
                      </SelectItem>
                      {ingredientes.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          🔗 {ing.nome}
                        </SelectItem>
                      ))}
                      <SelectItem value="ignorar">✕ Não importar</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-primary/30 bg-secondary/50">
          <CardContent className="space-y-1 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens a importar</span>
              <span className="font-medium">{importaveis}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Despesa no financeiro
              </span>
              <span className="font-semibold text-primary">
                {formatBRL(nota.valorTotal)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          onClick={confirmarImportacao}
          disabled={salvando}
        >
          {salvando ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
          {salvando ? "Importando..." : "Confirmar importação"}
        </Button>
      </div>
    );
  }

  // ---------- etapa 3: concluído ----------
  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <QrCode className="size-8 text-primary" />
      </div>
      <h1 className="font-serif text-2xl text-primary">Nota importada!</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        {resumo.criados} {resumo.criados === 1 ? "ingrediente criado" : "ingredientes criados"},{" "}
        {resumo.atualizados} {resumo.atualizados === 1 ? "atualizado" : "atualizados"}. A despesa de{" "}
        <strong>{formatBRL(nota?.valorTotal ?? 0)}</strong> foi lançada no financeiro.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2 pt-2">
        <Button onClick={() => router.push("/compras")}>Ver estoque</Button>
        <Button variant="outline" onClick={() => router.push("/financeiro")}>
          Ver financeiro
        </Button>
      </div>
    </div>
  );
}
