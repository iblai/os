import { describe, it, expect } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

import Markdown from '@/components/markdown';
import { MarkdownImageComponent } from '../markdown-image-component';

// Anything that may not appear inside a <p>. React reports such nesting as a
// hydration error, and the browser silently closes the paragraph around it.
const FLOW_CONTENT = 'div, p, ul, ol, li, section, blockquote, pre, table, hr';

/**
 * Streamdown's own `img` is `max-w-full rounded-lg`: no height limit, so a
 * tall image pushes the whole conversation down, and the browser's broken-image
 * glyph when a URL fails. Issue #2441.
 */
describe('MarkdownImageComponent', () => {
  it('clamps the image and keeps its aspect ratio', () => {
    const { container } = render(
      <MarkdownImageComponent
        src="https://example.com/a.png"
        alt="A picture"
      />,
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(img?.className).toContain('max-h-96');
    expect(img?.className).toContain('w-auto');
    expect(img?.className).toContain('object-contain');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('alt')).toBe('A picture');
  });

  it('carries the title through to the image', () => {
    const { container } = render(
      <MarkdownImageComponent
        src="https://example.com/a.png"
        title="Caption"
      />,
    );
    expect(container.querySelector('img')?.getAttribute('title')).toBe(
      'Caption',
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('falls back to a labelled card when the image fails to load', async () => {
    const { container, getByText } = render(
      <MarkdownImageComponent src="https://example.invalid/nope.png" />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(getByText('Image unavailable')).toBeTruthy();
  });

  it('uses the alt text as the failure label when there is one', async () => {
    const { container, getByText } = render(
      <MarkdownImageComponent
        src="https://example.invalid/nope.png"
        alt="Sales chart"
        title="Q3"
      />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    await waitFor(() => expect(getByText('Sales chart')).toBeTruthy());
    expect(container.querySelector('[title="Q3"]')).not.toBeNull();
  });

  it('renders the failure card when there is no src at all', () => {
    const { getByText, container } = render(<MarkdownImageComponent />);
    expect(getByText('Image unavailable')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders a Blob src through an object URL and revokes it on unmount', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (() => {
      const url = `blob:test-${created.length}`;
      created.push(url);
      return url;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((url: string) => {
      revoked.push(url);
    }) as typeof URL.revokeObjectURL;
    try {
      const blob = new Blob(['x'], { type: 'image/png' });
      const { container, unmount } = render(
        <MarkdownImageComponent src={blob} alt="From a blob" />,
      );
      await waitFor(() =>
        expect(container.querySelector('img')?.getAttribute('src')).toBe(
          created[0],
        ),
      );
      unmount();
      expect(revoked).toEqual(created);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('clears the image when the src goes away', async () => {
    const { container, rerender } = render(
      <MarkdownImageComponent src="https://example.com/a.png" />,
    );
    expect(container.querySelector('img')).not.toBeNull();
    rerender(<MarkdownImageComponent />);
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
  });

  it('keeps the fallback card out of flow content so it is valid inside a <p>', () => {
    const { container } = render(<MarkdownImageComponent alt="Missing" />);
    expect(container.querySelector(FLOW_CONTENT)).toBeNull();
  });

  it('keeps the failure card out of flow content too', async () => {
    const { container } = render(
      <MarkdownImageComponent src="https://example.invalid/nope.png" />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(container.querySelector(FLOW_CONTENT)).toBeNull();
  });

  it('emits no flow content inside the paragraph a markdown image sits in', async () => {
    const { container } = render(
      <Markdown>
        {'before ![alt](https://example.invalid/x.png) after'}
      </Markdown>,
    );
    const paragraph = container.querySelector('p') as HTMLParagraphElement;
    expect(paragraph).not.toBeNull();
    expect(paragraph.querySelector(FLOW_CONTENT)).toBeNull();
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(
      (container.querySelector('p') as HTMLParagraphElement).querySelector(
        FLOW_CONTENT,
      ),
    ).toBeNull();
  });

  it('paints the image itself first, with no fallback flash before the effect runs', () => {
    const html = renderToStaticMarkup(
      <MarkdownImageComponent
        src="https://example.com/a.png"
        alt="A picture"
      />,
    );
    expect(html).toContain('<img');
    expect(html).not.toContain('Image unavailable');
    expect(html).not.toContain('A picture</span>');
  });
});
