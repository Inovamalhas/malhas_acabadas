-- =====================================================
-- v4: AMOSTRAS (cartazes) com stock em metros + ligação artigo -> amostra
-- Para quem já tem a v3 instalada: colar no SQL Editor > Run (uma vez).
-- Não apaga nem altera dados existentes.
-- =====================================================

-- Amostras: uma linha por referência
create table if not exists public.amostras (
  id              uuid primary key default gen_random_uuid(),
  referencia      text not null unique,        -- referência da amostra
  descricao       text not null,               -- nome / descrição do artigo
  composicao      text,                        -- ex.: 95% CO 5% EA
  gramagem        numeric,                     -- g/m2
  largura_cm      numeric,
  ligamento       text,                        -- tipo de malha (jersey, interlock, felpa...)
  acabamento      text,
  cores           text,                        -- cores disponíveis / do cartaz
  preco           numeric,
  preco_unidade   text not null default 'm' check (preco_unidade in ('m','kg')),
  stock_minimo_m  numeric,                     -- alerta de stock baixo
  localizacao     text,                        -- onde está guardada
  fornecedor      text,
  notas           text,
  ativa           boolean not null default true,
  criado_por      uuid default auth.uid() references auth.users(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- Movimentos de stock (metros): entradas positivas, saídas negativas.
-- O stock atual de cada amostra é a soma dos seus movimentos.
create table if not exists public.amostra_movimentos (
  id           uuid primary key default gen_random_uuid(),
  amostra_id   uuid not null references public.amostras(id) on delete cascade,
  data         date not null default current_date,
  metros       numeric not null,
  motivo       text,
  notas        text,
  criado_por   uuid default auth.uid() references auth.users(id),
  criado_em    timestamptz not null default now()
);
create index if not exists amostra_mov_idx on public.amostra_movimentos(amostra_id);

-- Ligação do artigo da encomenda à amostra + características copiadas (editáveis)
alter table public.artigos add column if not exists amostra_id  uuid references public.amostras(id) on delete set null;
alter table public.artigos add column if not exists composicao  text;
alter table public.artigos add column if not exists gramagem    numeric;
alter table public.artigos add column if not exists largura_cm  numeric;
create index if not exists artigos_amostra_idx on public.artigos(amostra_id);

drop trigger if exists trg_amostras_atualizado on public.amostras;
create trigger trg_amostras_atualizado
  before update on public.amostras
  for each row execute function public.set_atualizado_em();

-- Segurança: só utilizadores com login
alter table public.amostras           enable row level security;
alter table public.amostra_movimentos enable row level security;
drop policy if exists "amostras_autenticados" on public.amostras;
create policy "amostras_autenticados" on public.amostras
  for all to authenticated using (true) with check (true);
drop policy if exists "amostra_mov_autenticados" on public.amostra_movimentos;
create policy "amostra_mov_autenticados" on public.amostra_movimentos
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
