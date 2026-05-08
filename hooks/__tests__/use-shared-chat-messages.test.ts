import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  transformArtifactVersions,
  transformChatMessage,
  transformChatResults,
  useSharedChatMessages,
} from '../use-shared-chat-messages';

const mockUseGetChatMessagesForSessionQuery = vi.fn();

let mockQueryState = {
  data: undefined as any,
  isLoading: false,
  isError: false,
  error: undefined as any,
};

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetChatMessagesForSessionQuery: (params: any, options: any) => {
    mockUseGetChatMessagesForSessionQuery(params, options);
    const selected = options?.selectFromResult
      ? options.selectFromResult(mockQueryState)
      : mockQueryState;
    return {
      ...selected,
      isLoading: mockQueryState.isLoading,
      isError: mockQueryState.isError,
      error: mockQueryState.error,
    };
  },
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
}));

describe('transformArtifactVersions', () => {
  it('returns undefined for undefined input', () => {
    expect(transformArtifactVersions(undefined)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(transformArtifactVersions([])).toBeUndefined();
  });

  it('transforms artifact versions correctly', () => {
    const input = [
      {
        id: 'av-1',
        artifact: {
          id: 'art-1',
          title: 'Test Artifact',
          content: 'Test content',
          file_extension: 'ts',
          llm_name: 'claude',
          llm_provider: 'anthropic',
          date_created: '2024-01-01',
          date_updated: '2024-01-02',
          metadata: { key: 'value' },
          username: 'testuser',
          session_id: 'session-1',
          current_version_number: 1,
          version_count: 2,
        },
        title: 'Version Title',
        content: 'Version content',
        session_id: 'session-1',
        content_length: 100,
        is_current: true,
        chat_message: 'msg-1',
        version_number: 1,
        date_created: '2024-01-01',
        created_by: 'testuser',
        change_summary: 'Initial version',
      },
    ];

    const result = transformArtifactVersions(input);

    expect(result).toHaveLength(1);
    expect(result?.[0]).toEqual({
      id: 'av-1',
      artifact: {
        id: 'art-1',
        title: 'Test Artifact',
        content: 'Test content',
        file_extension: 'ts',
        llm_name: 'claude',
        llm_provider: 'anthropic',
        date_created: '2024-01-01',
        date_updated: '2024-01-02',
        metadata: { key: 'value' },
        username: 'testuser',
        session_id: 'session-1',
        current_version_number: 1,
        version_count: 2,
      },
      title: 'Version Title',
      content: 'Version content',
      session_id: 'session-1',
      content_length: 100,
      is_current: true,
      chat_message: 'msg-1',
      version_number: 1,
      date_created: '2024-01-01',
      created_by: 'testuser',
      change_summary: 'Initial version',
    });
  });

  it('handles missing artifact properties gracefully', () => {
    const input = [{ id: 'av-1', artifact: {} }];

    const result = transformArtifactVersions(input);

    expect(result).toHaveLength(1);
    expect(result?.[0].artifact).toEqual({
      id: undefined,
      title: undefined,
      content: undefined,
      file_extension: undefined,
      llm_name: undefined,
      llm_provider: undefined,
      date_created: undefined,
      date_updated: undefined,
      metadata: undefined,
      username: undefined,
      session_id: undefined,
      current_version_number: undefined,
      version_count: undefined,
    });
  });
});

describe('transformChatMessage', () => {
  it('transforms human message to user role', () => {
    const input = {
      id: 'msg-1',
      type: 'human',
      content: 'Hello',
    };

    const result = transformChatMessage(input);

    expect(result.role).toBe('user');
    expect(result.visible).toBe(true);
    expect(result.id).toBe('msg-1');
    expect(result.type).toBe('human');
  });

  it('transforms non-human message to assistant role', () => {
    const input = {
      id: 'msg-2',
      type: 'ai',
      content: 'Hi there',
    };

    const result = transformChatMessage(input);

    expect(result.role).toBe('assistant');
    expect(result.visible).toBe(true);
  });

  it('includes artifact versions when present', () => {
    const input = {
      id: 'msg-3',
      type: 'ai',
      artifact_versions: [
        {
          id: 'av-1',
          artifact: { id: 'art-1', title: 'Test' },
        },
      ],
    };

    const result = transformChatMessage(input);

    expect(result.artifactVersions).toBeDefined();
    expect(result.artifactVersions).toHaveLength(1);
    expect(result.artifactVersions?.[0].id).toBe('av-1');
  });

  it('preserves additional properties from input', () => {
    const input = {
      id: 'msg-4',
      type: 'human',
      customField: 'customValue',
      metadata: { key: 'value' },
    };

    const result = transformChatMessage(input);

    expect(result.customField).toBe('customValue');
    expect(result.metadata).toEqual({ key: 'value' });
  });
});

describe('transformChatResults', () => {
  it('returns undefined for undefined input', () => {
    expect(transformChatResults(undefined)).toBeUndefined();
  });

  it('transforms and reverses results array', () => {
    const input = [
      { id: 'msg-1', type: 'human', content: 'First' },
      { id: 'msg-2', type: 'ai', content: 'Second' },
      { id: 'msg-3', type: 'human', content: 'Third' },
    ];

    const result = transformChatResults(input);

    expect(result).toHaveLength(3);
    expect(result?.[0].id).toBe('msg-3');
    expect(result?.[1].id).toBe('msg-2');
    expect(result?.[2].id).toBe('msg-1');
  });

  it('transforms empty array to empty array', () => {
    const result = transformChatResults([]);

    expect(result).toEqual([]);
  });
});

describe('useSharedChatMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryState = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: undefined,
    };
  });

  it('calls query with correct parameters when tenantKey is provided', () => {
    renderHook(() =>
      useSharedChatMessages({
        sessionId: 'session-123',
        tenantKey: 'tenant-abc',
      }),
    );

    expect(mockUseGetChatMessagesForSessionQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        org: 'tenant-abc',
        sessionId: 'session-123',
        userId: 'undefined',
      }),
      expect.any(Object),
    );
  });

  it('uses empty string for org when tenantKey is undefined', () => {
    renderHook(() =>
      useSharedChatMessages({
        sessionId: 'session-123',
      }),
    );

    expect(mockUseGetChatMessagesForSessionQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        org: '',
        sessionId: 'session-123',
      }),
      expect.any(Object),
    );
  });

  it('returns empty messages array when data is undefined', () => {
    const { result } = renderHook(() =>
      useSharedChatMessages({
        sessionId: 'session-123',
      }),
    );

    expect(result.current.messages).toEqual([]);
  });

  it('returns loading state from query', () => {
    mockQueryState = {
      data: undefined,
      isLoading: true,
      isError: false,
      error: undefined,
    };

    const { result } = renderHook(() =>
      useSharedChatMessages({
        sessionId: 'session-123',
      }),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('returns error state from query', () => {
    const testError = new Error('Test error');
    mockQueryState = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: testError,
    };

    const { result } = renderHook(() =>
      useSharedChatMessages({
        sessionId: 'session-123',
      }),
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(testError);
  });
});
