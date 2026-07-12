-- Estoque de produto acabado + produções + notas fiscais importadas

-- Produto acabado agora tem estoque próprio (alimentado pela produção)
alter table produtos add column estoque_atual numeric(12,2) not null default 0;

-- Histórico de produções: baixa ingredientes e credita produto acabado
create table producoes (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid references receitas(id) on delete set null,
  produto_id uuid references produtos(id) on delete set null,
  multiplicador numeric(10,2) not null default 1,
  quantidade_produzida numeric(12,2) not null default 0,
  observacoes text,
  created_at timestamptz not null default now()
);

-- Notas NFC-e importadas via QR code (chave única evita importação duplicada)
create table notas_importadas (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  emitente text,
  valor_total numeric(10,2),
  data_emissao date,
  itens_importados integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['producoes','notas_importadas']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "autenticados_tudo" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
