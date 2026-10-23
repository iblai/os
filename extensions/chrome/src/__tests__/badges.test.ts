import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_EDGE, drawBadges } from '../badges';

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
  // A 2× capture lands at CSS size, so a point on the picture is a point of
  // the viewport; the badge sits 14 px above the element, clamped to the edge.
  it('draws the capture at CSS size with one label per mark where the page would have shown it', async () => {
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
    expect(OffscreenCanvas).toHaveBeenCalledWith(1024, 768);
    expect(context.font).toBe('bold 11px sans-serif');
    expect(calls).toEqual([
      ['drawImage', { width: 2048, height: 1536 }, 0, 0, 1024, 768],
      ['fillRect', '#111', 10, 6, 12, 14],
      ['fillText', '#fff', '7', 13, 7.5],
      ['fillRect', '#111', 0, 0, 18, 14],
      ['fillText', '#fff', '12', 3, 1.5],
    ]);
    expect(canvas.convertToBlob).toHaveBeenCalledWith({
      type: 'image/jpeg',
      quality: 0.6,
    });
    expect(out).toEqual({
      dataUrl: `data:image/jpeg;base64,${btoa('\x01\x02\x03')}`,
      scale: 1,
    });
  });

  // Past MAX_EDGE the model's API would downsize the picture itself, and a
  // point the model picks on it with it; the scale says what it was drawn at.
  it('shrinks a viewport wider or taller than MAX_EDGE and reports the scale', async () => {
    const { calls } = stubCanvas(3136, 980);
    const wide = await drawBadges(SHOT, [{ n: 1, x: 100, y: 200 }], 3136);
    expect(OffscreenCanvas).toHaveBeenLastCalledWith(1568, 490);
    expect(calls).toEqual([
      ['drawImage', { width: 3136, height: 980 }, 0, 0, 1568, 490],
      ['fillRect', '#111', 50, 93, 9, 7],
      ['fillText', '#fff', '1', 51.5, 93.75],
    ]);
    expect(wide.scale).toBe(0.5);

    stubCanvas(1000, 2000);
    const tall = await drawBadges(SHOT, [], 1000);
    expect(OffscreenCanvas).toHaveBeenLastCalledWith(784, MAX_EDGE);
    expect(tall.scale).toBeCloseTo(0.784);
  });

  it('encodes the capture once as JPEG even with nothing to draw', async () => {
    const { calls } = stubCanvas();
    expect(await drawBadges(SHOT, [], 1024)).toEqual({
      dataUrl: `data:image/jpeg;base64,${btoa('\x01\x02\x03')}`,
      scale: 1,
    });
    expect(fetch).toHaveBeenCalledWith(SHOT);
    expect(calls).toEqual([
      ['drawImage', { width: 2048, height: 1536 }, 0, 0, 1024, 768],
    ]);
  });

  it('fails loudly without a 2d context', async () => {
    const { canvas } = stubCanvas();
    canvas.getContext.mockReturnValue(null as never);
    await expect(
      drawBadges(SHOT, [{ n: 1, x: 0, y: 0 }], 1024),
    ).rejects.toThrow('No 2d canvas in the worker.');
  });
});
