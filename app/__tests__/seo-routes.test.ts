import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockHeaders: Record<string, string> = { host: 'os.ibl.ai' };

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => mockHeaders[key.toLowerCase()] ?? null,
  })),
}));

vi.mock('@/lib/config', () => ({
  config: { mentorUrl: () => 'https://mentor.iblai.app' },
}));

import robots from '../robots';
import sitemap from '../sitemap';
import manifest from '../manifest';

beforeEach(() => {
  mockHeaders = { host: 'os.ibl.ai' };
});

describe('robots.ts', () => {
  it('allows / and disallows the private infra routes for all agents', async () => {
    const r = await robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.userAgent).toBe('*');
    expect(rule.allow).toBe('/');
    expect(rule.disallow).toContain('/api/');
    expect(rule.disallow).toContain('/sso-login');
  });

  it('points host + sitemap at the request origin', async () => {
    const r = await robots();
    expect(r.host).toBe('https://os.ibl.ai');
    expect(r.sitemap).toBe('https://os.ibl.ai/sitemap.xml');
  });
});

describe('sitemap.ts', () => {
  it('emits the public root URL with metadata', async () => {
    const entries = await sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe('https://os.ibl.ai/');
    expect(entries[0].priority).toBe(1);
    expect(entries[0].changeFrequency).toBe('weekly');
    expect(entries[0].lastModified).toBeInstanceOf(Date);
  });
});

describe('manifest.ts', () => {
  it('returns an installable PWA manifest', () => {
    const m = manifest();
    expect(m.name).toBe('ibl.ai');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.theme_color).toBe('#2563EB');
    expect(m.icons?.some((i) => i.src === '/favicon.png')).toBe(true);
    expect(m.icons?.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});
