# ADR-19 — The Fox assistant runs on OpenAI and is back in scope

- Status: **Accepted** (3 Nov 2026)
- Amends: [ADR-13](0013-assistant-vector-store-supabase.md) (the model and embedding provider only; the vector store decision stands)
- Reverses: the deferral of the assistant in decisions `vCRAFT-9hg.1` and `vCRAFT-9hg.7` (no assistant module, no Claude/Voyage at runtime, no weather tool)
- Related: FR-AST-01 … 08 ([SRS §3.13](../requirements/SRS.md#313-trợ-lý-cáo-chatbot--fr-ast)), [ARCHITECTURE §7.6](../ARCHITECTURE.md#76-trợ-lý-cáo-rag--guardrail), epic E15 in [PLAN](../PLAN.md), GitHub #76

## Context

The first release deferred the Fox assistant (E15) to keep the scope small: `vCRAFT-9hg.1` cut the assistant module, and `vCRAFT-9hg.7` removed Claude and Voyage AI from the runtime along with the weather tool. The assistant is now back in scope for release 2. The team already holds an OpenAI API key in `.env`, so using it for both the chat model and the embeddings avoids a second paid provider and a second key to manage.

## Decision

1. **Chat model:** OpenAI, model set by `OPENAI_CHAT_MODEL` (currently `gpt-6-luna`). It answers, and it classifies intent and injection in the guardrail pipeline, behind the `LlmClient` port (`OpenAiAdapter`, plus a fake for tests).
2. **Embeddings:** OpenAI `OPENAI_EMBEDDING_MODEL` (currently `text-embedding-3-large`) at `OPENAI_EMBEDDING_DIMENSIONS` = **1024** dimensions, which matches `knowledge_chunks.embedding vector(1024)`. The model supports Vietnamese and English in one space, so an English question finds Vietnamese content.
3. **Vector store:** unchanged from ADR-13: pgvector on the Supabase project, separate from the business database, reached only through the `VectorStore` port.
4. `ANTHROPIC_API_KEY` is no longer used by the assistant. It stays optional for the story-writing and translation suggestions (FR-ART-08, Could).
5. The deferral is reversed: E15 (#77–#82) is planned for release 2, with the guardrails of ARCHITECTURE §7.6 unchanged.

## Options considered

| Option | Why not |
|---|---|
| Keep Claude (Haiku) for chat and Voyage AI for embeddings | Two more paid accounts and keys; the team already pays for OpenAI |
| Claude for chat, OpenAI for embeddings | Two providers to monitor and budget for one feature |
| A self-hosted open model | No GPU budget; latency on the free hosting plans would miss the first-token target (NFR-PERF-08) |

## Consequences

- One provider, one key (`OPENAI_API_KEY`) for the assistant; the daily token budget guard and the rate limiter are opt-in (`ASSISTANT_DAILY_TOKENS`, `ASSISTANT_RATE_LIMIT_PER_MINUTE`, `ASSISTANT_RATE_LIMIT_PER_DAY`) and off by default (#200), so watch the OpenAI spend by hand until one is set.
- Changing `OPENAI_EMBEDDING_DIMENSIONS` means a migration of the vector column and a full `pnpm assistant:reindex`. The value stays 1024 while the column is `vector(1024)`.
- Model names live in environment variables, so a model can be swapped without code changes, but the red-team suite (#82) must be re-run after any swap.
- The docs that named Claude Haiku and Voyage AI for the assistant (PLAN E15, SRS §3.13/§4, ARCHITECTURE §7.6) now name OpenAI.
