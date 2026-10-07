import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTranslator } from 'next-intl';

import enMessages from '@/messages/en.json';

const mockIsVisible = vi.fn();
vi.mock('../tour-targets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tour-targets')>()),
  isTourTargetVisible: (target: unknown) => mockIsVisible(target),
}));

import { buildTourSteps, filterVisibleTourSteps } from '../tour-steps';

const t = createTranslator({
  locale: 'en',
  messages: enMessages,
  namespace: 'productTour',
}) as unknown as (key: string) => string;

const ids = (steps: ReturnType<typeof buildTourSteps>) =>
  steps.map((s) => s.id);

describe('buildTourSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens on the chat input, then walks the navbar, the starters and the sidebar', () => {
    const steps = buildTourSteps({ isAdmin: false, t });
    expect(ids(steps)).toEqual([
      'prompt-input',
      'profile',
      'privacy-mode',
      'conversation-starters',
      'agents',
    ]);
  });

  it('opens on the chat input for an admin too', () => {
    expect(ids(buildTourSteps({ isAdmin: true, t }))[0]).toBe('prompt-input');
  });

  it('adds the account step last for an admin', () => {
    const steps = buildTourSteps({ isAdmin: true, t });
    expect(ids(steps).at(-1)).toBe('account');
    expect(steps.at(-1)).toMatchObject({
      target: '[data-tour="account"]',
      placement: 'right-end',
      isFixed: true,
      title: 'Manage your organization',
    });
    expect(steps.at(-1)?.content).toMatch(/invite people/i);
  });

  it('targets each step through its data-tour hook', () => {
    const steps = buildTourSteps({ isAdmin: true, t });
    for (const step of steps) {
      expect(step.target).toBe(`[data-tour="${step.id}"]`);
    }
  });

  it('pins the sidebar steps to the fixed sidebar', () => {
    const steps = buildTourSteps({ isAdmin: true, t });
    const fixed = steps.filter((s) => s.isFixed).map((s) => s.id);
    expect(fixed).toEqual(['agents', 'account']);
  });

  it('lets only the conversation starters scroll into view', () => {
    const steps = buildTourSteps({ isAdmin: false, t });
    const scrolling = steps
      .filter((s) => s.skipScroll === false)
      .map((s) => s.id);
    expect(scrolling).toEqual(['conversation-starters']);
  });

  it('uses the translated copy', () => {
    const steps = buildTourSteps({ isAdmin: false, t });
    expect(steps.map((s) => s.title)).toEqual([
      'Ask anything',
      'Your profile',
      'Private mode',
      'Conversation starters',
      'Explore agents',
    ]);
    for (const step of steps) {
      expect(step.content).toBeTruthy();
      expect(step.content).not.toMatch(/^productTour\./);
    }
  });
});

describe('filterVisibleTourSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps only the steps whose target is on the page', () => {
    const steps = buildTourSteps({ isAdmin: true, t });
    mockIsVisible.mockImplementation(
      (target: unknown) =>
        target === '[data-tour="profile"]' ||
        target === '[data-tour="account"]',
    );
    expect(ids(filterVisibleTourSteps(steps))).toEqual(['profile', 'account']);
    expect(mockIsVisible).toHaveBeenCalledTimes(steps.length);
  });

  it('returns an empty list when nothing is mounted yet', () => {
    mockIsVisible.mockReturnValue(false);
    expect(
      filterVisibleTourSteps(buildTourSteps({ isAdmin: false, t })),
    ).toEqual([]);
  });
});
