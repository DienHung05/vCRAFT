import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface TrackedRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Global limiter that counts a signed-in caller by its bearer token and everyone else by IP. Server-side
 * renders on Vercel reach the API from a few shared addresses, so an IP-only bucket would lump every
 * signed-in visitor together and throttle the demo itself. The token is hashed so it never sits in the
 * limiter's storage; a forged token only gets its own bucket and is then rejected by the `AuthGuard`.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: TrackedRequest): Promise<string> {
    return trackerOf(request);
  }
}

export function trackerOf(request: TrackedRequest): string {
  const header = request.headers?.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  if (authorization?.startsWith('Bearer ')) {
    const digest = createHash('sha256').update(authorization.slice(7)).digest('hex');
    return `token:${digest.slice(0, 32)}`;
  }
  return `ip:${request.ip ?? 'unknown'}`;
}
