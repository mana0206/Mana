-- Auditoria UI/UX: histórico de ajustes de estoque (correção #4 / melhoria)

create table ajustes_estoque (
  id uuid primary key default gen_random_uuid(),
  ingrediente_id uuid references ingredientes(id) on delete cascade,
  produto_id uuid references produtos(id) on delete cascade,
  estoque_anterior numeric(12,2) not null,
  estoque_novo numeric(12,2) not null,
  motivo text,
  created_at timestamptz not null default now(),
  constraint ajustes_estoque_alvo check (
    (ingrediente_id is not null and produto_id is null) or
    (ingrediente_id is null and produto_id is not null)
  )
);

alter table ajustes_estoque enable row level security;
create policy "autenticados_tudo" on ajustes_estoque for all to authenticated using (true) with check (true);
