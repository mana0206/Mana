export type UnidadeUso = "g" | "ml" | "un";

export type Ingrediente = {
  id: string;
  nome: string;
  preco_compra: number;
  quantidade_embalagem: number;
  unidade_uso: UnidadeUso;
  estoque_atual: number;
  estoque_minimo: number;
  created_at: string;
};

export type Receita = {
  id: string;
  nome: string;
  rendimento_qtd: number;
  rendimento_unidade: string;
  tempo_preparo_min: number | null;
  foto_url: string | null;
  observacoes: string | null;
  created_at: string;
};

export type ReceitaIngrediente = {
  id: string;
  receita_id: string;
  ingrediente_id: string;
  quantidade: number;
  ingrediente?: Ingrediente;
};

export type CustoFixo = {
  id: string;
  nome: string;
  tipo: "fixo" | "percentual";
  valor: number;
  ativo: boolean;
  created_at: string;
};

export type Produto = {
  id: string;
  nome: string;
  receita_id: string | null;
  custo_manual: number | null;
  margem: number;
  preco_venda: number | null;
  foto_url: string | null;
  ativo: boolean;
  estoque_atual: number;
  created_at: string;
  receita?: Receita | null;
};

export type Producao = {
  id: string;
  receita_id: string | null;
  produto_id: string | null;
  multiplicador: number;
  quantidade_produzida: number;
  observacoes: string | null;
  created_at: string;
};

export type NotaImportada = {
  id: string;
  chave: string;
  emitente: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  itens_importados: number;
  created_at: string;
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  created_at: string;
};

export type PedidoStatus =
  | "orcamento"
  | "confirmado"
  | "em_producao"
  | "pronto"
  | "entregue"
  | "cancelado";

export type Pedido = {
  id: string;
  cliente_id: string | null;
  status: PedidoStatus;
  data_entrega: string | null;
  sinal: number;
  desconto: number;
  forma_pagamento: string | null;
  observacoes: string | null;
  pago: boolean;
  created_at: string;
  cliente?: Cliente | null;
  itens?: PedidoItem[];
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  produto?: Produto | null;
};

export type MovimentoFinanceiro = {
  id: string;
  tipo: "entrada" | "saida";
  categoria: string;
  valor: number;
  data: string;
  descricao: string | null;
  pedido_id: string | null;
  created_at: string;
};

export type Compra = {
  id: string;
  ingrediente_id: string | null;
  descricao: string;
  quantidade: number | null;
  comprado: boolean;
  valor: number | null;
  created_at: string;
  ingrediente?: Ingrediente | null;
};

export const STATUS_LABELS: Record<PedidoStatus, string> = {
  orcamento: "Orçamento",
  confirmado: "Confirmado",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

// Paleta da marca (Guia de Marca): dourado trigo #b3a268, sálvia #8c9a5d,
// oliva #586b32, oliva escuro #3a4720.
export const STATUS_CORES: Record<PedidoStatus, string> = {
  orcamento: "bg-[#b3a268]/15 text-[#8a7a3f] border-[#b3a268]/40",
  confirmado: "bg-[#8c9a5d]/15 text-[#5f6a3d] border-[#8c9a5d]/40",
  em_producao: "bg-[#586b32]/15 text-[#586b32] border-[#586b32]/40",
  pronto: "bg-[#b3a268]/25 text-[#6b5e2e] border-[#b3a268]/50",
  entregue: "bg-[#3a4720]/15 text-[#3a4720] border-[#3a4720]/40",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export const PROXIMO_STATUS: Partial<Record<PedidoStatus, PedidoStatus>> = {
  orcamento: "confirmado",
  confirmado: "em_producao",
  em_producao: "pronto",
  pronto: "entregue",
};

export const STATUS_ANTERIOR: Partial<Record<PedidoStatus, PedidoStatus>> = {
  confirmado: "orcamento",
  em_producao: "confirmado",
  pronto: "em_producao",
  entregue: "pronto",
};

export const CATEGORIAS_ENTRADA = ["venda", "sinal", "outros"];
export const CATEGORIAS_SAIDA = [
  "ingredientes",
  "embalagem",
  "equipamento",
  "transporte",
  "outros",
];
