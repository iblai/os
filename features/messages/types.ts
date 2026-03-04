export type GetRecentMessagesArgs = {
  tenantKey: string;
  username: string;
};

export interface GetRecentMessagesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Session[];
}

export interface Session {
  session_id: string;
  mentor: Mentor;
  messages_count: number;
  messages: MessageEntry[];
}

export interface Mentor {
  name: string;
  mentor_tenant: string;
  description: string;
  profile_image: string;
  created_by: string;
  unique_id: string;
  proactive_prompt: string;
}

export interface MessageEntry {
  id: number;
  message: Message;
  inserted_at: string;
  title: string | null;
  feedback: Feedback | null;
  document_sources: unknown; // Adjust if there's a defined structure
}

export interface Message {
  data: MessageData;
  type: "ai" | "human";
}

export interface MessageData {
  id: string | null;
  name: string | null;
  type: "ai" | "human";
  content: string;
  example: boolean;
  tool_calls?: unknown[]; // Adjust if tool_calls has a structure
  usage_metadata?: unknown;
  additional_kwargs: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  invalid_tool_calls?: unknown[]; // Adjust if structure is known
}

export interface Feedback {
  username: string;
  session: string;
  user_text: string;
  ai_response: string;
  reason: string;
  additional_feedback: string;
  rating: number | null;
  inserted_at: string | null;
  mentor: string | null;
}
