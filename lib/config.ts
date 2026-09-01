const env = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_LEGACY_LMS_URL: process.env.NEXT_PUBLIC_LEGACY_LMS_URL,
  NEXT_PUBLIC_MAIN_TENANT_KEY: process.env.NEXT_PUBLIC_MAIN_TENANT_KEY,
  NEXT_PUBLIC_IBL_TEMPLATE_MENTOR: process.env.NEXT_PUBLIC_IBL_TEMPLATE_MENTOR,
  NEXT_PUBLIC_EXTERNAL_PRICING_PAGE_URL:
    process.env.NEXT_PUBLIC_EXTERNAL_PRICING_PAGE_URL,
  NEXT_PUBLIC_STRIPE_ENABLED: process.env.NEXT_PUBLIC_STRIPE_ENABLED,
  NEXT_PUBLIC_IBL_PLATFORM: process.env.NEXT_PUBLIC_IBL_PLATFORM,
  NEXT_PUBLIC_IBL_ENABLE_SPECIAL_LOGO_WHEN_IFRAMED:
    process.env.NEXT_PUBLIC_IBL_ENABLE_SPECIAL_LOGO_WHEN_IFRAMED,
  NEXT_PUBLIC_MENTOR_IFRAME_URL: process.env.NEXT_PUBLIC_MENTOR_IFRAME_URL,
  NEXT_PUBLIC_BASE_WS_URL: process.env.NEXT_PUBLIC_BASE_WS_URL,
  NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL:
    process.env.NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL,
  NEXT_PUBLIC_MENTOR_URL: process.env.NEXT_PUBLIC_MENTOR_URL,
  NEXT_PUBLIC_MENTOR_SETTINGS_DISCLAIMER:
    process.env.NEXT_PUBLIC_MENTOR_SETTINGS_DISCLAIMER,
  NEXT_PUBLIC_IFRAME_FROM_OLD_MENTOR:
    process.env.NEXT_PUBLIC_IFRAME_FROM_OLD_MENTOR,
  NEXT_PUBLIC_ENABLE_RBAC: process.env.NEXT_PUBLIC_ENABLE_RBAC,
  NEXT_PUBLIC_IBL_SENTRY_DSN: process.env.NEXT_PUBLIC_IBL_SENTRY_DSN,
  NEXT_PUBLIC_HELP_CENTER_URL: process.env.NEXT_PUBLIC_HELP_CENTER_URL,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_DOCUMENTATION_URL: process.env.NEXT_PUBLIC_DOCUMENTATION_URL,
  NEXT_PUBLIC_ENABLE_GRAVATAR_ON_PROFILE_PIC:
    process.env.NEXT_PUBLIC_ENABLE_GRAVATAR_ON_PROFILE_PIC,
  NEXT_PUBLIC_DEFAULT_EMBED_CSS_URL:
    process.env.NEXT_PUBLIC_DEFAULT_EMBED_CSS_URL,
  NEXT_PUBLIC_APP_BANNER_LINK: process.env.NEXT_PUBLIC_APP_BANNER_LINK,
  NEXT_PUBLIC_APP_BANNER_LINK_TEXT:
    process.env.NEXT_PUBLIC_APP_BANNER_LINK_TEXT,
  NEXT_PUBLIC_APP_BANNER_BADGE: process.env.NEXT_PUBLIC_APP_BANNER_BADGE,
  NEXT_PUBLIC_APP_BANNER_TEXT: process.env.NEXT_PUBLIC_APP_BANNER_TEXT,
  NEXT_PUBLIC_SHOW_APP_BANNER: process.env.NEXT_PUBLIC_SHOW_APP_BANNER,
  NEXT_PUBLIC_MENTOR_TRAINING_MAXIMUM_FILE_SIZE:
    process.env.NEXT_PUBLIC_MENTOR_TRAINING_MAXIMUM_FILE_SIZE,
  NEXT_PUBLIC_HIDE_ANALYTICS: process.env.NEXT_PUBLIC_HIDE_ANALYTICS,
  NEXT_PUBLIC_SHOW_BASE_MENTOR: process.env.NEXT_PUBLIC_SHOW_BASE_MENTOR,
  NEXT_PUBLIC_DISABLED_DATASETS: process.env.NEXT_PUBLIC_DISABLED_DATASETS,
  NEXT_PUBLIC_ENABLE_ADVERTISING: process.env.NEXT_PUBLIC_ENABLE_ADVERTISING,
  NEXT_PUBLIC_DISABLED_ANALYTICS_REPORTS:
    process.env.NEXT_PUBLIC_DISABLED_ANALYTICS_REPORTS,
  NEXT_PUBLIC_PLATFORM_BASE_DOMAIN:
    process.env.NEXT_PUBLIC_PLATFORM_BASE_DOMAIN,
  NEXT_PUBLIC_DEFAULT_SUPPORT_PHONE_NUMBER:
    process.env.NEXT_PUBLIC_DEFAULT_SUPPORT_PHONE_NUMBER,
  NEXT_PUBLIC_MAXIMUM_CHARACTER_SIZE_TO_COPY:
    process.env.NEXT_PUBLIC_MAXIMUM_CHARACTER_SIZE_TO_COPY,
  NEXT_PUBLIC_ENABLE_SUPPORT_PHONE:
    process.env.NEXT_PUBLIC_ENABLE_SUPPORT_PHONE,
  NEXT_PUBLIC_ENABLE_GRADEBOOK_TAB:
    process.env.NEXT_PUBLIC_ENABLE_GRADEBOOK_TAB,
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  NEXT_PUBLIC_TTS_IBLAI_MODE: process.env.NEXT_PUBLIC_TTS_IBLAI_MODE,
  NEXT_PUBLIC_TTS_KOKORO_MODEL: process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL,
  NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST:
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST,
  NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION:
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION,
  NEXT_PUBLIC_TTS_KOKORO_DTYPE: process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE,
  NEXT_PUBLIC_TTS_KOKORO_DEVICE: process.env.NEXT_PUBLIC_TTS_KOKORO_DEVICE,
  NEXT_PUBLIC_TTS_KOKORO_VOICE: process.env.NEXT_PUBLIC_TTS_KOKORO_VOICE,
  NEXT_PUBLIC_TTS_KOKORO_SPEED: process.env.NEXT_PUBLIC_TTS_KOKORO_SPEED,
  NEXT_PUBLIC_TTS_KOKORO_WASM_PATH:
    process.env.NEXT_PUBLIC_TTS_KOKORO_WASM_PATH,
};

