import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

import { OfflineNavigationGuard } from '@/components/offline-navigation-guard';

const mockIsTauriApp = vi.fn<() => boolean>();
const mockToastInfo = vi.fn();
let swStatus: { isOnline: boolean };

vi.mock('sonner', () => ({
  toast: { info: (...args: unknown[]) => mockToastInfo(...args) },
}));
vi.mock('@/types/tauri', () => ({ isTauriApp: () => mockIsTauriApp() }));
vi.mock('@/components/service-worker-provider', () => ({
  useServiceWorker: () => ({ status: swStatus }),
}));

// Minimal fake of the Navigation API.
function installNavigation() {
  const handlers: Array<(e: unknown) => void> = [];
  const nav = {
    addEventListener: (_t: string, cb: (e: unknown) => void) =>
      handlers.push(cb),
    removeEventListener: (_t: string, cb: (e: unknown) => void) => {
      const i = handlers.indexOf(cb);
      if (i >= 0) handlers.splice(i, 1);
    },
    dispatch: (e: unknown) => handlers.forEach((h) => h(e)),
  };
  (window as unknown as { navigation?: unknown }).navigation = nav;
  return nav;
}

describe('OfflineNavigationGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauriApp.mockReturnValue(true);
    swStatus = { isOnline: true };
    delete (window as unknown as { navigation?: unknown }).navigation;
  });
  afterEach(() => {
    delete (window as unknown as { navigation?: unknown }).navigation;
  });

  describe('Navigation API (catches router.push)', () => {
    it('blocks push navigation and toasts when offline', () => {
      const nav = installNavigation();
      swStatus = { isOnline: false };
      render(<OfflineNavigationGuard />);
      const preventDefault = vi.fn();
      nav.dispatch({
        navigationType: 'push',
        cancelable: true,
        preventDefault,
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(mockToastInfo).toHaveBeenCalledTimes(1);
    });

    it('allows navigation when online', () => {
      const nav = installNavigation();
      swStatus = { isOnline: true };
      render(<OfflineNavigationGuard />);
      const preventDefault = vi.fn();
      nav.dispatch({
        navigationType: 'push',
        cancelable: true,
        preventDefault,
      });
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('allows a reload even when offline (cached page)', () => {
      const nav = installNavigation();
      swStatus = { isOnline: false };
      render(<OfflineNavigationGuard />);
      const preventDefault = vi.fn();
      nav.dispatch({
        navigationType: 'reload',
        cancelable: true,
        preventDefault,
      });
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('does nothing outside the Tauri app', () => {
      const nav = installNavigation();
      mockIsTauriApp.mockReturnValue(false);
      swStatus = { isOnline: false };
      render(<OfflineNavigationGuard />);
      const preventDefault = vi.fn();
      nav.dispatch({
        navigationType: 'push',
        cancelable: true,
        preventDefault,
      });
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('anchor fallback (no Navigation API)', () => {
    it('blocks an in-app anchor click when offline', () => {
      swStatus = { isOnline: false };
      render(<OfflineNavigationGuard />);
      const a = document.createElement('a');
      a.setAttribute('href', '/platform/acme/other');
      document.body.appendChild(a);
      const notPrevented = a.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      expect(notPrevented).toBe(false); // preventDefault was called
      expect(mockToastInfo).toHaveBeenCalled();
      a.remove();
    });

    it('lets external / new-tab links through', () => {
      swStatus = { isOnline: false };
      render(<OfflineNavigationGuard />);
      const a = document.createElement('a');
      a.setAttribute('href', 'https://external.example.com');
      a.target = '_blank';
      document.body.appendChild(a);
      const notPrevented = a.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      expect(notPrevented).toBe(true);
      a.remove();
    });
  });
});
