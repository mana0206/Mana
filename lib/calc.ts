import type {
  CustoFixo,
  Ingrediente,
  Pedido,
  PedidoItem,
  Produto,
  ReceitaIngrediente,
} from "./types";

/** Custo por unidade de uso (ex: R$/g) de um ingrediente. */
export function custoUnitario(ing: Ingrediente): number {
  if (!ing.quantidade_embalagem) return 0;
  return ing.preco_compra / ing.quantidade_embalagem;
}

/** Custo dos ingredientes de uma receita (itens precisam vir com `ingrediente`). */
export function custoIngredientes(itens: ReceitaIngrediente[]): number {
  return itens.reduce((soma, item) => {
    if (!item.ingrediente) return soma;
    return soma + item.quantidade * custoUnitario(item.ingrediente);
  }, 0);
}

/** Aplica custos fixos ativos sobre o custo de ingredientes. */
export function custoComFixos(
  custoIngr: number,
  custosFixos: CustoFixo[]
): number {
  return custosFixos
    .filter((c) => c.ativo)
    .reduce((total, c) => {
      if (c.tipo === "fixo") return total + c.valor;
      return total + custoIngr * (c.valor / 100);
    }, custoIngr);
}

/** Preço sugerido a partir do custo total e da margem desejada (%). */
export function precoSugerido(custoTotal: number, margem: number): number {
  return custoTotal * (1 + margem / 100);
}

/** Custo de um produto: manual, ou da receita (custo total / rendimento). */
export function custoProduto(
  produto: Produto,
  itensReceita: ReceitaIngrediente[],
  custosFixos: CustoFixo[],
  rendimento: number
): number {
  if (produto.custo_manual != null) return produto.custo_manual;
  const base = custoIngredientes(itensReceita);
  const total = custoComFixos(base, custosFixos);
  return rendimento > 0 ? total / rendimento : total;
}

export function subtotalPedido(itens: PedidoItem[]): number {
  return itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
}

export function totalPedido(pedido: Pedido, itens: PedidoItem[]): number {
  return Math.max(0, subtotalPedido(itens) - (pedido.desconto ?? 0));
}

export function saldoPedido(pedido: Pedido, itens: PedidoItem[]): number {
  if (pedido.pago) return 0;
  return Math.max(0, totalPedido(pedido, itens) - (pedido.sinal ?? 0));
}
