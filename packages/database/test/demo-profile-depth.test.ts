import { describe, expect, it } from 'vitest';
import { DEMO_PHOTOS } from '../src/seeders/demo/photo-manifest.js';
import { HOUSEHOLDS } from '../src/seeders/demo/pools.js';
import {
  DEMO_PRODUCT_GALLERIES,
  EXPERIENCE_OFFERS,
  experienceFields,
  familyTimeline,
  householdCertifications,
  loDucPhatProfile,
  PROFILE_PHOTO_IDS,
  productGalleryImages,
  timelineLength,
} from '../src/seeders/demo/profile-depth.js';

const foundedYearOf = (index: number) => 1940 + ((index * 7) % 60);

describe('familyTimeline', () => {
  it.each(HOUSEHOLDS.map((h, index) => [h.name, index] as const))(
    '%s: 3 to 5 events, rising years from the founding year to 2026',
    (_name, index) => {
      const seed = HOUSEHOLDS[index];
      const founded = foundedYearOf(index);
      const events = familyTimeline({
        owner: seed?.owner ?? '',
        craft: seed?.craft ?? '',
        foundedYear: founded,
        index,
      });
      expect(events).toHaveLength(timelineLength(index));
      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events.length).toBeLessThanOrEqual(5);
      expect(events[0]?.year).toBe(founded);
      for (const [i, event] of events.entries()) {
        expect(event.year).toBeLessThanOrEqual(2026);
        expect(event.title.length).toBeGreaterThanOrEqual(2);
        if (i > 0) expect(event.year).toBeGreaterThan(events[i - 1]?.year ?? 0);
      }
    },
  );
});

describe('householdCertifications', () => {
  it('gives every household one or two village-level certifications, never before it was founded', () => {
    for (const [index] of HOUSEHOLDS.entries()) {
      const founded = foundedYearOf(index);
      const certs = householdCertifications(index, founded);
      expect(certs.length).toBeGreaterThanOrEqual(1);
      expect(certs.length).toBeLessThanOrEqual(2);
      for (const cert of certs) {
        expect(cert.year).toBeGreaterThan(founded);
        expect(cert.year).toBeLessThanOrEqual(2026);
        // Village or cooperative level: never a state award or a real brand.
        expect(cert.issuer).toMatch(/^(Ban quản lý làng nghề|Tổ hợp tác thợ gốm) Bát Tràng$/);
      }
      expect(certs[0]?.verified).toBe(index % 4 !== 3);
      if (certs[1]) expect(certs[1].verified).toBe(false);
    }
  });
});

describe('experience offers', () => {
  it('has 5 to 8 offers with a name, a duration and a price, including Lò Đức Phát', () => {
    const offers = Object.entries(EXPERIENCE_OFFERS);
    expect(offers.length).toBeGreaterThanOrEqual(5);
    expect(offers.length).toBeLessThanOrEqual(8);
    expect(EXPERIENCE_OFFERS[2]).toBeDefined();
    for (const [, offer] of offers) {
      const fields = experienceFields(offer);
      expect(fields.experienceDescription.startsWith(offer.name)).toBe(true);
      expect(fields.experienceDurationMinutes).toBeGreaterThanOrEqual(5);
      expect(fields.experiencePriceVnd).toBeGreaterThan(0);
    }
  });
});

describe('Lò Đức Phát profile and product galleries', () => {
  it('has a 5-event timeline and two certifications, one verified', () => {
    expect(loDucPhatProfile.timeline).toHaveLength(5);
    expect(loDucPhatProfile.certifications).toHaveLength(2);
    expect(loDucPhatProfile.certifications.filter((c) => c.verified)).toHaveLength(1);
  });

  it('gives the QR product three gallery photos and every other listed product two', () => {
    expect(DEMO_PRODUCT_GALLERIES.DF6P3WZE).toHaveLength(3);
    for (const [code, photos] of Object.entries(DEMO_PRODUCT_GALLERIES)) {
      expect(photos.length, code).toBeGreaterThanOrEqual(2);
      expect(new Set(photos).size, code).toBe(photos.length);
    }
    const images = productGalleryImages('DF6P3WZE', (id) => `media-${id}`);
    expect(images?.map((i) => i.mediaId)).toEqual([
      'media-ban-tay-vuot-gom',
      'media-ban-xoay-xuong',
      'media-bia-duc-phat',
    ]);
    expect(productGalleryImages('NOSUCHCODE', (id) => id)).toBeUndefined();
  });

  it('only points at photos of the manifest', () => {
    const ids = new Set(DEMO_PHOTOS.map((p) => p.id));
    for (const id of PROFILE_PHOTO_IDS) expect(ids.has(id), id).toBe(true);
  });
});
