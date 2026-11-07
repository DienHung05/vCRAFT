import { describe, expect, it } from 'vitest';
import { clientHints, describeClient, edgeCountry } from './client-hints';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/131.0.0.0`;
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

describe('describeClient', () => {
  it.each([
    [CHROME_WINDOWS, 'Chrome · Windows'],
    [EDGE_WINDOWS, 'Edge · Windows'],
    [FIREFOX_LINUX, 'Firefox · Linux'],
    [SAFARI_IPHONE, 'Safari · iOS'],
    [CHROME_ANDROID, 'Chrome · Android'],
    [SAFARI_MAC, 'Safari · macOS'],
  ])('labels %#', (userAgent, label) => {
    expect(describeClient(userAgent)).toBe(label);
  });

  it('keeps no version string or device detail', () => {
    expect(describeClient(CHROME_ANDROID)).not.toMatch(/\d|Pixel/);
  });

  it('returns null for a missing or unrecognised agent', () => {
    expect(describeClient(undefined)).toBeNull();
    expect(describeClient('')).toBeNull();
    expect(describeClient('curl/8.5.0')).toBeNull();
  });

  it('keeps only the system when the browser is unknown', () => {
    expect(describeClient('SomeApp (Windows NT 10.0)')).toBe('Windows');
  });
});

describe('edgeCountry', () => {
  it('reads the edge country header in upper case', () => {
    expect(edgeCountry({ 'x-vercel-ip-country': 'vn' })).toBe('VN');
    expect(edgeCountry({ 'cf-ipcountry': 'JP' })).toBe('JP');
  });

  it('ignores unknown markers and malformed values', () => {
    expect(edgeCountry({ 'cf-ipcountry': 'XX' })).toBeNull();
    expect(edgeCountry({ 'cf-ipcountry': 'T1' })).toBeNull();
    expect(edgeCountry({ 'x-vercel-ip-country': 'Viet Nam' })).toBeNull();
    expect(edgeCountry({})).toBeNull();
  });
});

describe('clientHints', () => {
  it('combines the browser label and the country', () => {
    expect(clientHints({ 'user-agent': FIREFOX_LINUX, 'x-vercel-ip-country': 'DE' })).toEqual({
      browser: 'Firefox · Linux',
      country: 'DE',
    });
  });
});
