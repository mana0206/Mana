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
  created_at: string;
  receita?: Receita | null;
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

export const STATUS_CORES: Record<PedidoStatus, string> = {
  orcamento: "bg-amber-100 text-amber-800 border-amber-200",
  confirmado: "bg-blue-100 text-blue-800 border-blue-200",
  em_producao: "bg-purple-100 text-purple-800 border-purple-200",
  pronto: "bg-teal-100 text-teal-800 border-teal-200",
  entregue: "bg-green-100 text-green-800 border-green-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200",
};

export const PROXIMO_STATUS: Partial<Record<PedidoStatus, PedidoStatus>> = {
  orcamento: "confirmado",
  confirmado: "em_producao",
  em_producao: "pronto",
  pronto: "entregue",
};

export const CATEGORIAS_ENTRADA = ["venda", "sinal", "outros"];
export const CATEGORIAS_SAIDA = [
  "ingredientes",
  "embalagem",
  "equipamento",
  "transporte",
  "outros",
];
