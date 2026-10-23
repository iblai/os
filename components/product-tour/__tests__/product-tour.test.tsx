import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

const CHAT_PATH = '/platform/test-tenant/test-agent';

const state = vi.hoisted(() => ({
  pathname: '/platform/test-tenant/test-agent',
  search: '',
  isMobile: false,
  embedMode: false,
  username: 'test-user' as string | null,
  isAdmin: false,
  userIsStudent: false,
  dialogOpen: false,
  tour: {
    completed: false,
    outcome: null as string | null,
    isLoading: false,
    isError: false,
    markCompleted: vi.fn(),
  },
  tourUsername: undefined as unknown,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile: state.isMobile }),
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: () => state.embedMode,
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => state.username,
  useIsAdmin: () => state.isAdmin,
  useUserIsStudent: () => state.userIsStudent,
}));

vi.mock('../tour-targets', () => ({
  isBlockingDialogOpen: () => state.dialogOpen,
}));

const steps = vi.hoisted(() => ({
  all: [
    {
      id: 'prompt-input',
      target: '[data-tour="prompt-input"]',
      content: 'Prompt',
    },
    { id: 'profile', target: '[data-tour="profile"]', content: 'Profile' },
  ],
  build: vi.fn(),
  filter: vi.fn(),
}));

vi.mock('../tour-steps', () => ({
  buildTourSteps: (...args: unknown[]) => steps.build(...args),
  filterVisibleTourSteps: (list: unknown[]) => steps.filter(list),
}));

vi.mock('../use-tour-completion', () => ({
  useTourCompletion: (username: unknown) => {
    state.tourUsername = username;
    return state.tour;
  },
}));

vi.mock('../tour-runner', () => ({
  TourRunner: ({ steps: list, run, onEnd }: any) => (
    <div
      data-testid="tour-runner"
      data-run={String(run)}
      data-steps={list.map((s: { id: string }) => s.id).join(',')}
    >
      <button onClick={() => onEnd('finished')}>finish</button>
      <button onClick={() => onEnd('skipped')}>skip</button>
    </div>
  ),
}));

import {
  ProductTour,
  isTourPath,
  TOUR_START_DELAY_MS,
  TOUR_START_MAX_ATTEMPTS,
  TOUR_START_RETRY_MS,
} from '../product-tour';

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Advance past the grace period, then wait (real timers) for the lazy runner. */
async function startTour() {
  await advance(TOUR_START_DELAY_MS);
  vi.useRealTimers();
  return screen.findByTestId('tour-runner');
}

const settleTime =
  TOUR_START_DELAY_MS + TOUR_START_RETRY_MS * TOUR_START_MAX_ATTEMPTS * 2;

describe('isTourPath', () => {
  it.each([
    '/platform/t/agent-1',
    '/platform/t/agent-1/',
    '/platform/t/agent-1?chat=abc',
    '/platform/main/ai-mentor?tour=1',
  ])('runs on the agent chat page %s', (pathname) => {
    expect(isTourPath(pathname)).toBe(true);
  });

  it.each([
    '/platform/t/explore',
    '/platform/t/analytics',
    '/platform/t/notifications',
    '/platform/t/projects',
    '/platform/t/workflows',
    '/platform/t/agent-1/explore',
    '/platform/t/agent-1/analytics/users',
    '/platform/t/agent-1/profile',
    '/platform/t/projects/12/agent-1',
    '/platform/t',
    '/',
    '/share/abc',
  ])('stays off %s', (pathname) => {
    expect(isTourPath(pathname)).toBe(false);
  });

  it('stays off without a pathname', () => {
    expect(isTourPath(null)).toBe(false);
    expect(isTourPath(undefined)).toBe(false);
    expect(isTourPath('')).toBe(false);
  });
});

