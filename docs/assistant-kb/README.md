# Fox assistant knowledge base

Hand-written pages the Fox assistant answers from (ADR-13, GH#79), one file per topic and language
(`<topic>.vi.md`, `<topic>.en.md`). The first `# heading` is the citation title; each topic's citation link
is set in `apps/worker/src/processors/assistant/kb-pages.ts`. Keep them short, factual and about vCraft and
Bát Tràng only; never put private data here. After editing, run `pnpm assistant:reindex`.
