import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock dependencies
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  SsoLogin: vi.fn(({ localStorageKeys, redirectPathKey, defaultRedirectPath }) => (
    <div data-testid="sso-login-component">
      <div data-testid="local-storage-keys">{JSON.stringify(localStorageKeys)}</div>
      <div data-testid="redirect-path-key">{redirectPathKey}</div>
      <div data-testid="default-redirect-path">{defaultRedirectPath}</div>
    </div>
  )),
}));

vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: {
    CURRENT_TENANT: 'currentTenant',
    USER_DATA: 'userData',
    TENANTS: 'tenants',
    AXD_TOKEN_KEY: 'axd_token',
    DM_TOKEN_KEY: 'dm_token',
    DM_TOKEN_EXPIRY: 'dm_token_expires',
    EDX_TOKEN_KEY: 'edx_jwt_token',
  },
}));

// Import after mocks
const SsoLoginModule = await import('../page');
const SsoLogin = SsoLoginModule.default;

describe('sso-login page', () => {
  it('should export dynamic config', () => {
    expect(SsoLoginModule.dynamic).toBe('force-dynamic');
  });

  it('should render SsoLogin component', () => {
    render(<SsoLogin />);
    expect(screen.getByTestId('sso-login-component')).toBeInTheDocument();
  });

  it('should pass correct localStorage keys to SsoLogin component', () => {
    render(<SsoLogin />);

    const localStorageKeysElement = screen.getByTestId('local-storage-keys');
    const localStorageKeys = JSON.parse(localStorageKeysElement.textContent || '{}');

    expect(localStorageKeys).toEqual({
      CURRENT_TENANT: 'currentTenant',
      USER_DATA: 'userData',
      TENANTS: 'tenants',
      AXD_TOKEN: 'axd_token',
      AXD_TOKEN_EXPIRES: 'axd_token',
      DM_TOKEN: 'dm_token',
      DM_TOKEN_EXPIRES: 'dm_token_expires',
      EDX_TOKEN_KEY: 'edx_jwt_token',
    });
  });

  it('should pass correct redirectPathKey', () => {
    render(<SsoLogin />);
    expect(screen.getByTestId('redirect-path-key')).toHaveTextContent('redirect-to');
  });

  it('should pass correct defaultRedirectPath', () => {
    render(<SsoLogin />);
    expect(screen.getByTestId('default-redirect-path')).toHaveTextContent('/');
  });
});
