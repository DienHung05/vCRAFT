import type { Type } from '@nestjs/common';
import { HTTP_CODE_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ProblemDetailsSchema } from '@vcraft/contracts';
import { z } from 'zod';
import { type RouteEntry, routeInventory } from '../auth/route-inventory';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/** A JSON Schema fragment as `z.toJSONSchema` emits it (draft 2020-12, which OpenAPI 3.1 adopts). */
type JsonSchema = Record<string, unknown>;

export interface OpenApiInfo {
  title: string;
  version: string;
  description: string;
}

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: OpenApiInfo;
  servers: { url: string }[];
  tags: { name: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, JsonSchema>;
  };
}

const PROBLEM_REF = '#/components/schemas/ProblemDetails';

/** `z.toJSONSchema` without the `$schema` marker; anything Zod cannot express (transforms, dates) becomes `{}`. */
function toJsonSchema(schema: z.ZodType): JsonSchema {
  try {
    const { $schema: _marker, ...rest } = z.toJSONSchema(schema, {
      io: 'input',
      unrepresentable: 'any',
    }) as JsonSchema;
    return rest;
  } catch {
    return {};
  }
}

/** Zod schemas that validate this handler's `@Body()` and `@Query()` arguments, via `ZodValidationPipe`. */
function validationSchemas(controller: Type<unknown>, methodName: string) {
  const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, methodName) ?? {}) as Record<
    string,
    { pipes?: unknown[] }
  >;
  const found: { body?: z.ZodType; query?: z.ZodType } = {};
  for (const [key, arg] of Object.entries(args)) {
    const pipe = arg.pipes?.find((p) => p instanceof ZodValidationPipe) as
      | ZodValidationPipe<z.ZodType>
      | undefined;
    if (!pipe) continue;
    const type = Number(key.split(':')[0]);
    if (type === RouteParamtypes.BODY) found.body = pipe.schema;
    if (type === RouteParamtypes.QUERY) found.query = pipe.schema;
  }
  return found;
}

/** An object schema's properties as OpenAPI query parameters. */
function queryParameters(schema: z.ZodType): unknown[] {
  const json = toJsonSchema(schema);
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((json.required ?? []) as string[]);
  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: propertySchema,
  }));
}

function successStatus(route: RouteEntry): string {
  const declared = Reflect.getMetadata(
    HTTP_CODE_METADATA,
    (route.controller.prototype as Record<string, object>)[route.methodName] as object,
  ) as number | undefined;
  return String(declared ?? (route.method === 'POST' ? 201 : 200));
}

const problemResponse = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: { $ref: PROBLEM_REF } } },
});

function operation(route: RouteEntry) {
  const { body, query } = validationSchemas(route.controller, route.methodName);
  const pathParameters = [...route.path.matchAll(/:(\w+)/g)].map(([, name]) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
  const parameters = [...pathParameters, ...(query ? queryParameters(query) : [])];
  const secured = route.policy.kind !== 'PUBLIC';
  const roles = route.policy.kind === 'ROLES' ? [...route.policy.roles].sort() : [];
  const tag = route.path.split('/')[3] ?? 'api';

  return {
    operationId: `${route.controller.name}_${route.methodName}`,
    tags: [tag],
    ...(roles.length > 0 && { description: `Restricted to the roles: ${roles.join(', ')}.` }),
    ...(parameters.length > 0 && { parameters }),
    ...(body && {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: toJsonSchema(body) } },
      },
    }),
    // A public route still honours a valid token (see `@Public()`), so the scheme is optional there.
    security: secured ? [{ bearerAuth: [] }] : [{}, { bearerAuth: [] }],
    responses: {
      [successStatus(route)]: { description: 'Success' },
      ...(secured && { '401': problemResponse('Missing or invalid access token') }),
      ...(roles.length > 0 && {
        '403': problemResponse('The account role may not call this route'),
      }),
      default: problemResponse('Problem Details (RFC 9457)'),
    },
  };
}

/**
 * OpenAPI 3.1 document of the whole API (SRS 5.2, ARCHITECTURE §4.2), built from the same decorator metadata
 * the route policy test reads plus the Zod schemas of `@vcraft/contracts` that validate each handler's body
 * and query. No database or running app is needed. Paths are relative to `servers[0]`, the `api/v1` prefix.
 */
export function buildOpenApiDocument(
  root: Type<unknown>,
  info: OpenApiInfo,
  prefix = 'api/v1',
): OpenApiDocument {
  const base = `/${prefix}`;
  const paths: OpenApiDocument['paths'] = {};
  const tags = new Set<string>();
  for (const route of routeInventory(root, prefix)) {
    const path = route.path.slice(base.length).replace(/:(\w+)/g, '{$1}') || '/';
    const op = operation(route);
    for (const tag of op.tags) tags.add(tag);
    const item = paths[path] ?? {};
    item[route.method.toLowerCase()] = op;
    paths[path] = item;
  }
  return {
    openapi: '3.1.0',
    info,
    servers: [{ url: base }],
    tags: [...tags].sort().map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase access token, sent as `Authorization: Bearer <token>`.',
        },
      },
      schemas: { ProblemDetails: toJsonSchema(ProblemDetailsSchema) },
    },
  };
}
