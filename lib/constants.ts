import { config } from './config';

// Local storage keys
export const LOCAL_STORAGE_KEYS = {
  VISITING_TENANT: 'visiting_tenant',
  CURRENT_TENANT: 'current_tenant',
  TENANTS: 'tenants',
  REDIRECT_TO: 'redirect-to',
  AUTH_TOKEN: 'axd_token',
  TOKEN_EXPIRY: 'axd_token_expires',
  DM_TOKEN_EXPIRY: 'dm_token_expires',
  EDX_TOKEN_KEY: 'edx_jwt_token',
  DM_TOKEN_KEY: 'dm_token',
  AXD_TOKEN_KEY: 'axd_token',
  USER_DATA: 'userData',
  DEFAULT_TENANT: 'tenant',
  USER_TENANTS: 'tenants',
  SESSION_ID: 'session_id',
  MODEL_DOWNLOAD_STATE: 'model_download_state',
  MODEL_DOWNLOAD_PROMPT_DISMISSED: 'model_download_prompt_dismissed',
};

// Query parameters
export const QUERY_PARAMS = {
  APP: 'app',
  REDIRECT_TO: 'redirect-to',
  TENANT: 'tenant',
};

// URL patterns
export const URL_PATTERNS = {
  PLATFORM_KEY: /\/platform\/([^/]+)\//,
};

export const MODALS = {
  SETTINGS: { name: 'settings' },
  CREATE_MENTOR: { name: 'create_mentor' },
  INVITE_USER: { name: 'invite_user' },
  LLM_PROVIDERS: { name: 'llm_providers' },
  EDIT_MENTOR: {
    name: 'edit_mentor',
    tabs: {
      settings: 'settings',
      llm: 'llm',
      prompts: 'prompts',
      mcp: 'mcp',
      tools: 'tools',
      safety: 'safety',
      privacy: 'privacy',
      tasks: 'tasks',
      disclaimer: 'disclaimer',
      access: 'access',
      memory: 'memory',
      flow: 'flow',
      history: 'history',
      datasets: 'datasets',
      evaluation: 'evaluation',
      api: 'api',
      embed: 'embed',
      lti: 'lti',
      advanced_css: 'advanced_css',
      advanced_js: 'advanced_js',
      sandbox: 'sandbox',
      skills: 'skills',
      grader: 'grader',
      audit_log: 'audit_log',
      voice: 'voice',
      screenshare: 'screenshare',
      human_support: 'human_support',
      analytics: 'analytics',
    },
  },
  ADD_PROMPT: { name: 'add_prompt' },
  ADD_RESOURCE: { name: 'add_resource' },
  NO_MENTOR_SELECTED: { name: 'no_mentor_selected' },
};

// URL query params owned by the datasets tab inside the edit-mentor modal.
// They are scoped to that tab: cleared together with the `modal` param when the
// modal closes or the user switches to another tab, so they never outlive the
// datasets view. Shared by the datasets-tab wrapper (writer) and useNavigate's
// close/tab-change logic (cleaner) to keep the keys in one place.
export const DATASETS_TAB_URL_PARAMS = {
  page: 'datasetsPage',
  search: 'datasetsSearch',
} as const;

export const DEFAULT_PROMPTS = {
  DEFAULT_SYSTEM_PROMPT: `You are a helpful assistant.

## Response style
- Answer directly and concisely. Lead with the answer, then support it.
- Match depth to the question: short questions get short answers.
- Clarify with an example when a concept is genuinely hard to follow without
  one — not by default.
- When your answer leaves out relevant depth, close by offering it briefly.
- Never describe your approach or narrate what you're about to do. Just answer.

## Using retrieved context
You may receive excerpts retrieved from a longer document, along with the
user's message.
- When the excerpts are relevant, ground your answer in them.
- When they are empty, missing, or irrelevant, answer from your own knowledge.
- Never mention the retrieval system, the excerpts, or their absence. The user
  should not be told a document was blank, that no context was found, or that
  there is no prior conversation.

## Greetings
If the user's message is only a greeting, greet them back and ask how you can
help. Otherwise, go straight to answering — no greeting, no restating their
question.

## Formatting
Write mathematical expressions in LaTeX: $...$ for inline math and $$...$$ for
display equations. Use plain prose for everything else.

## Scope
Respond only to the user's current message.`,

  DEFAULT_MODERATION_PROMPT: `
You are a moderator tasked with identifying whether a prompt from a user is appropriate or inappropriate. Any prompt that is immoral or contains abusive words, insults, query that involve damaging content, and law breaking acts, etc should be deemed inappropriate. Otherwise it is deemed appropriate.
`,

  DEFAULT_PROACTIVE_PROMPT: `
The user has entered the chat session. Based on the conversation history, initiate interaction with the user to keep the conversation going.
`,

  DEFAULT_GUIDED_PROMPT: `
Generate suggested prompts for the user based on the conversation.
`,
};

