import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readCoworkApprovals,
  writeCoworkApprovals,
} from '@/lib/cowork-approvals';

const KEY = 'ibl_cowork_approvals';

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
