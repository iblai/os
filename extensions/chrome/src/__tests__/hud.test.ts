import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEAT_MS, BRAND, doingLine, startHud, WATCHDOG_MS } from '../hud';
import { OVERLAY_ATTR } from '../page-scripts';
import { markTab, unmarkTab } from '../tab-group';
import { installChromeStub, type ChromeStub } from './chrome.stub';

let chromeStub: ChromeStub;

const host = () => document.querySelector(`[${OVERLAY_ATTR}]`);
const injected = (name: string) =>
  chromeStub.stub.scripting.executeScript.mock.calls.filter(
    ([call]) => (call as { func: { name: string } }).func.name === name,
  );

beforeEach(() => {
  document.body.innerHTML = '<main><h1>Billing</h1></main>';
  chromeStub = installChromeStub();
});

afterEach(() => {
  host()?.remove();
  vi.useRealTimers();
});

describe('the brand colour', () => {
  it('is the one the side panel paints with', () => {
    // Two files, one colour: the panel and the page a run is driving must not
    // drift apart.
    // Read, not imported: vitest serves a stylesheet import as an empty
    // string, which would make this assertion pass for the wrong reason.
    const css = readFileSync(
      resolve(process.cwd(), 'extensions/chrome/src/panel.css'),
      'utf-8',
    );
    expect(css).toContain(`--primary: ${BRAND}`);
  });
});

describe('doingLine', () => {
  it('names the action in the present tense, with its target', () => {
    // The panel's own list is written after the fact and stays in the past
    // tense; the bar says what is happening now.
    expect(doingLine('click', '[12] button "Continue"')).toBe(
      'Clicking [12] button "Continue"',
    );
    expect(doingLine('read_page', '')).toBe('Reading this page');
  });

  it('falls back for a tool with no wording of its own', () => {
    expect(doingLine('click_at', '(10, 20)')).toBe('Working on this page');
  });
});

