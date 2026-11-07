import { z } from 'zod';

const SessionSchema = z.object({ access_token: z.string(), refresh_token: z.string() });

/** Password authentication stays on the API so a username never reveals an email. */
async function request(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const problem = z.object({ code: z.string().optional() }).safeParse(data);
    throw Object.assign(new Error('Authentication request failed'), {
      code: problem.success ? problem.data.code : undefined,
      status: response.status,
    });
  }
  return data;
}

export async function signIn(body: {
  identifier: string;
  password: string;
  captchaToken?: string;
}) {
  try {
    const session = SessionSchema.parse(await request('sign-in', body));
    return { error: null, session } as const;
  } catch (error) {
    return { error, session: null } as const;
  }
}

export async function signUp(body: {
  username: string;
  email: string;
  password: string;
  captchaToken?: string;
  locale: string;
  privacyPolicyVersion: string;
  householdIntent?: boolean;
  next?: string;
}) {
  await request('sign-up', body);
}

export async function usernameAvailable(username: string, signal: AbortSignal): Promise<boolean> {
  const response = await fetch(
    `/api/v1/auth/username-availability?username=${encodeURIComponent(username)}`,
    {
      cache: 'no-store',
      signal,
    },
  );
  if (!response.ok) throw new Error('Username availability unavailable');
  return z.object({ available: z.boolean() }).parse(await response.json()).available;
}
