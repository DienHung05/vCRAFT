# Fox assistant knowledge base

Hand-written pages the Fox assistant answers from (ADR-13, GH#79), one file per topic and language
(`<topic>.vi.md`, `<topic>.en.md`). The first `# heading` is the citation title; each topic's citation link
is set in `KB_PAGES` in `apps/worker/src/processors/assistant/ingest.ts`. Keep them short, factual and about
vCraft and Bát Tràng only; never put private data here. Internal paths are written out in the text
(`/vi/...`, `/en/...`) so the model can quote the right link per language. After editing, run
`pnpm assistant:reindex`.

Before deployment, apply the Supabase knowledge-index migrations, including
`20261107180000_knowledge_source_filter.sql`. The API uses its `match_knowledge_by_source` RPC to
select FAQ sources before ranking and limiting matches for site-help questions. The existing
`match_knowledge` RPC remains available for older API versions and general retrieval.

Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `OPENAI_API_KEY` before rebuilding the persistent
index. Confirm the command reports `SupabaseVectorStore` and `OpenAiEmbedder`. A missing
`knowledge_chunks` table means the knowledge-index migration has not been applied. `HashingEmbedder`
is only for local checks; do not use its vectors as a replacement for the production OpenAI index.
Local ingestion and retrieval can use `InMemoryVectorStore` without changing the remote index.

Topics: user-guide (overview and site map), accounts, browsing (retail), ordering (retail), quotation
(bulk), order-statuses, studio (household), admin, household-registration, qr-traceability, bat-trang, faq.

