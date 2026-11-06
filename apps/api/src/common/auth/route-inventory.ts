import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { AccountRole } from '@vcraft/domain';
import { PUBLIC_KEY, ROLES_KEY } from './auth.guard';

/** Who may call a route, as the global `AuthGuard` decides it. */
export type RoutePolicy =
  | { kind: 'PUBLIC' }
  | { kind: 'ROLES'; roles: readonly AccountRole[] }
  /** No `@Public()` or `@Roles()`: any signed-in account. */
  | { kind: 'AUTHENTICATED' };

export interface RouteEntry {
  method: string;
  /** Full path under the global prefix, with Nest `:param` placeholders. */
  path: string;
  policy: RoutePolicy;
  handler: string;
}

const join = (...parts: string[]) =>
  `/${parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/')}`;

function asArray(value: unknown): string[] {
  if (value === undefined) return [''];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/** Controllers reachable from a root module through `imports`, each once. */
function controllersOf(root: Type<unknown>): Type<unknown>[] {
  const seen = new Set<unknown>();
  const controllers: Type<unknown>[] = [];
  const visit = (module: unknown) => {
    if (!module || seen.has(module)) return;
    seen.add(module);
    const target = (module as { module?: unknown }).module ?? module;
    for (const c of Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, target as object) ?? [])
      controllers.push(c);
    for (const imported of Reflect.getMetadata(MODULE_METADATA.IMPORTS, target as object) ?? [])
      visit(imported);
  };
  visit(root);
  return controllers;
}

/** The handler's policy, method-level metadata first, like `Reflector.getAllAndOverride`. */
function policyOf(controller: Type<unknown>, handler: object): RoutePolicy {
  const isPublic =
    Reflect.getMetadata(PUBLIC_KEY, handler) ?? Reflect.getMetadata(PUBLIC_KEY, controller);
  if (isPublic) return { kind: 'PUBLIC' };
  const roles =
    Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, controller);
  return roles ? { kind: 'ROLES', roles } : { kind: 'AUTHENTICATED' };
}

/**
 * Every HTTP route the API exposes, read from decorator metadata without starting the app (no database
 * needed), with the auth policy the global guard applies (ARCHITECTURE §8.2, PLAN E14).
 */
export function routeInventory(root: Type<unknown>, prefix = 'api/v1'): RouteEntry[] {
  const routes: RouteEntry[] = [];
  for (const controller of controllersOf(root)) {
    const bases = asArray(Reflect.getMetadata(PATH_METADATA, controller));
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;
      for (const base of bases)
        for (const sub of asArray(Reflect.getMetadata(PATH_METADATA, handler)))
          routes.push({
            method: RequestMethod[method],
            path: join(prefix, base, sub),
            policy: policyOf(controller, handler),
            handler: `${controller.name}.${name}`,
          });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
