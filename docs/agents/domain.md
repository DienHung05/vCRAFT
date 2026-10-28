# Domain docs

This repository uses a single-context layout.

## Before exploring

Read the root `GLOSSARY.md` if it exists. Read decisions in `docs/adr/`
that apply to the area you are exploring.

If the glossary or ADR directory is absent, proceed silently. Do not
suggest creating them merely because they are missing. The
`domain-modeling` skill creates domain documentation when terms or
decisions are resolved.

## File structure

- `GLOSSARY.md` contains the shared domain vocabulary.
- `docs/adr/` contains architecture decision records.

Apps and packages share this documentation layout.

## Use the glossary's vocabulary

Use glossary terms in issue titles, proposals, hypotheses, and test
names. Avoid synonyms that the glossary explicitly rejects.

If a needed concept is missing, first check whether the project
already uses another term. Record a real vocabulary gap for
`domain-modeling`.

## Report ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain
why the decision should be reconsidered. Do not silently override it.
