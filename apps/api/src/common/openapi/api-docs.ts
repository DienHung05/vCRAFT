import { randomBytes } from 'node:crypto';
import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { apiReference } from '@scalar/nestjs-api-reference';
import { buildOpenApiDocument, type OpenApiInfo } from './openapi-document';

/** Interactive documentation page (SRS 5.2). Outside the `api/v1` prefix, so it never needs a token. */
export const DOCS_PATH = '/api/docs';
/** The OpenAPI 3.1 document behind the page; `/api/openapi.json` is an alias for tools that look there. */
export const DOCS_JSON_PATHS = ['/api/docs-json', '/api/openapi.json'] as const;

const SCALAR_CDN = 'https://cdn.jsdelivr.net';
const SCALAR_FONTS = 'https://fonts.scalar.com';

const INFO: OpenApiInfo = {
  title: 'vCraft API',
  version: '1.0.0',
  description:
    'REST JSON API of vCraft, the Bát Tràng ceramics marketplace. Errors follow RFC 9457 Problem Details. ' +
    'Routes marked with a lock need a Supabase access token; public routes also honour one.',
};

/**
 * CSP of the docs page alone. It replaces the global helmet policy, which blocks the CDN script, and ties
 * every inline script and style Scalar renders to a fresh nonce (NFR-SEC-04). Scalar writes `style=""`
 * attributes at runtime, which a nonce cannot cover, hence `'unsafe-inline'` for styles only.
 */
export function docsContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${SCALAR_CDN}`,
    `style-src 'self' 'unsafe-inline' ${SCALAR_CDN} ${SCALAR_FONTS}`,
    `font-src 'self' data: ${SCALAR_CDN} ${SCALAR_FONTS}`,
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** The slice of Fastify's reply that these two handlers use. */
interface DocsReply {
  header(name: string, value: string): DocsReply;
  type(contentType: string): DocsReply;
  send(body: unknown): unknown;
}

/**
 * Serves the OpenAPI document and the interactive page (SRS 5.2, ARCHITECTURE §4.2) as plain Fastify routes:
 * they sit outside the Nest controllers and the global prefix, so the `AuthGuard` never sees them and the
 * route policy inventory is unchanged. Read-only and public by design; the document describes routes, it
 * exposes no data.
 */
export function registerApiDocs(app: NestFastifyApplication, root: Type<unknown>): void {
  const http = app.getHttpAdapter();
  let document: ReturnType<typeof buildOpenApiDocument> | undefined;
  const getDocument = () => {
    document ??= buildOpenApiDocument(root, INFO);
    return document;
  };

  for (const path of DOCS_JSON_PATHS) {
    http.get(path, (_req: unknown, reply: DocsReply) =>
      reply
        .header('cache-control', 'public, max-age=300')
        .type('application/json; charset=utf-8')
        .send(getDocument()),
    );
  }

  http.get(DOCS_PATH, (req: unknown, reply: DocsReply) => {
    const nonce = randomBytes(16).toString('base64');
    const render = apiReference({
      url: DOCS_JSON_PATHS[0],
      pageTitle: INFO.title,
      nonce,
      // Requests from "Try it" go to this origin; there is no Scalar proxy in between.
      proxyUrl: '',
    }) as (req: unknown, res: { send(body: unknown): unknown }) => void;
    reply
      .header('content-security-policy', docsContentSecurityPolicy(nonce))
      .header('cache-control', 'no-store')
      .type('text/html; charset=utf-8');
    render(req, reply);
  });
}
