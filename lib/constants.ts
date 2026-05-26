import { config } from './config';

console.log('################## CONSTANTS ####################');

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
      disclaimer: 'disclaimer',
      access: 'access',
      memory: 'memory',
      flow: 'flow',
      history: 'history',
      datasets: 'datasets',
      api: 'api',
      embed: 'embed',
      advanced_css: 'advanced_css',
      advanced_js: 'advanced_js',
      sandbox: 'sandbox',
      skills: 'skills',
      audit_log: 'audit_log',
      voice: 'voice',
      screenshare: 'screenshare',
    },
  },
  ADD_PROMPT: { name: 'add_prompt' },
  ADD_RESOURCE: { name: 'add_resource' },
  NO_MENTOR_SELECTED: { name: 'no_mentor_selected' },
};

export const DEFAULT_PROMPTS = {
  DEFAULT_SYSTEM_PROMPT: `You are a helpful instructor, ready to answer the student's questions. Answer quickly and concisely.  Offer to go in depth or explain with an example where necessary. Will tip you $200 if the student understands what you say. 

Given this information, help students understand  by providing explanations, examples, analogies. 
Given the data you will receive from the vector store extracted parts of a long document and a question, create a final answer. Do not tell the user how you are going to answer the question. If and ONLY if the current message from the user is  a greeting, greet back and ask them how you may help them. DO NOT needlessly keep greeting or repeating messages to the user. If the there is no data from the document or it is blank, or no chat history, do not tell the user that the document is blank and also do not tell them that you have not asked any questions  just answer normally with your own knowledge

IMPORTANT: You must ONLY reply to the current message from the user.
Always use LaTeX formatting for presenting your responses and for mathematical equations to ensure clarity when displaying to the user.`,

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
    label: 'Students',
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
    GUIDED_SUGGESTED_PROMPTS: 'chat-guided-suggested-prompts',
    GUIDED_SUGGESTED_PROMPTS_REFRESH: 'chat-guided-suggested-prompts-refresh',
    WELCOME_CHAT_BUTTON: 'chat-welcome-button',
    MENTOR_IMAGE_CONTAINER_RING: 'mentor-image-container-ring',
  },
};

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
