import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({
  stored: undefined as unknown,
  setStored: vi.fn(),
  update: vi.fn(),
  appName: 'os',
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useUpdateUserMetadataMutation: () => [state.update],
}));

vi.mock('@/hooks/use-stored-user-metadata', () => ({
  useStoredUserMetadata: () => [state.stored, state.setStored],
}));

vi.mock('@/lib/config', () => ({
  config: { appName: () => state.appName },
}));

import {
  PRODUCT_TOUR_VERSION,
  productTourMetadataKey,
  readTourRecord,
  useTourCompletion,
} from '../use-tour-completion';

const KEY = 'os-product-tour';
const record = (status: string, version = PRODUCT_TOUR_VERSION) => ({
  status,
  version,
  completed_at: '2026-10-01T10:00:00.000Z',
});
const metadata = (publicMetadata: Record<string, unknown> | null) => ({
  username: 'alice',
  public_metadata: publicMetadata,
});

describe('productTourMetadataKey', () => {
  afterEach(() => {
    state.appName = 'os';
  });

  it('is <appName>-product-tour', () => {
    expect(productTourMetadataKey()).toBe(KEY);
  });

  it('falls back to the os app name', () => {
    state.appName = '';
    expect(productTourMetadataKey()).toBe(KEY);
  });
});

describe('readTourRecord', () => {
  it('parses a record this code wrote', () => {
    expect(readTourRecord(record('finished'))).toEqual(record('finished'));
    expect(readTourRecord(record('skipped'))).toEqual(record('skipped'));
  });

  it('fills in defaults for a partial record', () => {
    expect(readTourRecord({ status: 'finished' })).toEqual({
      status: 'finished',
      version: 0,
      completed_at: '',
    });
  });

  it('ignores extra fields', () => {
    expect(
      readTourRecord({ ...record('skipped'), source: 'e2e-auth-setup' }),
    ).toEqual(record('skipped'));
  });

  it('ignores anything else', () => {
    for (const value of [
      undefined,
      null,
      'finished',
      true,
      1,
      {},
      { status: 'maybe' },
      [],
    ]) {
      expect(readTourRecord(value)).toBeNull();
    }
  });
});

describe('useTourCompletion', () => {
  beforeEach(() => {
    state.stored = undefined;
    state.setStored.mockReset();
    state.update
      .mockReset()
      .mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads synchronously from storage: never loading or erroring', () => {
    const { result } = renderHook(() => useTourCompletion(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.completed).toBe(false);
  });

  it('is incomplete when the metadata has no record', () => {
    state.stored = metadata({ language: 'en' });
    const { result } = renderHook(() => useTourCompletion('alice'));
    expect(result.current.completed).toBe(false);
    expect(result.current.outcome).toBeNull();
  });

  it('is incomplete when public_metadata is missing or null', () => {
    state.stored = metadata(null);
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
    state.stored = { username: 'alice' };
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it.each(['finished', 'skipped'])(
    'is complete when the stored record says %s',
    (status) => {
      state.stored = metadata({ [KEY]: record(status) });
      const { result } = renderHook(() => useTourCompletion('alice'));
      expect(result.current.completed).toBe(true);
      expect(result.current.outcome).toBe(status);
    },
  );

  it("ignores another app's tour record", () => {
    state.stored = metadata({ 'skills-product-tour': record('finished') });
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it('shows a reworked tour again: an older version does not count', () => {
    state.stored = metadata({
      [KEY]: record('finished', PRODUCT_TOUR_VERSION - 1),
    });
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it('ignores values this code did not write', () => {
    state.stored = metadata({ [KEY]: 'finished' });
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it('saves the outcome under the key and keeps the rest of public_metadata', async () => {
    state.stored = metadata({ language: 'en', social_links: [] });
    const { result } = renderHook(() => useTourCompletion('alice'));

    await act(() => result.current.markCompleted('finished'));

    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.update).toHaveBeenCalledWith({
      username: 'alice',
      public_metadata: {
        language: 'en',
        social_links: [],
        [KEY]: {
          status: 'finished',
          version: PRODUCT_TOUR_VERSION,
          completed_at: expect.any(String),
        },
      },
    });
    const saved = state.update.mock.calls[0][0].public_metadata[KEY];
    expect(new Date(saved.completed_at).toISOString()).toBe(saved.completed_at);
    expect(result.current.completed).toBe(true);
    expect(result.current.outcome).toBe('finished');
  });

  it('saves a skip the same way, even when public_metadata was null', async () => {
    state.stored = metadata(null);
    const { result } = renderHook(() => useTourCompletion('alice'));

    await act(() => result.current.markCompleted('skipped'));

    expect(state.update).toHaveBeenCalledWith({
      username: 'alice',
      public_metadata: {
        [KEY]: {
          status: 'skipped',
          version: PRODUCT_TOUR_VERSION,
          completed_at: expect.any(String),
        },
      },
    });
    expect(result.current.outcome).toBe('skipped');
  });

  it('keeps the tour closed for this session even if the save fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.update.mockReturnValue({
      unwrap: () => Promise.reject(new Error('boom')),
    });
    state.stored = metadata({});
    const { result } = renderHook(() => useTourCompletion('alice'));

    await act(() => result.current.markCompleted('finished'));

    expect(result.current.completed).toBe(true);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('[product-tour]'),
      expect.any(Error),
    );
  });

  it('does not call the endpoint without a username', async () => {
    const { result } = renderHook(() => useTourCompletion(null));
    await act(() => result.current.markCompleted('finished'));
    expect(state.update).not.toHaveBeenCalled();
    expect(result.current.completed).toBe(true);
  });
});
