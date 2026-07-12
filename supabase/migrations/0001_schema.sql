-- Schema do app Maná — gestão de confeitaria
-- Aplicar no SQL Editor do Supabase (ou via MCP quando conectado)

-- ============ TIPOS ============
create type pedido_status as enum ('orcamento', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado');
create type mov_tipo as enum ('entrada', 'saida');
create type custo_tipo as enum ('fixo', 'percentual');

-- ============ INGREDIENTES ============
-- preco_compra é o preço da embalagem; quantidade_embalagem é o conteúdo
-- na unidade de uso (ex: farinha R$ 6,00 por pacote de 1000 g).
create table ingredientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_compra numeric(10,2) not null default 0,
  quantidade_embalagem numeric(10,2) not null default 1,
  unidade_uso text not null default 'g' check (unidade_uso in ('g', 'ml', 'un')),
  estoque_atual numeric(12,2) not null default 0,
  estoque_minimo numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============ RECEITAS (ficha técnica) ============
create table receitas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  rendimento_qtd numeric(10,2) not null default 1,
  rendimento_unidade text not null default 'un',
  tempo_preparo_min integer,
  foto_url text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table receita_ingredientes (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid not null references receitas(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id) on delete restrict,
  quantidade numeric(12,2) not null
);

-- ============ CUSTOS FIXOS ============
-- tipo 'fixo': valor em R$ somado ao custo da receita
-- tipo 'percentual': % aplicado sobre o custo dos ingredientes
create table custos_fixos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo custo_tipo not null default 'fixo',
  valor numeric(10,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ PRODUTOS ============
-- Produto vendável: custo vem da receita (ficha técnica) ou de custo_manual.
-- preco_venda é o preço praticado; o sugerido é calculado no app pela margem.
create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  receita_id uuid references receitas(id) on delete set null,
  custo_manual numeric(10,2),
  margem numeric(6,2) not null default 100,
  preco_venda numeric(10,2),
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ CLIENTES ============
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  endereco text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- ============ PEDIDOS ============
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  status pedido_status not null default 'orcamento',
  data_entrega timestamptz,
  sinal numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  forma_pagamento text,
  observacoes text,
  pago boolean not null default false,
  created_at timestamptz not null default now()
);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid references produtos(id) on delete set null,
  descricao text not null,
  quantidade numeric(10,2) not null default 1,
  preco_unitario numeric(10,2) not null default 0
);

-- ============ FINANCEIRO ============
create table movimentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  tipo mov_tipo not null,
  categoria text not null default 'outros',
  valor numeric(10,2) not null,
  data date not null default current_date,
  descricao text,
  pedido_id uuid references pedidos(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ LISTA DE COMPRAS ============
-- Itens manuais; os automáticos (estoque abaixo do mínimo / demanda de
-- pedidos confirmados) são calculados pelo app em tempo real.
create table compras (
  id uuid primary key default gen_random_uuid(),
  ingrediente_id uuid references ingredientes(id) on delete cascade,
  descricao text not null,
  quantidade numeric(12,2),
  comprado boolean not null default false,
  valor numeric(10,2),
  created_at timestamptz not null default now()
);

-- ============ ÍNDICES ============
create index idx_receita_ingredientes_receita on receita_ingredientes(receita_id);
create index idx_pedido_itens_pedido on pedido_itens(pedido_id);
create index idx_pedidos_data_entrega on pedidos(data_entrega);
create index idx_pedidos_status on pedidos(status);
create index idx_movimentos_data on movimentos_financeiros(data);

-- ============ RLS (app de casal: qualquer usuário autenticado acessa tudo) ============
do $$
declare t text;
begin
  foreach t in array array['ingredientes','receitas','receita_ingredientes','custos_fixos','produtos','clientes','pedidos','pedido_itens','movimentos_financeiros','compras']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "autenticados_tudo" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============ SEED: custos fixos iniciais ============
insert into custos_fixos (nome, tipo, valor) values
  ('Gás e energia', 'percentual', 10),
  ('Embalagem', 'fixo', 3),
  ('Mão de obra', 'percentual', 30);

-- ============ STORAGE: bucket de fotos ============
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "fotos_leitura_publica" on storage.objects
  for select using (bucket_id = 'fotos');
create policy "fotos_upload_autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos');
create policy "fotos_update_autenticado" on storage.objects
  for update to authenticated using (bucket_id = 'fotos');
create policy "fotos_delete_autenticado" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos');
