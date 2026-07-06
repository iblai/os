import { describe, it, expect, vi, beforeEach } from 'vitest';

// Controllable request-header + config mocks --------------------------------
let mockHeaders: Record<string, string> = {};
let headersThrows = false;

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => {
    if (headersThrows) throw new Error('headers() unavailable');
    return {
      get: (key: string) => mockHeaders[key.toLowerCase()] ?? null,
    };
  }),
}));

vi.mock('@/lib/config', () => ({
  config: { mentorUrl: () => 'https://mentor.iblai.app/' },
}));

import {
  getSiteUrl,
  joinUrl,
  buildMetadata,
  organizationJsonLd,
  websiteJsonLd,
  DISALLOWED_PATHS,
  SITE_NAME,
  DEFAULT_TITLE,
} from '@/lib/seo';

beforeEach(() => {
  mockHeaders = {};
  headersThrows = false;
});

describe('getSiteUrl', () => {
  it('derives origin from x-forwarded-host + proto', async () => {
    mockHeaders = {
      'x-forwarded-host': 'os.ibl.ai',
      'x-forwarded-proto': 'https',
    };
    expect(await getSiteUrl()).toBe('https://os.ibl.ai');
  });

  it('falls back to host header and defaults proto to https', async () => {
    mockHeaders = { host: 'tenant.iblai.app' };
    expect(await getSiteUrl()).toBe('https://tenant.iblai.app');
  });

  it('uses http for localhost hosts', async () => {
    mockHeaders = { host: 'localhost:3000' };
    expect(await getSiteUrl()).toBe('http://localhost:3000');
  });

  it('uses http for 127.0.0.1 hosts', async () => {
    mockHeaders = { host: '127.0.0.1:3000' };
    expect(await getSiteUrl()).toBe('http://127.0.0.1:3000');
  });

  it('strips a trailing slash', async () => {
    mockHeaders = { host: 'os.ibl.ai/' };
    expect(await getSiteUrl()).toBe('https://os.ibl.ai');
  });

  it('falls back to config.mentorUrl when no host header', async () => {
    expect(await getSiteUrl()).toBe('https://mentor.iblai.app');
  });

  it('falls back to config.mentorUrl when headers() throws', async () => {
    headersThrows = true;
    expect(await getSiteUrl()).toBe('https://mentor.iblai.app');
  });
});

describe('joinUrl', () => {
  it('returns origin root for "/" or empty', () => {
    expect(joinUrl('https://x.com', '/')).toBe('https://x.com/');
    expect(joinUrl('https://x.com', '')).toBe('https://x.com/');
  });

  it('joins a path and de-dupes leading slashes', () => {
    expect(joinUrl('https://x.com', '/share/abc')).toBe(
      'https://x.com/share/abc',
    );
    expect(joinUrl('https://x.com', 'share/abc')).toBe(
      'https://x.com/share/abc',
    );
  });
});

describe('buildMetadata', () => {
  beforeEach(() => {
    mockHeaders = { host: 'os.ibl.ai' };
  });

  it('is noindex/nofollow by default', async () => {
    const m = await buildMetadata();
    expect(m.robots).toMatchObject({ index: false, follow: false });
    expect((m.robots as any).googleBot).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('opts in to indexing when index:true', async () => {
    const m = await buildMetadata({ index: true });
    expect(m.robots).toMatchObject({ index: true, follow: true });
    expect((m.robots as any).googleBot['max-image-preview']).toBe('large');
  });

  it('sets a host-derived canonical from the path', async () => {
    const m = await buildMetadata({ path: '/share/chat/abc' });
    expect((m.alternates as any).canonical).toBe(
      'https://os.ibl.ai/share/chat/abc',
    );
    expect((m.openGraph as any).url).toBe('https://os.ibl.ai/share/chat/abc');
  });

  it('uses the page title and description for OG/twitter', async () => {
    const m = await buildMetadata({
      title: 'Shared chat',
      description: 'A convo',
    });
    expect(m.title).toBe('Shared chat');
    expect((m.openGraph as any).title).toBe('Shared chat');
    expect((m.twitter as any).title).toBe('Shared chat');
    expect(m.description).toBe('A convo');
  });

  it('root mode adds a title template, icons, and manifest', async () => {
    const m = await buildMetadata({ root: true });
    expect(m.title).toMatchObject({
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    });
    expect(m.manifest).toBe('/manifest.webmanifest');
    expect((m.icons as any).icon).toBe('/favicon.png');
    expect(m.metadataBase).toBeInstanceOf(URL);
    expect(m.metadataBase?.href).toBe('https://os.ibl.ai/');
  });

  it('maps custom images into OG objects', async () => {
    const m = await buildMetadata({ images: ['/a.png', '/b.png'] });
    expect((m.openGraph as any).images).toEqual([
      { url: '/a.png' },
      { url: '/b.png' },
    ]);
    expect((m.twitter as any).images).toEqual(['/a.png', '/b.png']);
  });
});

describe('json-ld builders', () => {
  it('organizationJsonLd has the expected shape', () => {
    const o = organizationJsonLd('https://os.ibl.ai');
    expect(o['@type']).toBe('Organization');
    expect(o.url).toBe('https://os.ibl.ai/');
    expect(o.logo).toBe('https://os.ibl.ai/iblai-logo.png');
  });

  it('websiteJsonLd has the expected shape', () => {
    const w = websiteJsonLd('https://os.ibl.ai');
    expect(w['@type']).toBe('WebSite');
    expect(w.url).toBe('https://os.ibl.ai/');
  });
});

describe('DISALLOWED_PATHS', () => {
  it('covers the private infra routes', () => {
    for (const p of [
      '/api/',
      '/sso-login',
      '/uploads',
      '/reports',
      '/version',
    ]) {
      expect(DISALLOWED_PATHS).toContain(p);
    }
  });
});
