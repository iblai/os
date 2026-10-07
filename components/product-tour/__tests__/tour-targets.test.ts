import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  isBlockingDialogOpen,
  isTourTargetVisible,
  resolveTourTarget,
  TOUR_TARGET,
  tourSelector,
} from '../tour-targets';

const rect = (width: number, height: number) =>
  ({ width, height }) as unknown as DOMRect;

describe('tour targets', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('builds data-tour selectors for every hook', () => {
    expect(tourSelector(TOUR_TARGET.profile)).toBe('[data-tour="profile"]');
    expect(tourSelector(TOUR_TARGET.privacyMode)).toBe(
      '[data-tour="privacy-mode"]',
    );
    expect(tourSelector(TOUR_TARGET.promptInput)).toBe(
      '[data-tour="prompt-input"]',
    );
    expect(tourSelector(TOUR_TARGET.conversationStarters)).toBe(
      '[data-tour="conversation-starters"]',
    );
    expect(tourSelector(TOUR_TARGET.agents)).toBe('[data-tour="agents"]');
    expect(tourSelector(TOUR_TARGET.account)).toBe('[data-tour="account"]');
  });

  describe('isBlockingDialogOpen', () => {
    it('is true while a dialog or alert dialog is open', () => {
      document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
      expect(isBlockingDialogOpen()).toBe(true);
      document.body.innerHTML =
        '<div role="alertdialog" data-state="open"></div>';
      expect(isBlockingDialogOpen()).toBe(true);
    });

    it('is false for closed dialogs or none at all', () => {
      expect(isBlockingDialogOpen()).toBe(false);
      document.body.innerHTML = '<div role="dialog" data-state="closed"></div>';
      expect(isBlockingDialogOpen()).toBe(false);
    });

    it('searches from a custom root', () => {
      const root = document.createElement('div');
      root.innerHTML = '<div role="dialog" data-state="open"></div>';
      expect(isBlockingDialogOpen(root)).toBe(true);
      expect(isBlockingDialogOpen()).toBe(false);
    });
  });

  describe('resolveTourTarget', () => {
    it('resolves a selector', () => {
      document.body.innerHTML = '<div data-tour="profile" id="p"></div>';
      expect(resolveTourTarget('[data-tour="profile"]')?.id).toBe('p');
    });

    it('calls a getter', () => {
      const el = document.createElement('div');
      expect(resolveTourTarget(() => el)).toBe(el);
      expect(resolveTourTarget(() => null)).toBeNull();
    });

    it('passes an element through', () => {
      const el = document.createElement('span');
      expect(resolveTourTarget(el)).toBe(el);
    });

    it('unwraps a ref', () => {
      const el = document.createElement('span');
      expect(resolveTourTarget({ current: el })).toBe(el);
      expect(resolveTourTarget({ current: null })).toBeNull();
    });
  });

  describe('isTourTargetVisible', () => {
    const mount = () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      return el;
    };

    it('is false when the target is missing', () => {
      expect(isTourTargetVisible('[data-tour="nope"]')).toBe(false);
    });

    it('is false when the element has no layout boxes (display: none)', () => {
      expect(isTourTargetVisible(mount())).toBe(false);
    });

    it('is false for an empty wrapper laid out at zero size', () => {
      const el = mount();
      vi.spyOn(el, 'getClientRects').mockReturnValue([
        rect(0, 0),
      ] as unknown as DOMRectList);
      expect(isTourTargetVisible(el)).toBe(false);
    });

    it('is true when the element has a visible box', () => {
      const el = mount();
      vi.spyOn(el, 'getClientRects').mockReturnValue([
        rect(32, 32),
      ] as unknown as DOMRectList);
      expect(isTourTargetVisible(el)).toBe(true);
    });
  });
});
