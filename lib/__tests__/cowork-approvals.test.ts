import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coworkPrefSet,
  readCoworkApprovals,
  writeCoworkApprovals,
} from '@/lib/cowork-approvals';

const KEY = 'ibl_cowork_approvals';
const ENABLED_KEY = 'ibl_cowork_enabled';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('cowork approvals', () => {
  it('defaults to auto when nothing has been chosen', () => {
    expect(readCoworkApprovals()).toBe('auto');
  });

  it('round-trips a choice', () => {
    writeCoworkApprovals('manual');
    expect(readCoworkApprovals()).toBe('manual');
    writeCoworkApprovals('auto');
    expect(readCoworkApprovals()).toBe('auto');
  });

  // A half-written or tampered value must not leave the user in a mode they
  // never picked.
  it('reads anything unrecognised as auto', () => {
    window.localStorage.setItem(KEY, 'MANUAL');
    expect(readCoworkApprovals()).toBe('auto');
    window.localStorage.setItem(KEY, '');
    expect(readCoworkApprovals()).toBe('auto');
  });

  it('survives storage being unavailable', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readCoworkApprovals()).toBe('auto');
    expect(() => writeCoworkApprovals('manual')).not.toThrow();
  });
});

// The extension panel defaults Cowork ON, so it has to tell "never chosen" from
// "switched off" — which `isCoworkEnabled()` alone cannot.
describe('coworkPrefSet', () => {
  it('is false until Cowork has been switched either way', () => {
    expect(coworkPrefSet()).toBe(false);
  });

  it('is true for an explicit off as much as an explicit on', () => {
    window.localStorage.setItem(ENABLED_KEY, 'false');
    expect(coworkPrefSet()).toBe(true);
    window.localStorage.setItem(ENABLED_KEY, 'true');
    expect(coworkPrefSet()).toBe(true);
  });

  it('reads unusable storage as unset, so the default still applies', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(coworkPrefSet()).toBe(false);
  });
});
