// Consulta e parse de NFC-e da Sefaz-GO a partir do QR code do cupom fiscal.
// A Sefaz exige a sequência de sessão do navegador: página pública → iframe
// da DANFE → XHR JSON que devolve o HTML da DANFE em PARAMS.DANFE_NFCE_HTML.

export type ItemNFCe = {
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
};

export type NotaNFCe = {
  chave: string;
  emitente: string;
  dataEmissao: string | null; // yyyy-mm-dd
  valorTotal: number;
  itens: ItemNFCe[];
};

const BASE = "https://nfeweb.sefaz.go.gov.br";
const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

/** Extrai a chave de acesso (44 dígitos) do conteúdo do QR code ou de uma URL. */
export function extrairChave(entrada: string): string | null {
  const m = entrada.match(/\d{44}/);
  return m ? m[0] : null;
}

function decodificarEntidades(s: string): string {
  const mapa: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&nbsp;": " ",
    "&aacute;": "á", "&Aacute;": "Á", "&agrave;": "à", "&atilde;": "ã",
    "&Atilde;": "Ã", "&acirc;": "â", "&eacute;": "é", "&Eacute;": "É",
    "&ecirc;": "ê", "&iacute;": "í", "&oacute;": "ó", "&ocirc;": "ô",
    "&otilde;": "õ", "&uacute;": "ú", "&ccedil;": "ç", "&Ccedil;": "Ç",
  };
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-zA-Z]+;/g, (e) => mapa[e] ?? e);
}

function numeroPtBR(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

function limpar(s: string): string {
  return decodificarEntidades(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca a nota na Sefaz-GO e devolve os dados estruturados. */
export async function consultarNFCe(chave: string): Promise<NotaNFCe> {
  const cookies: string[] = [];
  const coletar = (res: Response) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      cookies.push(c.split(";")[0]);
    }
  };
  // O WAF da Sefaz exige o conjunto completo de headers de navegador
  // (Accept, Accept-Language e Sec-Fetch-*) — sem eles responde 403.
  const base: Record<string, string> = {
    "User-Agent": UA,
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
  };
  const navegacao = (extras: Record<string, string> = {}) => ({
    ...base,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
    ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
    ...extras,
  });
  const xhr = (extras: Record<string, string> = {}) => ({
    ...base,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
    ...extras,
  });

  const urlPagina = `${BASE}/nfeweb/sites/nfce/danfeNFCe?p=${chave}%7C3%7C1`;
  const urlIframe = `${BASE}/nfeweb/sites/nfce/render/danfeNFCe?chNFe=${chave}`;
  const urlJson = `${BASE}/nfeweb/sites/nfce/render/html/danfeNFCe?chNFe=${chave}`;

  const r1 = await fetch(urlPagina, {
    headers: navegacao({ "Sec-Fetch-Site": "none" }),
  });
  coletar(r1);
  const r2 = await fetch(urlIframe, {
    headers: navegacao({
      Referer: urlPagina,
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Dest": "iframe",
    }),
  });
  coletar(r2);
  const r3 = await fetch(urlJson, {
    headers: xhr({ Referer: urlIframe }),
  });

  if (!r3.ok) {
    throw new Error(`Sefaz retornou HTTP ${r3.status}`);
  }
  const corpo = await r3.json().catch(() => null);
  const html: string | undefined = corpo?.PARAMS?.DANFE_NFCE_HTML;
  if (corpo?.STATUS !== "SUCCESS" || !html) {
    throw new Error("A Sefaz não devolveu a nota (tente novamente em instantes)");
  }

  // ---- itens ----
  const itens: ItemNFCe[] = [];
  const linhas = html.match(/<tr id="Item[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const linha of linhas) {
    const descricao = limpar(linha.match(/class="txtTit">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const codigo = (linha.match(/class="RCod">([\s\S]*?)<\/span>/)?.[1] ?? "").replace(/\D/g, "");
    const qtd = numeroPtBR(limpar(linha.match(/class="Rqtd">[\s\S]*?<\/strong>([\s\S]*?)<\/span>/)?.[1] ?? "0"));
    const unidadeBruta = limpar(linha.match(/class="RUN">[\s\S]*?<\/strong>([\s\S]*?)<\/span>/)?.[1] ?? "UN");
    const unidade = (unidadeBruta.match(/[A-Za-z]+/)?.[0] ?? "UN").toUpperCase();
    const vlUnit = numeroPtBR(limpar(linha.match(/class="RvlUnit">[\s\S]*?<\/strong>([\s\S]*?)<\/span>/)?.[1] ?? "0"));
    const vlTotal = numeroPtBR(limpar(linha.match(/class="valor">([\s\S]*?)<\/span>/)?.[1] ?? "0"));
    if (!descricao) continue;
    itens.push({ codigo, descricao, quantidade: qtd, unidade, valorUnitario: vlUnit, valorTotal: vlTotal });
  }

  // consolida itens repetidos (mesmo código + descrição)
  const porChave = new Map<string, ItemNFCe>();
  for (const item of itens) {
    const k = `${item.codigo}|${item.descricao}`;
    const atual = porChave.get(k);
    if (atual) {
      atual.quantidade += item.quantidade;
      atual.valorTotal += item.valorTotal;
    } else {
      porChave.set(k, { ...item });
    }
  }

  // ---- cabeçalho/totais ----
  const emitente = limpar(html.match(/class="txtTopo"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
  const valorPagar = numeroPtBR(
    limpar(html.match(/Valor a pagar R\$:<\/label><span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "0")
  );
  const dataBr = html.match(/Emiss[\s\S]{0,20}?<\/strong>\s*(\d{2})\/(\d{2})\/(\d{4})/);
  const dataEmissao = dataBr ? `${dataBr[3]}-${dataBr[2]}-${dataBr[1]}` : null;

  return {
    chave,
    emitente,
    dataEmissao,
    valorTotal: valorPagar,
    itens: Array.from(porChave.values()),
  };
}

/** Converte unidade da NFC-e para a unidade de uso do app e o fator. */
export function converterUnidade(unidadeNFCe: string): {
  unidade_uso: "g" | "ml" | "un";
  fator: number;
} {
  const u = unidadeNFCe.toUpperCase();
  if (u === "KG" || u === "KILO" || u === "QUILO") return { unidade_uso: "g", fator: 1000 };
  if (u === "G" || u === "GR" || u === "GRAMA") return { unidade_uso: "g", fator: 1 };
  if (u === "L" || u === "LT" || u === "LITRO") return { unidade_uso: "ml", fator: 1000 };
  if (u === "ML") return { unidade_uso: "ml", fator: 1 };
  return { unidade_uso: "un", fator: 1 };
}
