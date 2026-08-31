import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useHelpCenter } from '../use-help-center';

let mockMetadata: Record<string, unknown> | undefined;
const mockUseTenantMetadata = vi.fn();
const mockAddProtocolToUrl = vi.fn((url: string) =>
  url.startsWith('http') ? url : `https://${url}`,
);

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: (args: { org: string }) => mockUseTenantMetadata(args),
  addProtocolToUrl: (url: string) => mockAddProtocolToUrl(url),
}));

let mockConfigHelpCenterUrl = 'https://docs.example.com';
let mockConfigSupportEmail = 'support@example.com';
let mockConfigDocumentationUrl = 'https://ibl.ai/docs';

vi.mock('@/lib/config', () => ({
  config: {
    helpCenterUrl: () => mockConfigHelpCenterUrl,
    supportEmail: () => mockConfigSupportEmail,
    documentationUrl: () => mockConfigDocumentationUrl,
  },
}));

describe('useHelpCenter', () => {
  beforeEach(() => {
    mockMetadata = undefined;
    mockConfigHelpCenterUrl = 'https://docs.example.com';
    mockConfigSupportEmail = 'support@example.com';
    mockConfigDocumentationUrl = 'https://ibl.ai/docs';
    mockUseTenantMetadata.mockReset();
    mockUseTenantMetadata.mockImplementation(() => ({
      metadata: mockMetadata,
    }));
    mockAddProtocolToUrl.mockClear();
  });

  describe('tenant lookup', () => {
    it('queries tenant metadata for the given tenant key', () => {
      renderHook(() => useHelpCenter('acme'));
      expect(mockUseTenantMetadata).toHaveBeenCalledWith({ org: 'acme' });
    });

    it('passes an empty org when no tenant key is supplied', () => {
      renderHook(() => useHelpCenter());
      expect(mockUseTenantMetadata).toHaveBeenCalledWith({ org: '' });
    });
  });

  describe('helpCenterUrl', () => {
    it('prefers the tenant support_url over every other source', () => {
      mockMetadata = {
        support_url: 'https://ibl.ai/support',
        help_center_url: 'https://help.acme.edu',
      };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://ibl.ai/support');
    });

    it('falls back to help_center_url when support_url is absent', () => {
      mockMetadata = { help_center_url: 'https://help.acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://help.acme.edu');
    });

    it('falls back to help_center_url when support_url is empty', () => {
      mockMetadata = {
        support_url: '',
        help_center_url: 'https://help.acme.edu',
      };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://help.acme.edu');
    });

    it('prefers the tenant help_center_url over the config default', () => {
      mockMetadata = { help_center_url: 'https://help.acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://help.acme.edu');
    });

    it('adds a protocol to a scheme-less tenant URL', () => {
      mockMetadata = { help_center_url: 'help.acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(mockAddProtocolToUrl).toHaveBeenCalledWith('help.acme.edu');
      expect(result.current.helpCenterUrl).toBe('https://help.acme.edu');
    });

    it('falls back to the configured help center URL when metadata is absent', () => {
      mockMetadata = undefined;
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://docs.example.com');
    });

    it('falls back to the configured help center URL when the tenant value is empty', () => {
      mockMetadata = { help_center_url: '' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://docs.example.com');
    });

    it('honors an env-provided config override', () => {
      mockConfigHelpCenterUrl = 'https://docs.partner.io';
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://docs.partner.io');
    });
  });

  describe('documentationUrl', () => {
    it('prefers the tenant documentation_url over the config default', () => {
      mockMetadata = { documentation_url: 'https://docs.acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.documentationUrl).toBe('https://docs.acme.edu');
    });

    it('adds a protocol to a scheme-less tenant URL', () => {
      mockMetadata = { documentation_url: 'docs.acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(mockAddProtocolToUrl).toHaveBeenCalledWith('docs.acme.edu');
      expect(result.current.documentationUrl).toBe('https://docs.acme.edu');
    });

    it('falls back to the configured documentation URL when metadata is absent', () => {
      mockMetadata = undefined;
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.documentationUrl).toBe('https://ibl.ai/docs');
    });

    it('falls back to the configured documentation URL when the tenant value is empty', () => {
      mockMetadata = { documentation_url: '' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.documentationUrl).toBe('https://ibl.ai/docs');
    });

    it('honors an env-provided config override', () => {
      mockConfigDocumentationUrl = 'https://docs.partner.io';
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.documentationUrl).toBe('https://docs.partner.io');
    });

    it('does not fall back to help_center_url', () => {
      mockMetadata = { help_center_url: 'https://help.acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.documentationUrl).toBe('https://ibl.ai/docs');
      expect(result.current.helpCenterUrl).toBe('https://help.acme.edu');
    });

    it('resolves independently from help_center_url when both are set', () => {
      mockMetadata = {
        help_center_url: 'ibl.ai/support',
        documentation_url: 'ibl.ai/docs',
      };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.helpCenterUrl).toBe('https://ibl.ai/support');
      expect(result.current.documentationUrl).toBe('https://ibl.ai/docs');
    });
  });

  describe('supportEmail', () => {
    it('prefers the tenant support_email', () => {
      mockMetadata = { support_email: 'help@acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.supportEmail).toBe('help@acme.edu');
    });

    it('falls back to the configured support email when metadata is absent', () => {
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.supportEmail).toBe('support@example.com');
    });

    it('falls back to the configured support email when the tenant value is empty', () => {
      mockMetadata = { support_email: '' };
      mockConfigSupportEmail = 'desk@partner.io';
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.supportEmail).toBe('desk@partner.io');
    });
  });

  describe('showHelp', () => {
    it('is true when metadata is absent', () => {
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.showHelp).toBe(true);
    });

    it('is true when show_help is unset', () => {
      mockMetadata = { help_center_url: 'https://help.acme.edu' };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.showHelp).toBe(true);
    });

    it('is true when show_help is true', () => {
      mockMetadata = { show_help: true };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.showHelp).toBe(true);
    });

    it('is false only when show_help is explicitly false', () => {
      mockMetadata = { show_help: false };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.showHelp).toBe(false);
    });

    it('stays true for a falsy-but-not-false show_help value', () => {
      mockMetadata = { show_help: 0 };
      const { result } = renderHook(() => useHelpCenter('acme'));
      expect(result.current.showHelp).toBe(true);
    });
  });
});
