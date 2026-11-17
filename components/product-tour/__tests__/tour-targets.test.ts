import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import {
  isBlockingDialogOpen,
  isTourTargetVisible,
  resolvePromptInputTarget,
  resolveTourTarget,
  TARGET_SETTLE_FRAMES,
  TOUR_TARGET,
  tourSelector,
  watchTourTargetMoves,
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

  describe('resolvePromptInputTarget', () => {
    it('prefers an explicit data-tour hook', () => {
      document.body.innerHTML =
        '<div data-tour="prompt-input" id="hook"></div><div><textarea></textarea><button></button></div>';
      expect(resolvePromptInputTarget()?.id).toBe('hook');
    });

    it('falls back to the composer card holding the textarea and its buttons', () => {
      document.body.innerHTML =
        '<section id="page"><div id="card"><div><textarea></textarea></div><div><button></button></div></div></section>';
      expect(resolvePromptInputTarget()?.id).toBe('card');
    });

    it('returns null when no composer is mounted', () => {
      document.body.innerHTML = '<div></div>';
      expect(resolvePromptInputTarget()).toBeNull();
    });
  });

  describe('watchTourTargetMoves', () => {
    let frames: Map<number, FrameRequestCallback>;
    let nextFrameId: number;
    let top: number;

    const flushMutations = () => new Promise((resolve) => setTimeout(resolve));
    const runFrame = () => {
      const [id, callback] = frames.entries().next().value ?? [];
      if (id === undefined || !callback) return false;
      frames.delete(id);
      callback(0);
      return true;
    };
    const runAllFrames = () => {
      while (runFrame());
    };

    beforeEach(() => {
      frames = new Map();
      nextFrameId = 1;
      top = 580;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frames.set(nextFrameId, cb);
        return nextFrameId++;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
      document.body.innerHTML = '<div id="page"><div id="input"></div></div>';
      vi.spyOn(
        document.getElementById('input')!,
        'getBoundingClientRect',
      ).mockImplementation(
        () => ({ top, left: 670, width: 650, height: 110 }) as DOMRect,
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const startersLoad = () => {
      const starters = document.createElement('div');
      starters.id = 'starters';
      document.getElementById('page')!.appendChild(starters);
    };

    it('reports a target pushed aside, without resizing, by content mounting next to it', async () => {
      const onMove = vi.fn();
      const stop = watchTourTargetMoves(['#input'], onMove);

      top = 510;
      startersLoad();
      await flushMutations();
      runAllFrames();

      expect(onMove).toHaveBeenCalledTimes(1);
      stop();
    });

    it('stays quiet when the DOM changes but no target moves', async () => {
      const onMove = vi.fn();
      const stop = watchTourTargetMoves(['#input'], onMove);

      startersLoad();
      await flushMutations();
      runAllFrames();

      expect(onMove).not.toHaveBeenCalled();
      stop();
    });

    it('follows a move that animates in, then goes idle once it settles', async () => {
      const onMove = vi.fn();
      const stop = watchTourTargetMoves(['#input'], onMove);

      startersLoad();
      await flushMutations();
      for (const step of [560, 540, 520, 510]) {
        top = step;
        runFrame();
      }
      expect(onMove).toHaveBeenCalledTimes(4);

      for (let i = 0; i < TARGET_SETTLE_FRAMES; i += 1) runFrame();
      expect(frames.size).toBe(0);
      stop();
    });

    it('stops watching once cleaned up', async () => {
      const onMove = vi.fn();
      const stop = watchTourTargetMoves(['#input'], onMove);
      stop();

      top = 510;
      startersLoad();
      await flushMutations();
      runAllFrames();

      expect(onMove).not.toHaveBeenCalled();
    });
  });
});
