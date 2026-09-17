import { beforeEach, describe, expect, it } from 'vitest';
import { t, userLanguage } from '../i18n';
import { installChromeStub, type ChromeStub } from './chrome.stub';

let chromeStub: ChromeStub;

beforeEach(() => {
  chromeStub = installChromeStub();
});

describe('t', () => {
  it('returns the localized message with substitutions', () => {
    expect(t('signIn')).toBe('Sign in');
    expect(t('hostBlocked', 'chrome://extensions/')).toBe(
      'chrome://extensions/ is not an http or https page, so it cannot be driven.',
    );
    expect(t('errorGeneric', ['boom'])).toBe('Something went wrong: boom');
  });

  it('falls back to the key when the catalogue has no entry', () => {
    expect(t('missingKey')).toBe('missingKey');
  });
});

// The language the agent answers in, which is NOT the one `t()` resolves
// against: Accept-Language is what the user asked the web to talk to them in,
// `getUILanguage` is the language of the browser's own chrome.
describe('userLanguage', () => {
  it('prefers the first accept language', async () => {
    await expect(userLanguage()).resolves.toBe('en-GB');
  });

  it('falls back to the UI language when the list is empty', async () => {
    chromeStub.stub.i18n.getAcceptLanguages.mockResolvedValueOnce([]);
    await expect(userLanguage()).resolves.toBe('en-US');
  });

  it('falls back to the UI language when the call fails', async () => {
    chromeStub.stub.i18n.getAcceptLanguages.mockRejectedValueOnce(
      new Error('no'),
    );
    await expect(userLanguage()).resolves.toBe('en-US');
  });
});
