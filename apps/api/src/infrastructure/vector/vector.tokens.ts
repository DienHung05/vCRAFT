/**
 * DI tokens of the vector layer, in their own file: `vector.module.ts` imports
 * `KnowledgeBootstrapService`, which injects these tokens, so defining them in the module file
 * would be a circular import and the tokens would be `undefined` at decoration time.
 */

/** DI token of the assistant's knowledge index (`VectorStore` port, ADR-13). */
export const VECTOR_STORE = Symbol('VECTOR_STORE');
/** DI token of the embedder that turns questions into query vectors (ADR-19). */
export const EMBEDDER = Symbol('EMBEDDER');
