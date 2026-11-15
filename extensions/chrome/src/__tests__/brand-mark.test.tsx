import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandMark } from '../brand-mark';

afterEach(cleanup);

describe('BrandMark', () => {
  // The motion says "working" to someone watching it; this is what everyone
  // else hears.
  it('carries the wait as its accessible name', () => {
    render(<BrandMark label="Signing you in" />);

    expect(screen.getByRole('status')).toHaveAccessibleName('Signing you in');
  });

  // Drawn, not played: a Lottie runtime costs 357 kB for one two-second loop,
  // on the screen shown while the panel is still starting.
  it('draws the mark itself, with no animation runtime', () => {
    const { container } = render(<BrandMark label="Signing you in" />);

    const svg = container.querySelector('svg.mark');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 840 360');
    expect(container.querySelector('canvas')).toBeNull();
  });

  // The wave is cut out of the disc rather than painted over it, so the mark
  // keeps its shape on any background.
  it('punches the wave out of the disc', () => {
    const { container } = render(<BrandMark label="Signing you in" />);

    const disc = container.querySelector('.mark-disc');
    expect(disc?.getAttribute('mask')).toBe('url(#mark-wave)');
    expect(container.querySelector('#mark-wave')).toBeInTheDocument();
  });

  it('renders every glyph of the wordmark', () => {
    const { container } = render(<BrandMark label="Signing you in" />);

    for (const glyph of ['i1', 'b', 'l', 'a', 'i2', 'd1', 'd2', 'd3']) {
      expect(container.querySelector(`.mark-${glyph}`)).toBeInTheDocument();
    }
  });
});
