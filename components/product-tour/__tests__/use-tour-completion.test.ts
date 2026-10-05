import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const state = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, isError: false },
  queryArgs: [] as unknown[],
  update: vi.fn(),
  appName: 'os',
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserMetadataQuery: (...args: unknown[]) => {
    state.queryArgs = args;
    return state.query;
  },
  useUpdateUserMetadataMutation: () => [state.update],
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
    state.query = { data: undefined, isLoading: false, isError: false };
    state.queryArgs = [];
    state.update
      .mockReset()
      .mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the metadata of the given user', () => {
    renderHook(() => useTourCompletion('alice'));
    expect(state.queryArgs).toEqual([
      { params: { username: 'alice' } },
      { skip: false },
    ]);
  });

  it('skips the read without a username and has nothing to wait for', () => {
    state.query = { data: undefined, isLoading: true, isError: true };
    const { result } = renderHook(() => useTourCompletion(null));
    expect(state.queryArgs).toEqual([
      { params: { username: '' } },
      { skip: true },
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.completed).toBe(false);
  });

  it('is loading until the metadata arrives', () => {
    state.query = { data: undefined, isLoading: true, isError: false };
    const { result } = renderHook(() => useTourCompletion('alice'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.completed).toBe(false);
  });

  it('reports metadata that could not be read', () => {
    state.query = { data: undefined, isLoading: false, isError: true };
    const { result } = renderHook(() => useTourCompletion('alice'));
    expect(result.current.isError).toBe(true);
    expect(result.current.completed).toBe(false);
  });

  it('is incomplete when the metadata has no record', () => {
    state.query = {
      data: metadata({ language: 'en' }),
      isLoading: false,
      isError: false,
    };
    const { result } = renderHook(() => useTourCompletion('alice'));
    expect(result.current.completed).toBe(false);
    expect(result.current.outcome).toBeNull();
  });

  it('is incomplete when public_metadata is missing or null', () => {
    state.query = { data: metadata(null), isLoading: false, isError: false };
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
    state.query = {
      data: { username: 'alice' },
      isLoading: false,
      isError: false,
    };
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it.each(['finished', 'skipped'])(
    'is complete when the stored record says %s',
    (status) => {
      state.query = {
        data: metadata({ [KEY]: record(status) }),
        isLoading: false,
        isError: false,
      };
      const { result } = renderHook(() => useTourCompletion('alice'));
      expect(result.current.completed).toBe(true);
      expect(result.current.outcome).toBe(status);
    },
  );

  it("ignores another app's tour record", () => {
    state.query = {
      data: metadata({ 'skills-product-tour': record('finished') }),
      isLoading: false,
      isError: false,
    };
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it('shows a reworked tour again: an older version does not count', () => {
    state.query = {
      data: metadata({ [KEY]: record('finished', PRODUCT_TOUR_VERSION - 1) }),
      isLoading: false,
      isError: false,
    };
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it('ignores values this code did not write', () => {
    state.query = {
      data: metadata({ [KEY]: 'finished' }),
      isLoading: false,
      isError: false,
    };
    expect(
      renderHook(() => useTourCompletion('alice')).result.current.completed,
    ).toBe(false);
  });

  it('saves the outcome under the key and keeps the rest of public_metadata', async () => {
    state.query = {
      data: metadata({ language: 'en', social_links: [] }),
      isLoading: false,
      isError: false,
    };
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
    state.query = { data: metadata(null), isLoading: false, isError: false };
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
    state.query = { data: metadata({}), isLoading: false, isError: false };
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
