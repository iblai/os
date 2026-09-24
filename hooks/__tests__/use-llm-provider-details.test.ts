import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseGetLlmsQuery = vi.fn();
const mockUseGetCredentialsSchemaQuery = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetLlmsQuery: (...args: unknown[]) => mockUseGetLlmsQuery(...args),
  useGetCredentialsSchemaQuery: (...args: unknown[]) =>
    mockUseGetCredentialsSchemaQuery(...args),
}));

import {
  useCredentialsSchemaLogos,
  useLlmProviderCatalogue,
} from '../use-llm-provider-details';

const args = { org: 'org-1', userId: 'alice', mentorId: 'mentor-1' };

const catalogue = [
  {
    id: 1,
    name: 'openai',
    display_name: 'OpenAI',
    logo: 'https://api.example.com/openai.png',
  },
  { id: 2, name: 'bedrock', logo: null },
  { id: 3, name: 'groq', display_name: '   ', logo: '' },
];

describe('useLlmProviderCatalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetLlmsQuery.mockReturnValue({ data: catalogue });
  });

  it('queries the catalogue with the identity it is given', () => {
    renderHook(() => useLlmProviderCatalogue(args));
    expect(mockUseGetLlmsQuery).toHaveBeenCalledWith(
      { org: 'org-1', userId: 'alice', mentorId: 'mentor-1' },
      { skip: false },
    );
  });

  it.each([
    ['org', { ...args, org: undefined }],
    ['userId', { ...args, userId: null }],
    ['mentorId', { ...args, mentorId: undefined }],
  ])('skips the query when %s is missing', (_label, partial) => {
    renderHook(() => useLlmProviderCatalogue(partial));
    expect(mockUseGetLlmsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ org: partial.org ?? '' }),
      { skip: true },
    );
  });

  it('resolves the backend display_name and logo by provider name', () => {
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current('openai')).toEqual({
      logo: 'https://api.example.com/openai.png',
      displayName: 'OpenAI',
    });
  });

  it('falls back to the raw key when the row has no display_name', () => {
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current('bedrock')).toEqual({
      logo: null,
      displayName: 'bedrock',
    });
  });

  it('treats a blank display_name and an empty logo as absent', () => {
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current('groq')).toEqual({ logo: null, displayName: 'groq' });
  });

  it('skips malformed catalogue rows without throwing', () => {
    mockUseGetLlmsQuery.mockReturnValue({
      data: [null, { id: 9 }, ...catalogue],
    });
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current('openai').displayName).toBe('OpenAI');
  });

  it('resolves an unlisted key to itself with no logo', () => {
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current('Meta')).toEqual({ logo: null, displayName: 'Meta' });
  });

  it.each([undefined, null, ''])('resolves %s to an empty label', (key) => {
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current(key)).toEqual({ logo: null, displayName: '' });
  });

  it.each([
    ['still loading', undefined],
    ['not an array', { detail: 'nope' }],
  ])('degrades to the raw key while the catalogue is %s', (_label, data) => {
    mockUseGetLlmsQuery.mockReturnValue({ data });
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current('openai')).toEqual({
      logo: null,
      displayName: 'openai',
    });
  });

  it('keeps the same resolver identity while the catalogue is unchanged', () => {
    const { result, rerender } = renderHook(() =>
      useLlmProviderCatalogue(args),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('resolves a duplicated provider name to its first row', () => {
    mockUseGetLlmsQuery.mockReturnValue({
      data: [...catalogue, { id: 4, name: 'openai', display_name: 'Dupe' }],
    });
    const { result } = renderHook(() => useLlmProviderCatalogue(args));
    expect(result.current('openai').displayName).toBe('OpenAI');
  });
});

// Rows as `GET /api/ai-account/orgs/{org}/credential/schema/` returns them
const credentialsSchemas = [
  {
    name: 'openai',
    schema: {},
    service_info: {
      id: 1,
      name: 'openai',
      display_name: 'OpenAI',
      logo: 'https://cdn.example.com/openai.jpg',
    },
  },
  {
    name: 'azure_openai',
    schema: {},
    service_info: {
      id: 2,
      name: 'azure_openai',
      display_name: 'Microsoft',
      logo: 'https://cdn.example.com/azure.png',
    },
  },
  // A tool credential with no service_info
  { name: 'serper', schema: {} },
  {
    name: 'groq',
    schema: {},
    service_info: { id: 3, name: 'groq', display_name: 'Groq', logo: null },
  },
];

describe('useCredentialsSchemaLogos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetCredentialsSchemaQuery.mockReturnValue({
      data: credentialsSchemas,
    });
  });

  it('queries the tenant schema when enabled', () => {
    renderHook(() =>
      useCredentialsSchemaLogos({ org: 'org-1', enabled: true }),
    );
    expect(mockUseGetCredentialsSchemaQuery).toHaveBeenCalledWith(
      { org: 'org-1' },
      { skip: false },
    );
  });

  it.each([
    ['disabled (not a signed-in admin)', { org: 'org-1', enabled: false }],
    ['missing the org', { org: undefined, enabled: true }],
  ])('skips the query when %s', (_label, hookArgs) => {
    renderHook(() => useCredentialsSchemaLogos(hookArgs));
    expect(mockUseGetCredentialsSchemaQuery).toHaveBeenCalledWith(
      expect.anything(),
      { skip: true },
    );
  });

  it('resolves a logo by service_info.display_name, not the schema name', () => {
    const { result } = renderHook(() =>
      useCredentialsSchemaLogos({ org: 'org-1', enabled: true }),
    );
    expect(result.current('OpenAI')).toBe('https://cdn.example.com/openai.jpg');
    // The facet says "Microsoft" for the azure_openai credential
    expect(result.current('Microsoft')).toBe(
      'https://cdn.example.com/azure.png',
    );
    expect(result.current('openai')).toBeNull();
  });

  it('resolves to null for unknown names, rows without a logo, and no name', () => {
    const { result } = renderHook(() =>
      useCredentialsSchemaLogos({ org: 'org-1', enabled: true }),
    );
    expect(result.current('Anthropic')).toBeNull();
    expect(result.current('Groq')).toBeNull();
    expect(result.current(null)).toBeNull();
    expect(result.current(undefined)).toBeNull();
  });

  it('resolves everything to null while the schema is not loaded', () => {
    mockUseGetCredentialsSchemaQuery.mockReturnValue({ data: undefined });
    const { result } = renderHook(() =>
      useCredentialsSchemaLogos({ org: 'org-1', enabled: true }),
    );
    expect(result.current('OpenAI')).toBeNull();
  });

  it('resolves a duplicated display name to its first row', () => {
    mockUseGetCredentialsSchemaQuery.mockReturnValue({
      data: [
        ...credentialsSchemas,
        {
          name: 'openai_legacy',
          schema: {},
          service_info: {
            id: 9,
            name: 'openai_legacy',
            display_name: 'OpenAI',
            logo: 'https://cdn.example.com/other.png',
          },
        },
      ],
    });
    const { result } = renderHook(() =>
      useCredentialsSchemaLogos({ org: 'org-1', enabled: true }),
    );
    expect(result.current('OpenAI')).toBe('https://cdn.example.com/openai.jpg');
  });
});
