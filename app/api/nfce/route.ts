import { NextRequest, NextResponse } from "next/server";
import { consultarNFCe, extrairChave } from "@/lib/nfce";

export async function GET(request: NextRequest) {
  const entrada = request.nextUrl.searchParams.get("q") ?? "";
  const chave = extrairChave(entrada);
  if (!chave) {
    return NextResponse.json(
      { erro: "QR code inválido — não encontrei a chave de acesso (44 dígitos)." },
      { status: 400 }
    );
  }
  try {
    const nota = await consultarNFCe(chave);
    if (nota.itens.length === 0) {
      return NextResponse.json(
        { erro: "A Sefaz respondeu, mas não consegui ler os itens da nota." },
        { status: 502 }
      );
    }
    return NextResponse.json(nota);
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao consultar a Sefaz." },
      { status: 502 }
    );
  }
}
