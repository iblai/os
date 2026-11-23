import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useHydrateMentorRbac } from '../use-hydrate-mentor-rbac';

const { getRbacPermissions, dispatch, unwrap } = vi.hoisted(() => {
  const unwrap = vi.fn();
  return {
    unwrap,
    getRbacPermissions: vi.fn(() => ({ unwrap })),
    dispatch: vi.fn(),
  };
});

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetRbacPermissionsMutation: () => [getRbacPermissions],
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  updateRbacPermissions: (payload: unknown) => ({
    type: 'rbac/update',
    payload,
  }),
}));

describe('useHydrateMentorRbac', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unwrap.mockResolvedValue({ '/mentors/7/': { read: true } });
  });

  it("fetches the agent's resources and stores them", async () => {
    const { result } = renderHook(() =>
      useHydrateMentorRbac({ enabled: true, mentorDbId: 7, tenantKey: 't' }),
    );

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
    expect(getRbacPermissions).toHaveBeenCalledTimes(1);
    expect(getRbacPermissions).toHaveBeenCalledWith({
      requestBody: {
        platform_key: 't',
        resources: [
          '/mentors/7/',
          '/mentors/7/llms/',
          '/mentors/7/mcpservers/',
          '/mentors/7/memory/',
          '/mentors/7/documents/',
          '/mentors/7/tools/',
          '/mentors/7/prompts/',
        ],
      },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'rbac/update',
      payload: { '/mentors/7/': { read: true } },
    });
  });

  it('counts as hydrated when the fetch fails, keeping the old permissions', async () => {
    unwrap.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useHydrateMentorRbac({ enabled: true, mentorDbId: 7, tenantKey: 't' }),
    );

    await waitFor(() => expect(result.current).toBe(true));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('waits while disabled or without an agent or tenant', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useHydrateMentorRbac>[0]) =>
        useHydrateMentorRbac(props),
      {
        initialProps: { enabled: false, mentorDbId: 7, tenantKey: 't' },
      },
    );
    rerender({ enabled: true, mentorDbId: undefined, tenantKey: 't' } as never);
    rerender({ enabled: true, mentorDbId: 7, tenantKey: undefined } as never);

    expect(result.current).toBe(false);
    expect(getRbacPermissions).not.toHaveBeenCalled();
  });

  it('drops a response that lands after the agent changed', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    unwrap.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ mentorDbId }: { mentorDbId: number }) =>
        useHydrateMentorRbac({ enabled: true, mentorDbId, tenantKey: 't' }),
      { initialProps: { mentorDbId: 7 } },
    );

    rerender({ mentorDbId: 8 });
    await waitFor(() => expect(result.current).toBe(true));
    resolveFirst({ stale: true });
    await Promise.resolve();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ payload: { stale: true } }),
    );
  });
});
