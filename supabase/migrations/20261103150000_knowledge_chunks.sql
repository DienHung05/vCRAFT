-- ADR-13 / ADR-19 (GH#79): the Fox assistant's knowledge index on Supabase Postgres with pgvector, kept
-- apart from the business database. Derived data: `pnpm assistant:reindex` rebuilds it from public content.
-- Only the backend (secret key, which bypasses RLS) reads or writes it; anon and authenticated get nothing.

create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('FAQ', 'PRODUCT', 'HOUSEHOLD', 'NEWS')),
  source_id text not null,
  locale text not null check (locale in ('vi', 'en')),
  chunk_index int not null check (chunk_index >= 0),
  url text not null,
  title text not null,
  -- Only public content is indexed (BR-02); the column keeps that explicit for the match filter.
  visibility text not null default 'PUBLIC' check (visibility = 'PUBLIC'),
  content text not null,
  embedding extensions.vector(1024) not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, locale, chunk_index)
);

create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks (source_type, source_id);

-- Approximate nearest neighbour search by cosine distance.
create index if not exists knowledge_chunks_embedding_hnsw
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;
-- No policy on purpose: with RLS on and no policy, anon and authenticated see and change nothing.
revoke all on table public.knowledge_chunks from anon, authenticated;

-- Nearest chunks to a query embedding, optionally in one locale, above a similarity floor.
create or replace function public.match_knowledge(
  query_embedding extensions.vector(1024),
  match_count int default 6,
  filter_locale text default null,
  min_similarity float default 0
)
returns table (
  source_type text,
  source_id text,
  url text,
  title text,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    k.source_type,
    k.source_id,
    k.url,
    k.title,
    k.content,
    1 - (k.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.knowledge_chunks k
  where k.visibility = 'PUBLIC'
    and (filter_locale is null or k.locale = filter_locale)
    and 1 - (k.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by k.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke execute on function public.match_knowledge(extensions.vector, int, text, float) from public, anon, authenticated;
grant execute on function public.match_knowledge(extensions.vector, int, text, float) to service_role;
