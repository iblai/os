import { describe, it, expect } from 'vitest';
import {
  LOCAL_STORAGE_KEYS,
  QUERY_PARAMS,
  URL_PATTERNS,
  MODALS,
  DEFAULT_PROMPTS,
  MENTOR_VISIBILITY_VALUES,
  MENTOR_VISIBILITY,
  GreetingMethod,
  UserType,
  REPORT_NAME,
  ADMIN_PAGES_SUBPATHS,
  MODEL_AGENTS,
  ANONYMOUS_USERNAME,
  EMBED_MESSAGE_TYPES,
  REDIRECT_PATH_LOCAL_STORAGE_KEY,
  CSS_CLASS_NAMES,
  DROPBOX_EXTENSIONS,
} from '../constants';

describe('mentor constants', () => {
  describe('LOCAL_STORAGE_KEYS', () => {
    it('should have all required keys', () => {
      expect(LOCAL_STORAGE_KEYS.VISITING_TENANT).toBe('visiting_tenant');
      expect(LOCAL_STORAGE_KEYS.CURRENT_TENANT).toBe('current_tenant');
      expect(LOCAL_STORAGE_KEYS.TENANTS).toBe('tenants');
      expect(LOCAL_STORAGE_KEYS.REDIRECT_TO).toBe('redirect-to');
      expect(LOCAL_STORAGE_KEYS.AUTH_TOKEN).toBe('axd_token');
      expect(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY).toBe('axd_token_expires');
      expect(LOCAL_STORAGE_KEYS.DM_TOKEN_EXPIRY).toBe('dm_token_expires');
      expect(LOCAL_STORAGE_KEYS.EDX_TOKEN_KEY).toBe('edx_jwt_token');
      expect(LOCAL_STORAGE_KEYS.DM_TOKEN_KEY).toBe('dm_token');
      expect(LOCAL_STORAGE_KEYS.AXD_TOKEN_KEY).toBe('axd_token');
      expect(LOCAL_STORAGE_KEYS.USER_DATA).toBe('userData');
      expect(LOCAL_STORAGE_KEYS.DEFAULT_TENANT).toBe('tenant');
      expect(LOCAL_STORAGE_KEYS.USER_TENANTS).toBe('tenants');
      expect(LOCAL_STORAGE_KEYS.SESSION_ID).toBe('session_id');
      expect(LOCAL_STORAGE_KEYS.MODEL_DOWNLOAD_STATE).toBe(
        'model_download_state',
      );
      expect(LOCAL_STORAGE_KEYS.MODEL_DOWNLOAD_PROMPT_DISMISSED).toBe(
        'model_download_prompt_dismissed',
      );
    });
  });

  describe('QUERY_PARAMS', () => {
    it('should have correct query parameter names', () => {
      expect(QUERY_PARAMS.APP).toBe('app');
      expect(QUERY_PARAMS.REDIRECT_TO).toBe('redirect-to');
      expect(QUERY_PARAMS.TENANT).toBe('tenant');
    });
  });

  describe('URL_PATTERNS', () => {
    it('should match platform key pattern', () => {
      const pattern = URL_PATTERNS.PLATFORM_KEY;
      expect(pattern.test('/platform/my-tenant/')).toBe(true);
      expect(pattern.test('/platform/test-org/')).toBe(true);
      expect(pattern.test('/other/path/')).toBe(false);
    });

    it('should extract platform key', () => {
      const pattern = URL_PATTERNS.PLATFORM_KEY;
      const match = '/platform/my-tenant/dashboard'.match(pattern);
      expect(match?.[1]).toBe('my-tenant');
    });
  });

  describe('MODALS', () => {
    it('should have all modal definitions', () => {
      expect(MODALS.SETTINGS.name).toBe('settings');
      expect(MODALS.CREATE_MENTOR.name).toBe('create_mentor');
      expect(MODALS.INVITE_USER.name).toBe('invite_user');
      expect(MODALS.MY_MENTORS.name).toBe('my_mentors');
      expect(MODALS.LLM_PROVIDERS.name).toBe('llm_providers');
      expect(MODALS.ADD_PROMPT.name).toBe('add_prompt');
      expect(MODALS.ADD_RESOURCE.name).toBe('add_resource');
      expect(MODALS.NO_MENTOR_SELECTED.name).toBe('no_mentor_selected');
    });

    it('should have edit mentor modal with tabs', () => {
      expect(MODALS.EDIT_MENTOR.name).toBe('edit_mentor');
      expect(MODALS.EDIT_MENTOR.tabs.settings).toBe('settings');
      expect(MODALS.EDIT_MENTOR.tabs.llm).toBe('llm');
      expect(MODALS.EDIT_MENTOR.tabs.prompts).toBe('prompts');
      expect(MODALS.EDIT_MENTOR.tabs.mcp).toBe('mcp');
      expect(MODALS.EDIT_MENTOR.tabs.tools).toBe('tools');
      expect(MODALS.EDIT_MENTOR.tabs.safety).toBe('safety');
      expect(MODALS.EDIT_MENTOR.tabs.disclaimer).toBe('disclaimer');
      expect(MODALS.EDIT_MENTOR.tabs.access).toBe('access');
      expect(MODALS.EDIT_MENTOR.tabs.memory).toBe('memory');
      expect(MODALS.EDIT_MENTOR.tabs.flow).toBe('flow');
      expect(MODALS.EDIT_MENTOR.tabs.history).toBe('history');
      expect(MODALS.EDIT_MENTOR.tabs.datasets).toBe('datasets');
      expect(MODALS.EDIT_MENTOR.tabs.api).toBe('api');
      expect(MODALS.EDIT_MENTOR.tabs.embed).toBe('embed');
      expect(MODALS.EDIT_MENTOR.tabs.advanced_css).toBe('advanced_css');
      expect(MODALS.EDIT_MENTOR.tabs.advanced_js).toBe('advanced_js');
    });
  });

  describe('DEFAULT_PROMPTS', () => {
    it('should have all default prompts', () => {
      expect(DEFAULT_PROMPTS.DEFAULT_SYSTEM_PROMPT).toBeTruthy();
      expect(DEFAULT_PROMPTS.DEFAULT_SYSTEM_PROMPT).toContain(
        'helpful instructor',
      );

      expect(DEFAULT_PROMPTS.DEFAULT_MODERATION_PROMPT).toBeTruthy();
      expect(DEFAULT_PROMPTS.DEFAULT_MODERATION_PROMPT).toContain('moderator');

      expect(DEFAULT_PROMPTS.DEFAULT_PROACTIVE_PROMPT).toBeTruthy();
      expect(DEFAULT_PROMPTS.DEFAULT_PROACTIVE_PROMPT).toContain(
        'entered the chat',
      );

      expect(DEFAULT_PROMPTS.DEFAULT_GUIDED_PROMPT).toBeTruthy();
      expect(DEFAULT_PROMPTS.DEFAULT_GUIDED_PROMPT).toContain(
        'suggested prompts',
      );
    });
  });

  describe('MENTOR_VISIBILITY', () => {
    it('should have visibility values', () => {
      expect(MENTOR_VISIBILITY_VALUES.ADMINISTRATORS).toBe(
        'viewable_by_tenant_admins',
      );
      expect(MENTOR_VISIBILITY_VALUES.STUDENTS).toBe(
        'viewable_by_tenant_students',
      );
      expect(MENTOR_VISIBILITY_VALUES.ANYONE).toBe('viewable_by_anyone');
    });

    it('should have visibility options array', () => {
      expect(MENTOR_VISIBILITY).toHaveLength(3);
      expect(MENTOR_VISIBILITY[0]).toEqual({
        label: 'Administrators',
        value: 'viewable_by_tenant_admins',
      });
      expect(MENTOR_VISIBILITY[1]).toEqual({
        label: 'Students',
        value: 'viewable_by_tenant_students',
      });
      expect(MENTOR_VISIBILITY[2]).toEqual({
        label: 'Anyone',
        value: 'viewable_by_anyone',
      });
    });
  });

  describe('GreetingMethod', () => {
    it('should have greeting method enum values', () => {
      expect(GreetingMethod.PROACTIVE_RESPONSE).toBe('proactive_response');
      expect(GreetingMethod.PROACTIVE_PROMPT).toBe('proactive_prompt');
    });
  });

  describe('UserType', () => {
    it('should have all user types', () => {
      expect(UserType.ANONYMOUS).toBe('anonymous');
      expect(UserType.FREE_TRIAL).toBe('free-trial');
      expect(UserType.STUDENT).toBe('student');
      expect(UserType.ADMIN).toBe('admin');
      expect(UserType.VISITING).toBe('visiting');
    });
  });

  describe('REPORT_NAME', () => {
    it('should be ai-mentor-chat-history', () => {
      expect(REPORT_NAME).toBe('ai-mentor-chat-history');
    });
  });

  describe('ADMIN_PAGES_SUBPATHS', () => {
    it('should have admin analytics path', () => {
      expect(ADMIN_PAGES_SUBPATHS.ADMIN_ANALYTICS).toBe('/analytics');
    });
  });

  describe('MODEL_AGENTS', () => {
    it('should have model agent options', () => {
      expect(MODEL_AGENTS).toHaveLength(3);
      expect(MODEL_AGENTS[0].label).toBe('Default');
      expect(MODEL_AGENTS[1].label).toBe('OpenAI');
      expect(MODEL_AGENTS[1].value).toBe('openai-agent');
      expect(MODEL_AGENTS[2].label).toBe('Gemini');
      expect(MODEL_AGENTS[2].value).toBe('google-agent');
    });
  });

  describe('ANONYMOUS_USERNAME', () => {
    it('should be anonymous', () => {
      expect(ANONYMOUS_USERNAME).toBe('anonymous');
    });
  });

  describe('EMBED_MESSAGE_TYPES', () => {
    it('should have embed message type', () => {
      expect(EMBED_MESSAGE_TYPES.MENTOR_CLOSE_EMBED).toBe('MENTOR:CLOSE_EMBED');
    });
  });

  describe('REDIRECT_PATH_LOCAL_STORAGE_KEY', () => {
    it('should be redirect-to', () => {
      expect(REDIRECT_PATH_LOCAL_STORAGE_KEY).toBe('redirect-to');
    });
  });

  describe('CSS_CLASS_NAMES', () => {
    it('should have chat class names', () => {
      expect(CSS_CLASS_NAMES.CHAT.AI_MESSAGE_RESPONSE).toBe(
        'chat-ai-message-response',
      );
      expect(CSS_CLASS_NAMES.CHAT.USER_MESSAGE_QUERY).toBe(
        'chat-user-message-query',
      );
      expect(CSS_CLASS_NAMES.CHAT.TEXTAREA).toBe('chat-textarea');
      expect(CSS_CLASS_NAMES.CHAT.SUBMIT_MESSAGE_BUTTON).toBe(
        'chat-submit-message-button',
      );
      expect(CSS_CLASS_NAMES.CHAT.STOP_STREAMING_BUTTON).toBe(
        'chat-stop-streaming-button',
      );
    });

    it('should have app layout class names', () => {
      expect(CSS_CLASS_NAMES.APP_LAYOUT.MAIN_CONTENT_AREA).toBe(
        'chat-main-content-area',
      );
      expect(CSS_CLASS_NAMES.APP_LAYOUT.GUIDED_SUGGESTED_PROMPTS).toBe(
        'chat-guided-suggested-prompts',
      );
      expect(CSS_CLASS_NAMES.APP_LAYOUT.GUIDED_SUGGESTED_PROMPTS_REFRESH).toBe(
        'chat-guided-suggested-prompts-refresh',
      );
      expect(CSS_CLASS_NAMES.APP_LAYOUT.WELCOME_CHAT_BUTTON).toBe(
        'chat-welcome-button',
      );
    });
  });

  describe('DROPBOX_EXTENSIONS', () => {
    it('should have all file extensions', () => {
      expect(DROPBOX_EXTENSIONS).toContain('.ppt');
      expect(DROPBOX_EXTENSIONS).toContain('.pptx');
      expect(DROPBOX_EXTENSIONS).toContain('.pdf');
      expect(DROPBOX_EXTENSIONS).toContain('.doc');
      expect(DROPBOX_EXTENSIONS).toContain('.docx');
      expect(DROPBOX_EXTENSIONS).toContain('.txt');
      expect(DROPBOX_EXTENSIONS).toContain('.png');
      expect(DROPBOX_EXTENSIONS).toContain('.jpeg');
      expect(DROPBOX_EXTENSIONS).toContain('.mp3');
      expect(DROPBOX_EXTENSIONS).toContain('.wav');
      expect(DROPBOX_EXTENSIONS).toContain('.m4a');
      expect(DROPBOX_EXTENSIONS).toContain('.jpg');
    });

    it('should have correct number of extensions', () => {
      expect(DROPBOX_EXTENSIONS).toHaveLength(12);
    });
  });
});
