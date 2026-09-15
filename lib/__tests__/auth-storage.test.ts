import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isAuthKey,
  isPerTabAuthEnabled,
  getAuthItem,
  setAuthItem,
  removeAuthItem,
  clearPerTabSession,
} from '../auth-storage';

// Toggle the flag via the runtime __ENV__ the SDK/app read.
function setFlag(on: boolean) {
  (globalThis as { __ENV__?: Record<string, unknown> }).__ENV__ = {
    NEXT_PUBLIC_IBL_PER_TAB_AUTH: on ? 'true' : 'false',
  };
}

describe('auth-storage (app-local per-tab policy)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setFlag(false);
  });

  afterEach(() => {
    delete (globalThis as { __ENV__?: unknown }).__ENV__;
  });

  it('isAuthKey covers the mirrored keys and rejects others', () => {
    expect(isAuthKey('dm_token')).toBe(true);
    expect(isAuthKey('current_tenant')).toBe(true);
    expect(isAuthKey('redirect-to')).toBe(false);
  });

  it('isPerTabAuthEnabled reflects the runtime flag', () => {
    setFlag(false);
    expect(isPerTabAuthEnabled()).toBe(false);
    setFlag(true);
    expect(isPerTabAuthEnabled()).toBe(true);
  });

  describe('flag OFF — plain localStorage passthrough', () => {
    it('get/set/remove only touch localStorage', () => {
      setAuthItem('dm_token', 'tok');
      expect(window.localStorage.getItem('dm_token')).toBe('tok');
      expect(window.sessionStorage.getItem('dm_token')).toBeNull();
      expect(getAuthItem('dm_token')).toBe('tok');
      removeAuthItem('dm_token');
      expect(window.localStorage.getItem('dm_token')).toBeNull();
    });
  });

  describe('flag ON — sessionStorage is the source of truth', () => {
    beforeEach(() => setFlag(true));

    it('setAuthItem writes both session (truth) and localStorage (seed) for auth keys', () => {
      setAuthItem('dm_token', 'tok');
      expect(window.sessionStorage.getItem('dm_token')).toBe('tok');
      expect(window.localStorage.getItem('dm_token')).toBe('tok');
    });

    it('non-auth keys still pass straight through to localStorage', () => {
      setAuthItem('redirect-to', '/x');
      expect(window.localStorage.getItem('redirect-to')).toBe('/x');
      expect(window.sessionStorage.getItem('redirect-to')).toBeNull();
    });

    it('getAuthItem is session-first with a localStorage seed fallback', () => {
      window.localStorage.setItem('tenant', 'seed-tenant');
      expect(getAuthItem('tenant')).toBe('seed-tenant');
      window.sessionStorage.setItem('tenant', 'tab-tenant');
      expect(getAuthItem('tenant')).toBe('tab-tenant');
    });

    it('removeAuthItem clears both stores for auth keys', () => {
      setAuthItem('dm_token', 'tok');
      removeAuthItem('dm_token');
      expect(window.sessionStorage.getItem('dm_token')).toBeNull();
      expect(window.localStorage.getItem('dm_token')).toBeNull();
    });

    it('clearPerTabSession clears this tab session but keeps the seed by default', () => {
      setAuthItem('dm_token', 'tok');
      setAuthItem('tenant', 'acme');
      clearPerTabSession();
      expect(window.sessionStorage.getItem('dm_token')).toBeNull();
      expect(window.sessionStorage.getItem('tenant')).toBeNull();
      expect(window.localStorage.getItem('dm_token')).toBe('tok');
      expect(window.localStorage.getItem('tenant')).toBe('acme');
    });

    it('clearPerTabSession also clears the seed only when its tenant matches', () => {
      setAuthItem('dm_token', 'tok');
      setAuthItem('tenant', 'acme');
      clearPerTabSession({ clearSeedIfTenant: 'acme' });
      expect(window.localStorage.getItem('dm_token')).toBeNull();
      expect(window.localStorage.getItem('tenant')).toBeNull();
    });

    it('clearPerTabSession leaves a sibling-tenant seed intact', () => {
      setAuthItem('tenant', 'acme');
      clearPerTabSession({ clearSeedIfTenant: 'other-tenant' });
      expect(window.localStorage.getItem('tenant')).toBe('acme');
    });
  });
});
