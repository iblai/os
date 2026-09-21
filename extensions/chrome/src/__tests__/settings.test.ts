import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiBases,
  completionsBase,
  DEFAULT_SETTINGS,
  injectable,
  loadSettings,
  MENTOR_URL,
  PLATFORM_DOMAIN,
  saveSettings,
} from '../settings';
import { installChromeStub, type ChromeStub } from './chrome.stub';

let chromeStub: ChromeStub;

beforeEach(() => {
  chromeStub = installChromeStub();
});

describe('settings storage', () => {
  it('holds the cached model and what it was picked under, both empty', async () => {
    expect(DEFAULT_SETTINGS).toEqual({ model: '', preference: '' });
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips the model the first run caches', async () => {
    const saved = await saveSettings({
      model: 'openai/gpt-5',
      preference: 'iblai/iblai-pro',
    });
    expect(saved).toEqual({
      model: 'openai/gpt-5',
      preference: 'iblai/iblai-pro',
    });
    await expect(loadSettings()).resolves.toEqual({
      model: 'openai/gpt-5',
      preference: 'iblai/iblai-pro',
    });
    expect(chromeStub.stub.storage.local.set).toHaveBeenCalledTimes(1);
  });

  // An install that ran before `preference` existed stores only `model`; the
  // spread over DEFAULT_SETTINGS is what keeps that readable.
  it('reads an older stored object without the preference', async () => {
    await chromeStub.stub.storage.local.set({
      browse: { model: 'openai/gpt-5' },
    });
    await expect(loadSettings()).resolves.toEqual({
      model: 'openai/gpt-5',
      preference: '',
    });
  });
});

describe('the mentor url', () => {
  // A build with no .env.local is the release build — this is what CI ships.
  it('defaults to the official app', () => {
    expect(MENTOR_URL).toBe('https://os.ibl.ai');
  });

  it('takes VITE_MENTOR_URL from the build environment', async () => {
    vi.stubEnv('VITE_MENTOR_URL', 'http://localhost:3000');
    vi.resetModules();
    const { MENTOR_URL: overridden } = await import('../settings');
    expect(overridden).toBe('http://localhost:3000');
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe('host derivation', () => {
  it('streams completions from the ASGI host', () => {
    expect(completionsBase()).toBe(`https://asgi.data.${PLATFORM_DOMAIN}`);
  });

  // The REST endpoints answer on the DM base, not the streaming host, and which
  // spelling a deployment uses is not knowable up front — so try all of them.
  it('lists the REST candidates in the order the desktop app tries them', () => {
    expect(apiBases()).toEqual([
      `https://base.manager.${PLATFORM_DOMAIN}`,
      `https://api.${PLATFORM_DOMAIN}/dm`,
      `https://asgi.data.${PLATFORM_DOMAIN}`,
    ]);
  });
});

describe('injectable', () => {
  it('accepts http(s) pages only', () => {
    expect(injectable('https://acme.com/x')).toBe(true);
    expect(injectable('http://localhost:3000')).toBe(true);
  });

  // Not policy: chrome.scripting throws on these, so the check turns a thrown
  // injection error into a refusal the model can act on.
  it('refuses schemes chrome.scripting cannot inject into', () => {
    expect(injectable('chrome://extensions')).toBe(false);
    expect(injectable('chrome-extension://abc/panel.html')).toBe(false);
    expect(injectable('file:///tmp/x.pdf')).toBe(false);
    expect(injectable('view-source:https://acme.com')).toBe(false);
    expect(injectable(undefined)).toBe(false);
    expect(injectable('nope')).toBe(false);
  });
});