describe('startHud', () => {
  it('puts the overlay on the page, in the top frame only', async () => {
    const hud = startHud(7);
    await vi.waitFor(() => expect(host()).not.toBeNull());
    const [call] = injected('mountHud')[0] as [
      { target: { frameIds: number[] } },
    ];
    expect(call.target.frameIds).toEqual([0]);
    await hud.stop();
  });

  it('keeps beating, which is what puts it back after a navigation', async () => {
    vi.useFakeTimers();
    const hud = startHud(7);
    await vi.advanceTimersByTimeAsync(0);
    expect(injected('mountHud')).toHaveLength(1);
    // A navigation takes the overlay with the document; the next beat is what
    // brings it back, with no navigation event to listen for.
    host()?.remove();
    await vi.advanceTimersByTimeAsync(2500);
    expect(host()).not.toBeNull();
    expect(injected('mountHud').length).toBeGreaterThan(1);
    await hud.stop();
  });

  it('asks for a watchdog longer than its own beat', () => {
    // Otherwise the overlay clears itself between two healthy beats.
    expect(WATCHDOG_MS).toBeGreaterThan(BEAT_MS * 2);
  });

  it('takes the overlay down and stops beating', async () => {
    vi.useFakeTimers();
    const hud = startHud(7);
    await vi.advanceTimersByTimeAsync(0);
    await hud.stop();
    expect(host()).toBeNull();
    const beats = injected('mountHud').length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(injected('mountHud')).toHaveLength(beats);
  });

  it('says what is happening, and rings the element it is about to touch', async () => {
    const hud = startHud(7);
    await vi.waitFor(() => expect(host()).not.toBeNull());
    hud.say('click', '[3] button "Pay"', { x: 10, y: 20, w: 30, h: 40 });
    await vi.waitFor(() => {
      const [options] = injected('mountHud').at(-1)![0].args as [
        { status: string; target: unknown },
      ];
      expect(options.status).toBe('Clicking [3] button "Pay"');
      expect(options.target).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    });
    hud.thinking();
    await vi.waitFor(() => {
      const [options] = injected('mountHud').at(-1)![0].args as [
        { status: string; target: unknown },
      ];
      expect(options.status).toBe('Working on this page');
      expect(options.target).toBeNull();
    });
    await hud.stop();
  });

  it('never lets a failed injection end a run', async () => {
    chromeStub.stub.scripting.executeScript.mockRejectedValue(
      new Error('Frame was removed.'),
    );
    const hud = startHud(7);
    hud.say('click', '[1] button "Go"');
    await expect(hud.away(async () => 'captured')).resolves.toBe('captured');
    await expect(hud.stop()).resolves.toBeUndefined();
  });

  describe('getting out of the way', () => {
    it('hides for a capture and puts itself back', async () => {
      const hud = startHud(7);
      await vi.waitFor(() => expect(host()).not.toBeNull());
      const seen: (string | undefined)[] = [];
      await hud.away(async () => {
        seen.push((host() as HTMLElement).style.display);
      });
      expect(seen).toEqual(['none']);
      expect((host() as HTMLElement).style.display).toBe('');
      await hud.stop();
    });

    it('leaves the overlay alone for a click it is not over', async () => {
      const hud = startHud(7);
      await vi.waitFor(() => expect(host()).not.toBeNull());
      // jsdom lays nothing out: the bar's box is zero-sized at the origin.
      await hud.dodge({ x: 400, y: 400 }, async () => {
        expect((host() as HTMLElement).style.display).toBe('');
      });
      await hud.stop();
    });

    it('steps aside for a click that would land on it', async () => {
      const hud = startHud(7);
      await vi.waitFor(() => expect(host()).not.toBeNull());
      await hud.dodge({ x: 0, y: 0 }, async () => {
        // A trusted click lands on whatever is at the point; the bar must
        // never be what it lands on.
        expect((host() as HTMLElement).style.display).toBe('none');
      });
      expect((host() as HTMLElement).style.display).toBe('');
      await hud.stop();
    });

    it('puts itself back even when the action throws', async () => {
      const hud = startHud(7);
      await vi.waitFor(() => expect(host()).not.toBeNull());
      await expect(
        hud.away(async () => {
          throw new Error('click failed');
        }),
      ).rejects.toThrow('click failed');
      expect((host() as HTMLElement).style.display).toBe('');
      await hud.stop();
    });
  });

  describe('the tab-strip marker', () => {
    it('groups the driven tab, named and in the brand colour', async () => {
      const hud = startHud(7);
      await vi.waitFor(() => expect(chromeStub.grouped.get(7)).toBeDefined());
      const groupId = chromeStub.grouped.get(7)!;
      expect(chromeStub.groups.get(groupId)).toEqual({
        title: 'ibl.ai',
        color: 'blue',
      });
      await hud.stop();
      expect(chromeStub.grouped.has(7)).toBe(false);
    });

    it('ungroups a tab grouped while the run was already ending', async () => {
      const hud = startHud(7);
      // Nothing awaited: the marking is still in flight when the run ends.
      await hud.stop();
      await vi.waitFor(() => expect(chromeStub.grouped.has(7)).toBe(false));
    });
  });
});

describe('markTab', () => {
  it('leaves a tab the user has already grouped alone', async () => {
    chromeStub.grouped.set(7, 42);
    expect(await markTab(7)).toBeNull();
    // Their window, their arrangement: moving the tab out to mark it, and
    // failing to put it back exactly, is worse than having no marker.
    expect(chromeStub.stub.tabs.group).not.toHaveBeenCalled();
    expect(chromeStub.grouped.get(7)).toBe(42);
  });

  it('is a courtesy, never a reason a run cannot start', async () => {
    chromeStub.stub.tabs.group.mockRejectedValue(new Error('no'));
    expect(await markTab(7)).toBeNull();
  });
});

describe('unmarkTab', () => {
  it('does nothing for a tab that has moved to another group', async () => {
    const mark = await markTab(7);
    chromeStub.grouped.set(7, 999);
    await unmarkTab(mark);
    // The user dragged it somewhere; ungrouping it now would be our doing.
    expect(chromeStub.stub.tabs.ungroup).not.toHaveBeenCalled();
    expect(chromeStub.grouped.get(7)).toBe(999);
  });

  it('does nothing when there was never a mark', async () => {
    await unmarkTab(null);
    expect(chromeStub.stub.tabs.ungroup).not.toHaveBeenCalled();
  });
});
