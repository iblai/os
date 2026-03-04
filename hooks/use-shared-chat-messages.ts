import { useGetChatMessagesForSessionQuery } from '@iblai/iblai-js/data-layer';

type SharedChatParams = {
  sessionId: string;
  tenantKey?: string;
};

type TransformedMessage = {
  id?: string;
  type?: string;
  role: 'user' | 'assistant';
  visible: boolean;
  artifactVersions?: TransformedArtifactVersion[];
  [key: string]: unknown;
};

type TransformedArtifactVersion = {
  id: string;
  artifact: {
    id?: string;
    title?: string;
    content?: string;
    file_extension?: string;
    llm_name?: string;
    llm_provider?: string;
    date_created?: string;
    date_updated?: string;
    metadata?: Record<string, unknown>;
    username?: string;
    session_id?: string;
    current_version_number?: number;
    version_count?: number;
  };
  title?: string;
  content?: string;
  session_id?: string;
  content_length?: number;
  is_current?: boolean;
  chat_message?: string;
  version_number?: number;
  date_created?: string;
  created_by?: string;
  change_summary?: string;
};

type SharedChatData = {
  results?: TransformedMessage[];
  mentor_unique_id?: string;
  platform_key?: string;
  [key: string]: unknown;
};

export function transformArtifactVersions(
  artifactVersions: any[] | undefined,
): TransformedArtifactVersion[] | undefined {
  if (!artifactVersions || artifactVersions.length === 0) {
    return undefined;
  }

  return artifactVersions.map((av: any) => ({
    id: av.id,
    artifact: {
      id: av.artifact?.id,
      title: av.artifact?.title,
      content: av.artifact?.content,
      file_extension: av.artifact?.file_extension,
      llm_name: av.artifact?.llm_name,
      llm_provider: av.artifact?.llm_provider,
      date_created: av.artifact?.date_created,
      date_updated: av.artifact?.date_updated,
      metadata: av.artifact?.metadata,
      username: av.artifact?.username,
      session_id: av.artifact?.session_id,
      current_version_number: av.artifact?.current_version_number,
      version_count: av.artifact?.version_count,
    },
    title: av.title,
    content: av.content,
    session_id: av.session_id,
    content_length: av.content_length,
    is_current: av.is_current,
    chat_message: av.chat_message,
    version_number: av.version_number,
    date_created: av.date_created,
    created_by: av.created_by,
    change_summary: av.change_summary,
  }));
}

export function transformChatMessage(result: any): TransformedMessage {
  const artifactVersions = transformArtifactVersions(result.artifact_versions);

  return {
    ...result,
    role: result.type === 'human' ? 'user' : 'assistant',
    visible: true,
    artifactVersions,
  };
}

export function transformChatResults(results: any[] | undefined): TransformedMessage[] | undefined {
  if (!results) {
    return undefined;
  }

  return results.map(transformChatMessage).reverse();
}

export function useSharedChatMessages({ sessionId, tenantKey }: SharedChatParams) {
  const { data, isLoading, isError, error } = useGetChatMessagesForSessionQuery(
    {
      org: tenantKey ?? '',
      sessionId: sessionId ?? '',
      // @ts-ignore - userId is required at runtime but not in generated types
      userId: 'undefined',
    },
    {
      selectFromResult(state) {
        return {
          ...state,
          data: {
            ...state.data,
            results: transformChatResults(state.data?.results),
          } as SharedChatData,
        };
      },
    },
  );

  return {
    chatDetails: data,
    messages: data?.results ?? [],
    mentorUniqueId: data?.mentor_unique_id,
    platformKey: data?.platform_key,
    isLoading,
    isError,
    error,
  };
}
