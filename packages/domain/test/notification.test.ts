import { describe, expect, it } from 'vitest';
import {
  HOUSEHOLD_EVENTS,
  HOUSEHOLD_NOTICE_KINDS,
  householdNoticeKind,
  isNotificationType,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPES_BY_ROLE,
  notificationTarget,
  QUOTATION_NOTICE_KINDS,
} from '../src';

const requestId = '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2';

describe('notificationTarget', () => {
  it('sends a quotation notice to the page of the recipient role', () => {
    for (const kind of QUOTATION_NOTICE_KINDS) {
      expect(notificationTarget(kind, 'BUYER', requestId)).toEqual({
        page: 'BUYER_RFQ',
        id: requestId,
      });
      expect(notificationTarget(kind, 'HOUSEHOLD', requestId)).toEqual({
        page: 'STUDIO_CONTRIBUTION',
        id: requestId,
      });
      expect(notificationTarget(kind, 'ADMIN', requestId)).toEqual({
        page: 'ADMIN_COORDINATION',
        id: requestId,
      });
    }
  });

  it('sends every household decision to the application status page', () => {
    for (const kind of HOUSEHOLD_NOTICE_KINDS) {
      expect(notificationTarget(kind, 'HOUSEHOLD', null)).toEqual({
        page: 'STUDIO_APPLICATION',
        id: null,
      });
    }
  });

  it('has no target for a quotation notice without a request id', () => {
    expect(notificationTarget('ORDER_CANCELLED', 'BUYER', null)).toBeNull();
    expect(notificationTarget('ORDER_CANCELLED', 'BUYER', undefined)).toBeNull();
  });
});

describe('notification types', () => {
  it('maps each household event to its own notice kind', () => {
    const kinds = HOUSEHOLD_EVENTS.map(householdNoticeKind);
    expect(new Set(kinds).size).toBe(HOUSEHOLD_EVENTS.length);
    expect(kinds.every((kind) => HOUSEHOLD_NOTICE_KINDS.includes(kind))).toBe(true);
  });

  it('only lists known types per role, and covers every type for some role', () => {
    const listed = new Set<string>();
    for (const types of Object.values(NOTIFICATION_TYPES_BY_ROLE)) {
      for (const type of types) {
        expect(isNotificationType(type)).toBe(true);
        listed.add(type);
      }
    }
    expect([...listed].sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  it('rejects unknown values', () => {
    expect(isNotificationType('NOT_A_NOTICE_TYPE')).toBe(false);
    expect(isNotificationType(null)).toBe(false);
  });
});
