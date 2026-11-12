export const DEMO_EMAILS: readonly string[];
export const DEMO_ADMIN_EMAIL: string;
export class DemoSessionError extends Error {}
export function base32Decode(input: string): Buffer;
export function totpStep(nowMs: number, period?: number): number;
export function totp(
  secretBase32: string,
  options?: { nowMs?: number; period?: number; digits?: number },
): string;
export function canMintSession(env?: Record<string, string | undefined>): boolean;
export interface DemoSessionResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: unknown;
}
export function mintDemoSession(options: {
  email: string;
  supabaseUrl?: string;
  publishableKey?: string;
  secretKey?: string;
  totpSecret?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<DemoSessionResult>;
export function mintDemoSessionFromEnv(
  email: string,
  overrides?: Record<string, unknown>,
): Promise<DemoSessionResult>;
