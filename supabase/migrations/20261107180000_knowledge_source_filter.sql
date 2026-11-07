-- GH#227: select FAQ sources before ranking and limiting so catalog chunks cannot displace guides.
-- Keep the existing RPC for older API versions and unfiltered catalog retrieval.
create or replace function public.match_knowledge_by_source(
  query_embedding extensions.vector(1024),
  match_count int default 6,
  filter_locale text default null,
  min_similarity float default 0,
  filter_source_type text default null
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
    and (filter_source_type is null or k.source_type = filter_source_type)
    and 1 - (k.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by k.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke execute on function public.match_knowledge_by_source(extensions.vector, int, text, float, text)
  from public, anon, authenticated;
grant execute on function public.match_knowledge_by_source(extensions.vector, int, text, float, text)
  to service_role;
