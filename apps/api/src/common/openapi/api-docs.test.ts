import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { DOCS_JSON_PATHS, DOCS_PATH, docsContentSecurityPolicy, registerApiDocs } from './api-docs';

type Handler = (req: unknown, reply: FakeReply) => unknown;

class FakeReply {
  headers: Record<string, string> = {};
  contentType = '';
  body: unknown;
  header(name: string, value: string) {
    this.headers[name] = value;
    return this;
  }
  type(value: string) {
    this.contentType = value;
    return this;
  }
  send(body: unknown) {
    this.body = body;
    return this;
  }
}

function mount() {
  const handlers = new Map<string, Handler>();
  const app = {
    getHttpAdapter: () => ({
      get: (path: string, handler: Handler) => handlers.set(path, handler),
    }),
  } as unknown as NestFastifyApplication;
  registerApiDocs(app, AppModule);
  return handlers;
}

function call(handlers: Map<string, Handler>, path: string) {
  const reply = new FakeReply();
  handlers.get(path)?.({}, reply);
  return reply;
}

describe('API docs routes', () => {
  const handlers = mount();

  it('serves the OpenAPI document as JSON on every documented path', () => {
    for (const path of DOCS_JSON_PATHS) {
      const reply = call(handlers, path);
      expect(reply.contentType).toContain('application/json');
      expect(reply.body).toMatchObject({ openapi: '3.1.0', info: { title: 'vCraft API' } });
    }
  });

  it('serves the interactive page at /api/docs with a nonce that matches its CSP', () => {
    const reply = call(handlers, DOCS_PATH);
    expect(reply.contentType).toContain('text/html');
    const html = String(reply.body);
    const nonce = /<script[^>]*nonce="([^"]+)"/.exec(html)?.[1];
    expect(nonce).toBeTruthy();
    expect(reply.headers['content-security-policy']).toContain(`'nonce-${nonce}'`);
    expect(html).toContain('/api/docs-json');
  });

  it('uses a different nonce for every page view', () => {
    const nonceOf = (reply: FakeReply) => /nonce="([^"]+)"/.exec(String(reply.body))?.[1];
    expect(nonceOf(call(handlers, DOCS_PATH))).not.toBe(nonceOf(call(handlers, DOCS_PATH)));
  });
});

describe('docsContentSecurityPolicy', () => {
  it('allows scripts only with the nonce or from the Scalar CDN, never inline', () => {
    const csp = docsContentSecurityPolicy('abc');
    const scripts = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scripts).toBe("script-src 'nonce-abc' https://cdn.jsdelivr.net");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'none'");
  });
});
