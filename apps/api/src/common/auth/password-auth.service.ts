import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { LockMode, MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import {
  type PasswordSignInRequest,
  type PasswordSignUpRequest,
  UsernameSchema,
} from '@vcraft/contracts';
import { AppUser, ConsentRecord } from '@vcraft/database';
import { isCurrentPolicyVersion, isReservedUsername } from '@vcraft/domain';
import { AppError } from '../errors/app-error';
import { PasswordIdentityProvider } from './password-identity-provider';

class ExistingEmail extends Error {}

@Injectable()
export class PasswordAuthService {
  constructor(
    private readonly orm: MikroORM,
    private readonly identities: PasswordIdentityProvider,
  ) {}

  async signIn(body: PasswordSignInRequest) {
    const started = performance.now();
    const identifier = body.identifier.toLowerCase();
    const em = this.orm.em.fork();
    const user = await em.findOne(
      AppUser,
      identifier.includes('@') ? { email: identifier } : { username: identifier },
    );
    const unknown = !identifier.includes('@') && !user;
    const email = identifier.includes('@')
      ? identifier
      : (user?.email ?? `${randomUUID()}@invalid.example`);
    try {
      const session = await this.identities.signIn({
        email,
        password: unknown ? randomUUID() : body.password,
        ...(body.captchaToken && { captchaToken: body.captchaToken }),
      });
      if (!session || unknown || user?.status === 'DELETED')
        throw new AppError('AUTH_INVALID_CREDENTIALS');
      return session;
    } catch (error) {
      // The provider aborts after 10 seconds. Every failure is released after that bound, so a slow
      // upstream password hash cannot distinguish an existing username from a missing one.
      await delay(Math.max(0, 11_000 + randomInt(100) - (performance.now() - started)));
      throw error;
    }
  }

  async availability(raw: string) {
    const parsed = UsernameSchema.safeParse(raw);
    if (!parsed.success || isReservedUsername(parsed.data)) return { available: false };
    const existing = await this.orm.em.fork().findOne(AppUser, { username: parsed.data });
    return { available: existing === null };
  }

  async signUp(body: PasswordSignUpRequest) {
    this.assertPublicUsername(body.username);
    if (!isCurrentPolicyVersion(body.privacyPolicyVersion)) throw new AppError('CONSENT_REQUIRED');
    try {
      await this.orm.em.fork().transactional(async (em) => {
        if (await em.findOne(AppUser, { email: body.email })) throw new ExistingEmail();
        if (await em.findOne(AppUser, { username: body.username }))
          throw new AppError('USERNAME_TAKEN');
        // Flush a temporary row before the external call. The unique index serializes competing sign-ups.
        const reservation = em.create(AppUser, {
          id: randomUUID(),
          email: body.email,
          username: body.username,
          role: 'BUYER',
        });
        await em.flush();
        const identity = await this.identities.signUp(body);
        if (!identity) throw new ExistingEmail();
        em.remove(reservation);
        await em.flush();
        em.create(AppUser, {
          id: identity.id,
          email: identity.email.toLowerCase(),
          username: body.username,
          role: 'BUYER',
        });
        em.create(ConsentRecord, {
          userId: identity.id,
          purpose: 'SIGN_UP',
          policyVersion: body.privacyPolicyVersion,
        });
        await em.flush();
      });
    } catch (error) {
      if (error instanceof ExistingEmail) return { ok: true };
      if (error instanceof UniqueConstraintViolationException) {
        // A concurrent registration of the same email keeps the generic check-email response.
        if (await this.orm.em.fork().findOne(AppUser, { email: body.email })) return { ok: true };
        throw new AppError('USERNAME_TAKEN');
      }
      throw error;
    }
    return { ok: true };
  }

  async chooseUsername(userId: string, username: string) {
    this.assertPublicUsername(username);
    try {
      await this.orm.em.fork().transactional(async (em) => {
        const user = await em.findOneOrFail(AppUser, userId, {
          lockMode: LockMode.PESSIMISTIC_WRITE,
        });
        if (user.username && user.username !== username) throw new AppError('AUTH_FORBIDDEN');
        if (await em.findOne(AppUser, { username, id: { $ne: userId } }))
          throw new AppError('USERNAME_TAKEN');
        user.username = username;
        await em.flush();
      });
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) throw new AppError('USERNAME_TAKEN');
      throw error;
    }
    return { username };
  }

  private assertPublicUsername(username: string) {
    if (isReservedUsername(username)) throw new AppError('USERNAME_RESERVED');
  }
}
