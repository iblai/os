import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  isChunkLoadError,
  chunkReloadsExhausted,
  reloadForChunkError,
  MAX_CHUNK_RELOADS,
} from '../chunk-retry';

describe('isChunkLoadError', () => {
  it('detects by error name', () => {
    expect(isChunkLoadError({ name: 'ChunkLoadError' })).toBe(true);
  });

  it('detects webpack, CSS, and native dynamic-import messages', () => {
    const messages = [
      'ChunkLoadError: Loading chunk 42 failed',
      'Loading chunk 12 failed. (missing: https://…/12.js)',
      'Loading CSS chunk 3 failed',
      'Failed to fetch dynamically imported module: https://…/x.js',
      'error loading dynamically imported module',
      'Importing a module script failed', // Safari
    ];
    for (const m of messages) {
      expect(isChunkLoadError(new Error(m))).toBe(true);
    }
  });

  it('ignores unrelated errors and non-objects', () => {
    expect(isChunkLoadError(new Error('something else broke'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError('ChunkLoadError')).toBe(false); // string, not Error
  });
});

describe('chunk reload budget', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    vi.stubGlobal('location', { reload });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('auto-reloads up to MAX_CHUNK_RELOADS, then gives up', () => {
    for (let i = 0; i < MAX_CHUNK_RELOADS; i++) {
      expect(chunkReloadsExhausted()).toBe(false);
      expect(reloadForChunkError()).toBe(true); // consumed a reload
    }
    // budget spent
    expect(chunkReloadsExhausted()).toBe(true);
    expect(reloadForChunkError()).toBe(false); // no more reloads
    expect(reload).toHaveBeenCalledTimes(MAX_CHUNK_RELOADS);
  });
});
