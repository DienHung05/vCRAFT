import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { routeInventory } from '../auth/route-inventory';
import { buildOpenApiDocument } from './openapi-document';

const INFO = { title: 'vCraft API', version: '1.0.0', description: 'test' };
const doc = buildOpenApiDocument(AppModule, INFO);
interface Operation {
  operationId: string;
  description?: string;
  parameters?: { name: string; in: string; required: boolean; schema: unknown }[];
  requestBody?: { content: Record<string, { schema: Record<string, unknown> }> };
  security: Record<string, unknown>[];
  responses: Record<string, unknown>;
}
const operations = Object.entries(doc.paths).flatMap(([path, item]) =>
  Object.entries(item).map(([method, op]) => ({ path, method, op: op as Operation })),
);
const operationAt = (path: string, method: string) => doc.paths[path]?.[method] as Operation;

describe('OpenAPI document', () => {
  it('is an OpenAPI 3.1 document served relative to the api/v1 prefix', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers).toEqual([{ url: '/api/v1' }]);
    expect(doc.info).toEqual(INFO);
  });

  it('describes every route of the API exactly once', () => {
    const routes = routeInventory(AppModule);
    expect(operations).toHaveLength(routes.length);
    expect(new Set(operations.map((o) => o.op.operationId)).size).toBe(routes.length);
  });

  it('writes path parameters in OpenAPI form and declares each one', () => {
    expect(Object.keys(doc.paths).some((path) => path.includes(':'))).toBe(false);
    const product = operationAt('/products/{slug}', 'get');
    expect(product.parameters).toEqual([
      { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
    ]);
  });

  it('turns the Zod query schema of a handler into query parameters', () => {
    const list = operationAt('/products', 'get');
    const query = (list.parameters ?? []).filter((p) => p.in === 'query');
    expect(query.length).toBeGreaterThan(0);
    for (const parameter of query) {
      expect(parameter).toMatchObject({ name: expect.any(String), required: expect.any(Boolean) });
    }
  });

  it('turns the Zod body schema of a handler into a JSON request body', () => {
    const signIn = operationAt('/auth/sign-in', 'post');
    const schema = signIn.requestBody?.content['application/json']?.schema ?? {};
    expect(schema.type).toBe('object');
    expect(schema.$schema).toBeUndefined();
    expect(Object.keys((schema.properties ?? {}) as object).length).toBeGreaterThan(0);
  });

  it('marks public routes as optionally authenticated and all others as bearer protected', () => {
    const health = operationAt('/health', 'get');
    expect(health.security).toEqual([{}, { bearerAuth: [] }]);
    const guarded = operations.filter((o) => o.op.security[0]?.bearerAuth);
    expect(guarded.length).toBeGreaterThan(0);
    for (const { op } of guarded) expect(op.responses['401']).toBeDefined();
  });

  it('names the roles allowed on a restricted route and documents its 403', () => {
    const admin = operations.find((o) => o.path.startsWith('/admin'));
    expect(admin?.op.description).toContain('ADMIN');
    expect(admin?.op.responses['403']).toBeDefined();
  });

  it('documents a success status for every route', () => {
    for (const { path, method, op } of operations) {
      const statuses = Object.keys(op.responses).filter((code) => /^2\d\d$/.test(code));
      expect(statuses, `${method} ${path}`).toHaveLength(1);
    }
  });

  it('shares one Problem Details schema for errors', () => {
    expect(doc.components.schemas.ProblemDetails).toMatchObject({ type: 'object' });
    expect(JSON.stringify(doc)).toContain('#/components/schemas/ProblemDetails');
  });

  it('serialises to JSON', () => {
    expect(() => JSON.stringify(doc)).not.toThrow();
  });
});
