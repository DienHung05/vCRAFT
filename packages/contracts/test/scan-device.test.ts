import { describe, expect, it } from 'vitest';
import {
  isAutomatedScan,
  isAutomatedUserAgent,
  isPrefetchRequest,
  scanDeviceType,
} from '../src/households';

const CRAWLERS = {
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  slack: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  telegram: 'TelegramBot (like TwitterBot)',
  whatsapp: 'WhatsApp/2.23.20.0 A',
  twitter: 'Twitterbot/1.0',
  discord: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  linkedin: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  skype: 'Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5',
  headless: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36',
  curl: 'curl/8.4.0',
  generic: 'AcmeSpider/3.1 (+https://acme.example/crawler)',
};

const PEOPLE = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  zaloAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Zalo/14.0.1',
  zaloIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/14.0.1 ZaloTheme/light',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

describe('scan classifier (GH#483)', () => {
  it.each(Object.entries(CRAWLERS))('treats %s as automated', (_name, ua) => {
    expect(scanDeviceType(ua)).toBe('bot');
    expect(isAutomatedUserAgent(ua)).toBe(true);
    expect(isAutomatedScan('mobile', ua)).toBe(true);
  });

  it.each(Object.entries(PEOPLE))('does not treat %s as automated', (_name, ua) => {
    expect(isAutomatedUserAgent(ua)).toBe(false);
    expect(isAutomatedScan('mobile', ua)).toBe(false);
  });

  it('keeps the coarse device classes for people', () => {
    expect(scanDeviceType(PEOPLE.iphoneSafari)).toBe('mobile');
    expect(scanDeviceType(PEOPLE.androidChrome)).toBe('mobile');
    expect(scanDeviceType(PEOPLE.zaloAndroid)).toBe('mobile');
    expect(scanDeviceType(PEOPLE.desktop)).toBe('desktop');
    expect(scanDeviceType('')).toBe('unknown');
    expect(scanDeviceType(null)).toBe('unknown');
  });

  it('trusts a reported bot class even without a User-Agent, and an unknown agent is not a bot', () => {
    expect(isAutomatedScan('bot')).toBe(true);
    expect(isAutomatedScan('bot', '')).toBe(true);
    expect(isAutomatedScan(null, undefined)).toBe(false);
    expect(isAutomatedScan('unknown', '')).toBe(false);
  });
});

describe('prefetch detection (GH#483)', () => {
  const call = (method: string, headers: Record<string, string> = {}) =>
    isPrefetchRequest(method, { get: (name) => headers[name.toLowerCase()] ?? null });

  it('skips HEAD and prefetch or prerender hints', () => {
    expect(call('HEAD')).toBe(true);
    expect(call('GET', { purpose: 'prefetch' })).toBe(true);
    expect(call('GET', { 'sec-purpose': 'prefetch' })).toBe(true);
    expect(call('GET', { 'sec-purpose': 'prefetch;anonymous-client-ip' })).toBe(true);
    expect(call('GET', { 'sec-purpose': 'prerender' })).toBe(true);
    expect(call('GET', { 'next-router-prefetch': '1' })).toBe(true);
    expect(call('GET', { 'x-moz': 'prefetch' })).toBe(true);
    expect(call('GET', { 'x-purpose': 'preview' })).toBe(true);
  });

  it('counts an ordinary navigation', () => {
    expect(call('GET')).toBe(false);
    expect(call('GET', { 'user-agent': PEOPLE.iphoneSafari, accept: 'text/html' })).toBe(false);
    expect(call('GET', { 'sec-purpose': 'navigate' })).toBe(false);
    expect(call('GET', { 'next-router-prefetch': '0' })).toBe(false);
  });
});
