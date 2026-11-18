import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  coworkConsentGiven,
  coworkEnabled,
  coworkPermissionAsked,
  coworkSetupPending,
  COWORK_SETUP_RESUME_WINDOW_MS,
  markCoworkPermissionAsked,
  readCoworkApprovals,
  writeCoworkApprovals,
  writeCoworkConsent,
  writeCoworkSetupPending,
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

describe('cowork setup pending', () => {
  it('is off until a setup is left waiting on a grant', () => {
    expect(coworkSetupPending()).toBe(false);
  });

  it('survives a relaunch and is forgotten once cleared', () => {
    writeCoworkSetupPending(true, 1_000);
    expect(window.localStorage.getItem('ibl_cowork_setup_pending')).toBe(
      'true',
    );
    expect(window.localStorage.getItem('ibl_cowork_setup_pending_at')).toBe(
      '1000',
    );
    expect(coworkSetupPending(1_000 + COWORK_SETUP_RESUME_WINDOW_MS)).toBe(
      true,
    );

    writeCoworkSetupPending(false);
    expect(window.localStorage.getItem('ibl_cowork_setup_pending')).toBeNull();
    expect(
      window.localStorage.getItem('ibl_cowork_setup_pending_at'),
    ).toBeNull();
    expect(coworkSetupPending()).toBe(false);
  });

  it('is forgotten once the user last acted on it more than ten minutes ago', () => {
    // The relaunch takes seconds. Beyond the window a setup abandoned mid-way
    // must not reopen on every launch, nor switch Cowork on by itself once the
    // grants happen to be held.
    writeCoworkSetupPending(true, 1_000);
    expect(coworkSetupPending(1_000 + COWORK_SETUP_RESUME_WINDOW_MS + 1)).toBe(
      false,
    );
    writeCoworkSetupPending(true, 2_000);
    expect(coworkSetupPending(1_000 + COWORK_SETUP_RESUME_WINDOW_MS + 1)).toBe(
      true,
    );
  });

  it('does not treat the flag alone, with no stamp, as a pending setup', () => {
    window.localStorage.setItem('ibl_cowork_setup_pending', 'true');
    expect(coworkSetupPending()).toBe(false);
    window.localStorage.setItem('ibl_cowork_setup_pending_at', 'soon');
    expect(coworkSetupPending()).toBe(false);
  });

  it('reads unusable storage as nothing pending, and swallows a blocked write', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeCoworkSetupPending(true)).not.toThrow();
    expect(coworkSetupPending()).toBe(false);
  });
});

describe('cowork consent', () => {
  it('is not given until the user turns Cowork on from the explanation', () => {
    expect(coworkConsentGiven()).toBe(false);
  });

  it('is remembered once given', () => {
    writeCoworkConsent();
    expect(window.localStorage.getItem('ibl_cowork_consent')).toBe('true');
    expect(coworkConsentGiven()).toBe(true);
  });

  it('reads anything but the saved value as not given', () => {
    window.localStorage.setItem('ibl_cowork_consent', 'yes');
    expect(coworkConsentGiven()).toBe(false);
  });

  it('reads unusable storage as not given, and swallows a blocked write', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeCoworkConsent()).not.toThrow();
    expect(coworkConsentGiven()).toBe(false);
  });
});

describe('cowork permission asked', () => {
  it('starts with neither grant asked for', () => {
    expect(coworkPermissionAsked('accessibility')).toBe(false);
    expect(coworkPermissionAsked('screen_recording')).toBe(false);
  });

  it('remembers each grant on its own', () => {
    markCoworkPermissionAsked('accessibility');
    expect(
      window.localStorage.getItem('ibl_cowork_permission_asked_accessibility'),
    ).toBe('true');
    expect(coworkPermissionAsked('accessibility')).toBe(true);
    expect(coworkPermissionAsked('screen_recording')).toBe(false);

    markCoworkPermissionAsked('screen_recording');
    expect(
      window.localStorage.getItem(
        'ibl_cowork_permission_asked_screen_recording',
      ),
    ).toBe('true');
    expect(coworkPermissionAsked('screen_recording')).toBe(true);
  });

  it('reads unusable storage as never asked, and swallows a blocked write', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markCoworkPermissionAsked('accessibility')).not.toThrow();
    expect(coworkPermissionAsked('accessibility')).toBe(false);
  });
});

describe('coworkEnabled', () => {
  it('is on only for the SDK pill’s explicit "true"', () => {
    expect(coworkEnabled()).toBe(false);
    window.localStorage.setItem('ibl_cowork_enabled', 'false');
    expect(coworkEnabled()).toBe(false);
    window.localStorage.setItem('ibl_cowork_enabled', 'true');
    expect(coworkEnabled()).toBe(true);
  });

  it('reads unusable storage as off', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(coworkEnabled()).toBe(false);
  });
});