export const MENTOR_VISIBILITY_VALUES = {
  ADMINISTRATORS: 'viewable_by_tenant_admins' as const,
  STUDENTS: 'viewable_by_tenant_students' as const,
  ANYONE: 'viewable_by_anyone' as const,
};

export const MENTOR_VISIBILITY = [
  {
    label: 'Administrators',
    value: MENTOR_VISIBILITY_VALUES.ADMINISTRATORS,
  },
  {
    label: 'Users',
    value: MENTOR_VISIBILITY_VALUES.STUDENTS,
  },
  {
    label: 'Anyone',
    value: MENTOR_VISIBILITY_VALUES.ANYONE,
  },
];

export enum GreetingMethod {
  PROACTIVE_RESPONSE = 'proactive_response',
  PROACTIVE_PROMPT = 'proactive_prompt',
}

export enum UserType {
  ANONYMOUS = 'anonymous',
  FREE_TRIAL = 'free-trial',
  STUDENT = 'student',
  ADMIN = 'admin',
  VISITING = 'visiting',
}

export const REPORT_NAME = 'ai-mentor-chat-history';

export const ADMIN_PAGES_SUBPATHS = {
  ADMIN_ANALYTICS: '/analytics',
};

export const MODEL_AGENTS = [
  { label: 'Default', value: config.iblTemplateMentor() },
  { label: 'OpenAI', value: 'openai-agent' },
  { label: 'Gemini', value: 'google-agent' },
];

export const ANONYMOUS_USERNAME = 'anonymous';

// Iframe message types
export const EMBED_MESSAGE_TYPES = {
  MENTOR_CLOSE_EMBED: 'MENTOR:CLOSE_EMBED',
} as const;

export const REDIRECT_PATH_LOCAL_STORAGE_KEY = 'redirect-to';

export const CSS_CLASS_NAMES = {
  CHAT: {
    AI_MESSAGE_RESPONSE: 'chat-ai-message-response',
    USER_MESSAGE_QUERY: 'chat-user-message-query',
    TEXTAREA: 'chat-textarea',
    SUBMIT_MESSAGE_BUTTON: 'chat-submit-message-button',
    STOP_STREAMING_BUTTON: 'chat-stop-streaming-button',
  },
  APP_LAYOUT: {
    MAIN_CONTENT_AREA: 'chat-main-content-area',
    GUIDED_SUGGESTED_PROMPTS_CONTAINER:
      'chat-guided-suggested-prompts-container',
    GUIDED_SUGGESTED_PROMPTS: 'chat-guided-suggested-prompts',
    GUIDED_SUGGESTED_PROMPTS_REFRESH: 'chat-guided-suggested-prompts-refresh',
    WELCOME_CHAT_BUTTON: 'chat-welcome-button',
    MENTOR_IMAGE_CONTAINER_RING: 'mentor-image-container-ring',
  },
};

// Caps the length of the auto-submitted `?prompt=` deep-link payload so an
// attacker-crafted link cannot smuggle an oversized prompt into the chat.
export const MAX_PROMPT_PARAM_LENGTH = 4000;

export const DROPBOX_EXTENSIONS = [
  '.ppt',
  '.pptx',
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.png',
  '.jpeg',
  '.mp3',
  '.wav',
  '.m4a',
  '.jpg',
];
