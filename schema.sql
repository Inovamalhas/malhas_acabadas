-- =====================================================
-- Malhas Acabadas - esquema da base de dados (Supabase)
-- Colar no Supabase: SQL Editor > New query > Run
-- =====================================================

create table if not exists public.encomendas (
  id                        uuid primary key default gen_random_uuid(),
  referencia                text not null,            -- nº da encomenda / ordem
  cliente                   text not null,
  artigo                    text not null,            -- descrição da malha
  cor                       text,
  quantidade_kg             numeric,

  origem_malha              text not null default 'interna'
                              check (origem_malha in ('interna','subcontratada')),
  malharia                  text,                     -- nome do subcontratado (se aplicável)
  tinturaria                text,
  tem_estamparia            boolean not null default false,
  estamparia                text,

  estado                    text not null default 'producao'
                              check (estado in ('producao','tinturaria','estamparia','entrega','concluida')),

  data_pedida_cliente       date,   -- data que o cliente quer a malha
  data_prev_fim_malha       date,   -- previsão fim da produção da malha
  data_prev_envio_tinturaria date,  -- previsão envio para a tinturaria
  data_prev_entrega_cliente date,   -- previsão entrega ao cliente

  notas                     text,
  criado_por                uuid default auth.uid() references auth.users(id),
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now()
);

-- Se a tabela já existia (versão anterior), isto acrescenta a coluna nova:
alter table public.encomendas add column if not exists data_pedida_cliente date;

create table if not exists public.guias (
  id             uuid primary key default gen_random_uuid(),
  encomenda_id   uuid not null references public.encomendas(id) on delete cascade,
  tipo           text not null default 'transporte' check (tipo in ('transporte','remessa')),
  destino        text not null default 'tinturaria' check (destino in ('tinturaria','estamparia','cliente','outro')),
  numero         text not null,
  data           date not null default current_date,
  origem_local   text,
  quantidade_kg  numeric,
  notas          text,
  criado_por     uuid default auth.uid() references auth.users(id),
  criado_em      timestamptz not null default now()
);

create index if not exists guias_encomenda_idx on public.guias(encomenda_id);
create index if not exists encomendas_estado_idx on public.encomendas(estado);

-- atualizar "atualizado_em" automaticamente
create or replace function public.set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_encomendas_atualizado on public.encomendas;
create trigger trg_encomendas_atualizado
  before update on public.encomendas
  for each row execute function public.set_atualizado_em();

-- =====================================================
-- SEGURANÇA: só utilizadores com login têm acesso
-- =====================================================
alter table public.encomendas enable row level security;
alter table public.guias      enable row level security;

drop policy if exists "encomendas_autenticados" on public.encomendas;
create policy "encomendas_autenticados" on public.encomendas
  for all to authenticated using (true) with check (true);

drop policy if exists "guias_autenticados" on public.guias;
create policy "guias_autenticados" on public.guias
  for all to authenticated using (true) with check (true);

-- (utilizadores anónimos não têm nenhuma policy => não veem nada)