describe('ProductTour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.pathname = CHAT_PATH;
    state.search = '';
    state.isMobile = false;
    state.embedMode = false;
    state.username = 'test-user';
    state.isAdmin = false;
    state.userIsStudent = false;
    state.dialogOpen = false;
    state.tour = {
      completed: false,
      outcome: null,
      isLoading: false,
      isError: false,
      markCompleted: vi.fn(),
    };
    steps.build.mockReset().mockReturnValue(steps.all);
    steps.filter.mockReset().mockImplementation((list) => list);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts after the shell grace period with the steps that are on the page', async () => {
    render(<ProductTour />);
    expect(screen.queryByTestId('tour-runner')).not.toBeInTheDocument();
    expect(steps.build).not.toHaveBeenCalled();

    const runner = await startTour();

    expect(runner).toHaveAttribute('data-run', 'true');
    expect(runner).toHaveAttribute('data-steps', 'prompt-input,profile');
    expect(steps.build).toHaveBeenCalledTimes(1);
    expect(steps.build).toHaveBeenCalledWith({
      isAdmin: false,
      t: expect.any(Function),
    });
    expect(state.tourUsername).toBe('test-user');
  });

  it('hands the step builder a translator for the productTour messages', async () => {
    render(<ProductTour />);
    await startTour();
    const { t } = steps.build.mock.calls[0][0];
    expect(t('agentsTitle')).toBe('Explore agents');
  });

  it('includes the account step for a live admin', async () => {
    state.isAdmin = true;
    render(<ProductTour />);
    await startTour();
    expect(steps.build).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: true }),
    );
  });

  it('treats an admin in User mode like any other user', async () => {
    state.isAdmin = true;
    state.userIsStudent = true;
    render(<ProductTour />);
    await startTour();
    expect(steps.build).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: false }),
    );
  });

  it('retries until the targets are mounted', async () => {
    steps.filter.mockReturnValueOnce([]).mockReturnValueOnce([]);
    render(<ProductTour />);

    await advance(TOUR_START_DELAY_MS);
    expect(steps.build).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('tour-runner')).not.toBeInTheDocument();

    await advance(TOUR_START_RETRY_MS);
    expect(steps.build).toHaveBeenCalledTimes(2);

    await advance(TOUR_START_RETRY_MS);
    expect(steps.build).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
    expect(await screen.findByTestId('tour-runner')).toHaveAttribute(
      'data-steps',
      'prompt-input,profile',
    );
  });

  it('gives up after the retry budget when nothing mounts', async () => {
    steps.filter.mockReturnValue([]);
    render(<ProductTour />);

    await advance(settleTime);

    expect(steps.build).toHaveBeenCalledTimes(TOUR_START_MAX_ATTEMPTS);
    expect(screen.queryByTestId('tour-runner')).not.toBeInTheDocument();
  });

  it('waits for an open dialog to close without using up the retry budget', async () => {
    state.dialogOpen = true;
    render(<ProductTour />);

    await advance(settleTime * 3);
    expect(steps.build).not.toHaveBeenCalled();

    state.dialogOpen = false;
    await advance(TOUR_START_RETRY_MS);
    expect(steps.build).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    expect(await screen.findByTestId('tour-runner')).toBeInTheDocument();
  });

  it.each(['finished', 'skipped'])(
    'does not run again once the user %s it',
    async (outcome) => {
      state.tour.completed = true;
      state.tour.outcome = outcome;
      render(<ProductTour />);

      await advance(settleTime);

      expect(steps.build).not.toHaveBeenCalled();
      expect(screen.queryByTestId('tour-runner')).not.toBeInTheDocument();
    },
  );

  it('replays with ?tour=1 even after it was completed', async () => {
    state.tour.completed = true;
    state.tour.outcome = 'finished';
    state.search = 'tour=1';
    render(<ProductTour />);

    expect(await startTour()).toBeInTheDocument();
  });

  it('ignores other values of the tour param', async () => {
    state.tour.completed = true;
    state.tour.outcome = 'finished';
    state.search = 'tour=0';
    render(<ProductTour />);

    await advance(settleTime);

    expect(steps.build).not.toHaveBeenCalled();
  });

  it('never runs in embedded mode, even with ?tour=1', async () => {
    state.embedMode = true;
    state.search = 'tour=1';
    render(<ProductTour />);

    await advance(settleTime);

    expect(steps.build).not.toHaveBeenCalled();
    expect(screen.queryByTestId('tour-runner')).not.toBeInTheDocument();
  });

  it('stays quiet on mobile, where the sidebar is a drawer', async () => {
    state.isMobile = true;
    render(<ProductTour />);

    await advance(settleTime);

    expect(steps.build).not.toHaveBeenCalled();
  });

  it.each([
    '/platform/test-tenant/explore',
    '/platform/test-tenant/test-agent/analytics',
    '/platform/test-tenant/workflows/test-agent',
  ])('stays quiet on %s', async (pathname) => {
    state.pathname = pathname;
    render(<ProductTour />);

    await advance(settleTime);

    expect(steps.build).not.toHaveBeenCalled();
  });

  it('waits for the user metadata (tour state) before starting', async () => {
    state.tour.isLoading = true;
    const { rerender } = render(<ProductTour />);
    await advance(settleTime);
    expect(steps.build).not.toHaveBeenCalled();

    state.tour = { ...state.tour, isLoading: false };
    rerender(<ProductTour />);
    expect(await startTour()).toBeInTheDocument();
  });

  it('stays quiet when the metadata could not be read, unless a replay is forced', async () => {
    state.tour.isError = true;
    const { rerender } = render(<ProductTour />);
    await advance(settleTime);
    expect(steps.build).not.toHaveBeenCalled();

    state.search = 'tour=1';
    rerender(<ProductTour />);
    expect(await startTour()).toBeInTheDocument();
  });

  it('stays quiet without a logged-in username', async () => {
    state.username = null;
    render(<ProductTour />);
    await advance(settleTime);
    expect(steps.build).not.toHaveBeenCalled();
  });

  it('cancels a pending start when the page becomes ineligible', async () => {
    const { rerender } = render(<ProductTour />);
    await advance(TOUR_START_DELAY_MS / 2);

    state.pathname = '/platform/test-tenant/explore';
    rerender(<ProductTour />);
    await advance(settleTime);

    expect(steps.build).not.toHaveBeenCalled();
  });

  it.each([
    ['finish', 'finished'],
    ['skip', 'skipped'],
  ])(
    'records the outcome and unmounts the tour on %s',
    async (button, outcome) => {
      render(<ProductTour />);
      await startTour();

      fireEvent.click(screen.getByText(button));

      expect(state.tour.markCompleted).toHaveBeenCalledWith(outcome);
      expect(screen.queryByTestId('tour-runner')).not.toBeInTheDocument();
    },
  );

  it('does not restart in the same session after ending, even with ?tour=1', async () => {
    state.search = 'tour=1';
    render(<ProductTour />);
    await startTour();
    fireEvent.click(screen.getByText('finish'));

    vi.useFakeTimers();
    await advance(settleTime);

    expect(steps.build).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('tour-runner')).not.toBeInTheDocument();
  });
});
