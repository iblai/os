import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

import { OfflineHomeGuard } from '@/components/offline-home-guard';

const mockReplace = vi.fn();
const mockPathname = vi.fn<() => string>();
const mockIsTauriApp = vi.fn<() => boolean>();
const mockGetLastMentorRoute = vi.fn<() => string | null>();
const mockToastInfo = vi.fn();
let swStatus: { isOnline: boolean };

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('sonner', () => ({
  toast: { info: (...args: unknown[]) => mockToastInfo(...args) },
}));

vi.mock('@/types/tauri', () => ({
  isTauriApp: () => mockIsTauriApp(),
}));

vi.mock('@/hooks/use-tauri-offline', () => ({
  getLastMentorRoute: () => mockGetLastMentorRoute(),
}));

vi.mock('@/components/service-worker-provider', () => ({
  useServiceWorker: () => ({ status: swStatus }),
}));

const HOME = '/platform/acme/ai-mentor';

describe('OfflineHomeGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauriApp.mockReturnValue(true);
    mockGetLastMentorRoute.mockReturnValue(HOME);
    swStatus = { isOnline: true };
  });

  it('does nothing while online', () => {
    swStatus = { isOnline: true };
    mockPathname.mockReturnValue('/platform/acme/other');
    render(<OfflineHomeGuard />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it('redirects to the cached home and toasts when offline off-home', () => {
    swStatus = { isOnline: false };
    mockPathname.mockReturnValue('/platform/acme/other');
    render(<OfflineHomeGuard />);
    expect(mockReplace).toHaveBeenCalledWith(HOME);
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
  });

  it('stays put when offline and already on the cached home', () => {
    swStatus = { isOnline: false };
    mockPathname.mockReturnValue(HOME);
    render(<OfflineHomeGuard />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it('does not redirect when there is no cached home route', () => {
    swStatus = { isOnline: false };
    mockGetLastMentorRoute.mockReturnValue(null);
    mockPathname.mockReturnValue('/platform/acme/other');
    render(<OfflineHomeGuard />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does nothing outside the Tauri app even when offline', () => {
    mockIsTauriApp.mockReturnValue(false);
    swStatus = { isOnline: false };
    mockPathname.mockReturnValue('/platform/acme/other');
    render(<OfflineHomeGuard />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
