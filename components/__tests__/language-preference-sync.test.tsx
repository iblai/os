import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { LanguagePreferenceSync } from '../language-preference-sync';

// --- controllable mock state -------------------------------------------------
let mockUsername: string | null = 'test-user';
let mockActiveLocale = 'en';
let mockUserMetadata: unknown = undefined;

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

// Override next-intl's useLocale (globally mocked to 'en' in setup) with a
// controllable value while keeping the rest of the global mock intact.
vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useLocale: () => mockActiveLocale,
  };
});

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockUseGetUserMetadataQuery = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserMetadataQuery: (...args: unknown[]) =>
    mockUseGetUserMetadataQuery(...args),
}));

const mockSyncLanguageCookies = vi.fn();
vi.mock('@/lib/locale-cookie', () => ({
  syncLanguageCookies: (...args: unknown[]) => mockSyncLanguageCookies(...args),
}));

describe('LanguagePreferenceSync', () => {
  beforeEach(() => {
    cleanup();
    mockUsername = 'test-user';
    mockActiveLocale = 'en';
    mockUserMetadata = undefined;
    mockRefresh.mockReset();
    mockSyncLanguageCookies.mockReset();
    mockUseGetUserMetadataQuery.mockReset();
    mockUseGetUserMetadataQuery.mockImplementation(() => ({
      data: mockUserMetadata,
    }));
  });

  it('renders nothing', () => {
    const { container } = render(<LanguagePreferenceSync />);
    expect(container.firstChild).toBeNull();
  });

  it('skips the metadata query when there is no username', () => {
    mockUsername = null;
    render(<LanguagePreferenceSync />);

    expect(mockUseGetUserMetadataQuery).toHaveBeenCalledWith(
      { params: { username: '' } },
      { skip: true },
    );
  });

  it('passes the username and enables the query when present', () => {
    render(<LanguagePreferenceSync />);
    expect(mockUseGetUserMetadataQuery).toHaveBeenCalledWith(
      { params: { username: 'test-user' } },
      { skip: false },
    );
  });

  it('does nothing when no stored language exists', () => {
    mockUserMetadata = { public_metadata: {} };
    render(<LanguagePreferenceSync />);

    expect(mockSyncLanguageCookies).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does nothing when the stored language matches the active locale', () => {
    mockActiveLocale = 'en';
    mockUserMetadata = { public_metadata: { language: 'en' } };
    render(<LanguagePreferenceSync />);

    expect(mockSyncLanguageCookies).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('syncs cookies and refreshes when the stored language differs', () => {
    mockActiveLocale = 'en';
    mockUserMetadata = { public_metadata: { language: 'fr' } };
    render(<LanguagePreferenceSync />);

    expect(mockSyncLanguageCookies).toHaveBeenCalledWith('fr');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('resolves Open edX style locale codes before comparing (zh-Hans -> zh)', () => {
    mockActiveLocale = 'zh';
    mockUserMetadata = { public_metadata: { language: 'zh-Hans' } };
    render(<LanguagePreferenceSync />);

    // zh-Hans resolves to zh which equals the active locale -> no sync.
    expect(mockSyncLanguageCookies).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not re-sync the same target locale on re-render (lastSyncedRef guard)', () => {
    mockActiveLocale = 'en';
    mockUserMetadata = { public_metadata: { language: 'fr' } };
    const { rerender } = render(<LanguagePreferenceSync />);

    expect(mockSyncLanguageCookies).toHaveBeenCalledTimes(1);

    // Force the effect to re-run with the same target by re-rendering. The
    // lastSyncedRef guard prevents a second sync to the same locale.
    rerender(<LanguagePreferenceSync />);
    expect(mockSyncLanguageCookies).toHaveBeenCalledTimes(1);
  });
});
