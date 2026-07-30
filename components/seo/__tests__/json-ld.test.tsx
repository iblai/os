import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { SiteJsonLd, JsonLd } from '../json-ld';

describe('SiteJsonLd', () => {
  it('renders Organization + WebSite JSON-LD for the given origin', () => {
    const { container } = render(<SiteJsonLd origin="https://os.ibl.ai" />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.innerHTML);
    expect(Array.isArray(data)).toBe(true);
    expect(data.map((n: any) => n['@type'])).toEqual([
      'Organization',
      'WebSite',
    ]);
    expect(data[0].url).toBe('https://os.ibl.ai/');
  });
});

describe('JsonLd', () => {
  it('serializes an arbitrary JSON-LD object', () => {
    const { container } = render(
      <JsonLd data={{ '@type': 'Person', name: 'Ada' }} />,
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(JSON.parse(script!.innerHTML)).toEqual({
      '@type': 'Person',
      name: 'Ada',
    });
  });
});