const runtimeEnv = () =>
  typeof window !== 'undefined' ? (window as any).__ENV__ || {} : {};

export const getEnv = (key: keyof typeof env, fallback = ''): string => {
  // Prefer the first *non-empty* value. Plain `??` only falls back on
  // null/undefined, so an empty-string runtime value — which `env.js`
  // templating commonly emits for unset vars (`KEY: ""`) — would shadow a
  // meaningful fallback. e.g. NEXT_PUBLIC_MAXIMUM_CHARACTER_SIZE_TO_COPY=""
  // yields Number("") === 0 and turns every paste into an attachment chip.
  const runtime = runtimeEnv()[key];
  if (runtime !== undefined && runtime !== null && runtime !== '') {
    return runtime;
  }
  const build = env[key];
  if (build !== undefined && build !== null && build !== '') {
    return build;
  }
  return fallback;
};

const domain = () => getEnv('NEXT_PUBLIC_PLATFORM_BASE_DOMAIN', 'iblai.app');

export const config = {
  environment: () => getEnv('NODE_ENV', 'development'),
  authUrl: () => getEnv('NEXT_PUBLIC_AUTH_URL', `https://auth.${domain()}/`),
  lmsUrl: () => {
    const apiBase = getEnv('NEXT_PUBLIC_API_BASE_URL');
    if (apiBase) return `${apiBase}/lms`;
    return `https://learn.${domain()}`;
  },
  legacyLmsUrl: () =>
    getEnv('NEXT_PUBLIC_LEGACY_LMS_URL', 'https://learn.iblai.app'),
  dmUrl: () => {
    const apiBase = getEnv('NEXT_PUBLIC_API_BASE_URL');
    if (apiBase) return `${apiBase}/dm`;
    return `https://base.manager.${domain()}`;
  },
  axdUrl: () => {
    const apiBase = getEnv('NEXT_PUBLIC_API_BASE_URL');
    if (apiBase) return `${apiBase}/axd`;
    return `https://base.manager.${domain()}`;
  },
  mainTenantKey: () => getEnv('NEXT_PUBLIC_MAIN_TENANT_KEY', 'main'),
  iblTemplateMentor: () =>
    getEnv('NEXT_PUBLIC_IBL_TEMPLATE_MENTOR', 'ai-mentor'),
  iblPlatform: () => getEnv('NEXT_PUBLIC_IBL_PLATFORM', 'mentor'),
  iblEnableSpecialLogoWhenIframed: () =>
    getEnv('NEXT_PUBLIC_IBL_ENABLE_SPECIAL_LOGO_WHEN_IFRAMED', 'false'),
  mentorUrl: () => getEnv('NEXT_PUBLIC_MENTOR_URL', 'https://mentor.iblai.app'),
  mentorIframeUrl: () =>
    getEnv('NEXT_PUBLIC_MENTOR_IFRAME_URL', 'https://mentor.iblai.app'),
  externalPricingPageUrl: () =>
    getEnv(
      'NEXT_PUBLIC_EXTERNAL_PRICING_PAGE_URL',
      'https://ibl.ai/plans?embedded-for-pricing=true',
    ),
  stripeEnabled: () => getEnv('NEXT_PUBLIC_STRIPE_ENABLED', 'true'),
  baseWsUrl: () =>
    getEnv('NEXT_PUBLIC_BASE_WS_URL', 'https://asgi.data.iblai.app'),
  liveKitServerUrl: () =>
    getEnv(
      'NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL',
      'wss://livekit.call.iblai.app',
    ),
  mentorSettingsDisclaimer: () =>
    getEnv('NEXT_PUBLIC_MENTOR_SETTINGS_DISCLAIMER', ''),
  iframeFromOldMentor: () =>
    getEnv('NEXT_PUBLIC_IFRAME_FROM_OLD_MENTOR', 'false'),
  enableRBAC: () => getEnv('NEXT_PUBLIC_ENABLE_RBAC', 'false') === 'true',
  sentryDsn: () =>
    getEnv(
      'NEXT_PUBLIC_IBL_SENTRY_DSN',
      'https://f953ef66c4e0d5bda480069132dc9aee@sentry.ibl.network/33',
    ),
  helpCenterUrl: () =>
    getEnv('NEXT_PUBLIC_HELP_CENTER_URL', 'https://ibl.ai/support'),
  supportEmail: () =>
    getEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'support@iblai.zendesk.com'),
  documentationUrl: () =>
    getEnv('NEXT_PUBLIC_DOCUMENTATION_URL', 'https://ibl.ai/docs'),
  enableGravatarOnProfilePic: () =>
    getEnv('NEXT_PUBLIC_ENABLE_GRAVATAR_ON_PROFILE_PIC', 'true'),
  defaultEmbedCssUrl: () => getEnv('NEXT_PUBLIC_DEFAULT_EMBED_CSS_URL', ''),
  appBannerLink: () =>
    getEnv('NEXT_PUBLIC_APP_BANNER_LINK', 'https://ibl.ai/docs'),
  appBannerLinkText: () =>
    getEnv('NEXT_PUBLIC_APP_BANNER_LINK_TEXT', 'Check out'),
  appBannerBadge: () => getEnv('NEXT_PUBLIC_APP_BANNER_BADGE', 'New'),
  appBannerText: () =>
    getEnv('NEXT_PUBLIC_APP_BANNER_TEXT', 'Explore our latest features'),
  showAppBanner: () => getEnv('NEXT_PUBLIC_SHOW_APP_BANNER', 'false'),
  mentorTrainingMaximumFileSize: () =>
    getEnv('NEXT_PUBLIC_MENTOR_TRAINING_MAXIMUM_FILE_SIZE', '60'),
  hideAnalytics: () => getEnv('NEXT_PUBLIC_HIDE_ANALYTICS', 'false'),
  showBaseMentor: () =>
    getEnv('NEXT_PUBLIC_SHOW_BASE_MENTOR', 'false') === 'true',
  disabedDatasets: () => getEnv('NEXT_PUBLIC_DISABLED_DATASETS', 'zip|courses'),
  advertisingEnabled: () =>
    getEnv('NEXT_PUBLIC_ENABLE_ADVERTISING', 'false') === 'true',
  disabledAnalyticsReports: () =>
    getEnv(
      'NEXT_PUBLIC_DISABLED_ANALYTICS_REPORTS',
      'course|program|pathway|learner|video|user group metrics',
    ),
  platformBaseDomain: () =>
    getEnv('NEXT_PUBLIC_PLATFORM_BASE_DOMAIN', 'iblai.app'),
  defaultSupportPhoneNumber: () =>
    getEnv('NEXT_PUBLIC_DEFAULT_SUPPORT_PHONE_NUMBER', '(571) 293-0242') ||
    '(571) 293-0242',
  maximumCharacterSizeToCopy: () =>
    getEnv('NEXT_PUBLIC_MAXIMUM_CHARACTER_SIZE_TO_COPY', '2000'),
  enableSupportPhone: () =>
    getEnv('NEXT_PUBLIC_ENABLE_SUPPORT_PHONE', 'false') === 'true',
  enableGradebookTab: () =>
    getEnv('NEXT_PUBLIC_ENABLE_GRADEBOOK_TAB', 'false') === 'true',
  basePath: () => getEnv('NEXT_PUBLIC_BASE_PATH'),
  // The TTS knobs are returned raw: `lib/tts/config.ts` validates each one
  // against what kokoro-js accepts and owns the defaults, so a default here
  // would be a second copy of a model id, a pinned sha or a dtype table.
  ttsIblaiMode: () => getEnv('NEXT_PUBLIC_TTS_IBLAI_MODE'),
  ttsKokoroModel: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_MODEL'),
  ttsKokoroModelHost: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST'),
  ttsKokoroModelRevision: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION'),
  ttsKokoroDtype: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_DTYPE'),
  ttsKokoroDevice: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_DEVICE'),
  ttsKokoroVoice: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_VOICE'),
  ttsKokoroSpeed: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_SPEED'),
  ttsKokoroWasmPath: () => getEnv('NEXT_PUBLIC_TTS_KOKORO_WASM_PATH'),
};
