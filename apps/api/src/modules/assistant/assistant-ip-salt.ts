import { createHash, randomBytes } from 'node:crypto';

/**
 * The salt that hashes visitor IPs for rate limits and logs (FR-AST-08). It has to be the same on every
 * instance and across restarts, or a per-IP limit multiplies with the instance count and resets on deploy.
 *
 * `ASSISTANT_IP_SALT` is the intended source. A production deploy that has not set it yet must not stop
 * starting, so it derives a stable salt from another server-only secret (`SUPABASE_SECRET_KEY`) and warns;
 * only when no such secret exists either does it fall back to a random per-process salt. Dev and test use a
 * random salt per process, with a warning.
 */
export function resolveIpSalt(
  env: Record<string, string | undefined>,
  warn: (message: string) => void = () => undefined,
): string {
  const configured = env.ASSISTANT_IP_SALT?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === 'production') {
    const secret = env.SUPABASE_SECRET_KEY?.trim();
    if (secret) {
      warn(
        'ASSISTANT_IP_SALT is not set: deriving the IP salt from SUPABASE_SECRET_KEY. Set ASSISTANT_IP_SALT to a long random secret.',
      );
      return createHash('sha256').update(`vcraft-assistant-ip-salt:${secret}`).digest('hex');
    }
    warn(
      'ASSISTANT_IP_SALT is not set and no server secret is available: per-IP limits reset on every restart.',
    );
    return randomBytes(32).toString('hex');
  }
  warn(
    'ASSISTANT_IP_SALT is not set: using a random salt for this process only, so hashed IPs change on every restart.',
  );
  return randomBytes(32).toString('hex');
}
