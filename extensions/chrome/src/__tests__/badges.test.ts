import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawBadges } from '../badges';

const SHOT = 'data:image/jpeg;base64,xyz';

/** A 2d context that records what is drawn, behind the worker globals. */
function stubCanvas(width = 2048, height = 1536) {
  const calls: unknown[][] = [];
  const context = {
    font: '',
    textBaseline: '',
    fillStyle: '',
    drawImage: (...args: unknown[]) => calls.push(['drawImage', ...args]),
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillRect: (...args: unknown[]) =>
      calls.push(['fillRect', context.fillStyle, ...args]),
    fillText: (...args: unknown[]) =>
      calls.push(['fillText', context.fillStyle, ...args]),
  };
  const canvas = {
    getContext: vi.fn(() => context),
    convertToBlob: vi.fn(async () => ({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })),
  };
  vi.stubGlobal(
    'OffscreenCanvas',
    vi.fn(() => canvas),
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height })),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ blob: async () => 'blob' })),
  );
  return { calls, canvas, context };
}

afterEach(() => vi.unstubAllGlobals());

describe('drawBadges', () => {
  it('draws one label per mark where the page would have shown it, scaled to the capture', async () => {
    const { calls, canvas, context } = stubCanvas();
    const out = await drawBadges(
      SHOT,
      [
        { n: 7, x: 10, y: 20 },
        { n: 12, x: -5, y: 3 },
      ],
      1024,
    );
    expect(fetch).toHaveBeenCalledWith(SHOT);
    expect(OffscreenCanvas).toHaveBeenCalledWith(2048, 1536);
    expect(context.font).toBe('bold 22px sans-serif');
    // A 2× capture: the badge sits 14 px above the element, clamped to the edge.
    expect(calls).toEqual([
      ['drawImage', { width: 2048, height: 1536 }, 0, 0],
      ['fillRect', '#111', 20, 12, 18, 28],
      ['fillText', '#fff', '7', 26, 15],
      ['fillRect', '#111', 0, 0, 24, 28],
      ['fillText', '#fff', '12', 6, 3],
    ]);
    expect(canvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.6,
    });
    expect(out).toBe(`data:image/jpeg;base64,${btoa('\x01\x02\x03')}`);
  });

  it('returns the capture untouched when there is nothing to draw', async () => {
    stubCanvas();
    expect(await drawBadges(SHOT, [], 1024)).toBe(SHOT);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails loudly without a 2d context', async () => {
    const { canvas } = stubCanvas();
    canvas.getContext.mockReturnValue(null as never);
    await expect(
      drawBadges(SHOT, [{ n: 1, x: 0, y: 0 }], 1024),
    ).rejects.toThrow('No 2d canvas in the worker.');
  });
});
