import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settle, sleep } from '../settle';
import { installChromeStub, type ChromeStub } from './chrome.stub';

let chromeStub: ChromeStub;

beforeEach(() => {
  vi.useFakeTimers();
  chromeStub = installChromeStub();
});

afterEach(() => vi.useRealTimers());

describe('sleep', () => {
  it('resolves after the delay', async () => {
    const promise = sleep(50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('settle', () => {
  it('waits out the grace period on a page that never navigates, then waits for quiet', async () => {
    const promise = settle(7, { graceMs: 300, quietMs: 10, capMs: 100 });
    await vi.advanceTimersByTimeAsync(400);
    await promise;
    expect(chromeStub.stub.tabs.get.mock.calls.length).toBeGreaterThanOrEqual(
      3,
    );
    const [{ func, args }] = chromeStub.stub.scripting.executeScript.mock
      .calls[0] as [{ func: { name: string }; args: unknown[] }];
    expect(func.name).toBe('waitForQuiet');
    expect(args).toEqual([10, 100]);
  });

  it('follows a navigation from loading to complete', async () => {
    const statuses = ['loading', 'loading', 'complete'];
    chromeStub.stub.tabs.get.mockImplementation(async (id: number) => ({
      id,
      url: 'https://app.acme.com/next',
      status: statuses.shift() ?? 'complete',
    }));
    const promise = settle(7, { quietMs: 10, capMs: 50 });
    await vi.advanceTimersByTimeAsync(300);
    await promise;
    expect(chromeStub.stub.tabs.get).toHaveBeenCalledTimes(3);
  });

  it('gives up on a navigation that never completes', async () => {
    chromeStub.stub.tabs.get.mockResolvedValue({
      id: 7,
      url: 'x',
      status: 'loading',
    });
    const promise = settle(7, { navMs: 500, quietMs: 10, capMs: 50 });
    await vi.advanceTimersByTimeAsync(700);
    await promise;
    expect(chromeStub.stub.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('swallows an injection that fails mid-navigation', async () => {
    chromeStub.stub.scripting.executeScript.mockRejectedValueOnce(
      new Error('frame gone'),
    );
    const promise = settle(7, { graceMs: 0, quietMs: 10, capMs: 50 });
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();
  });
});
