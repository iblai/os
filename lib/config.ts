const env = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
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
};

const runtimeEnv = () =>
  typeof window !== "undefined" ? (window as any).__ENV__ || {} : {};

export const getEnv = (key: keyof typeof env, fallback = ""): string => {
  return runtimeEnv()[key] ?? env[key] ?? fallback;
};

const domain = () => getEnv("NEXT_PUBLIC_PLATFORM_BASE_DOMAIN", "iblai.app");

export const config = {
  environment: () => getEnv("NODE_ENV", "development"),
  authUrl: () => getEnv("NEXT_PUBLIC_AUTH_URL", `https://auth.${domain()}/`),
  lmsUrl: () => {
    const apiBase = getEnv("NEXT_PUBLIC_API_BASE_URL");
    if (apiBase) return `${apiBase}/lms`;
    return `https://learn.${domain()}`;
  },
  dmUrl: () => {
    const apiBase = getEnv("NEXT_PUBLIC_API_BASE_URL");
    if (apiBase) return `${apiBase}/dm`;
    return `https://base.manager.${domain()}`;
  },
  axdUrl: () => {
    const apiBase = getEnv("NEXT_PUBLIC_API_BASE_URL");
    if (apiBase) return `${apiBase}/axd`;
    return `https://base.manager.${domain()}`;
  },
  mainTenantKey: () => getEnv("NEXT_PUBLIC_MAIN_TENANT_KEY", "main"),
  iblTemplateMentor: () =>
    getEnv("NEXT_PUBLIC_IBL_TEMPLATE_MENTOR", "ai-mentor"),
  iblPlatform: () => getEnv("NEXT_PUBLIC_IBL_PLATFORM", "mentor"),
  iblEnableSpecialLogoWhenIframed: () =>
    getEnv("NEXT_PUBLIC_IBL_ENABLE_SPECIAL_LOGO_WHEN_IFRAMED", "false"),
  mentorUrl: () => getEnv("NEXT_PUBLIC_MENTOR_URL", "https://mentor.iblai.org"),
  mentorIframeUrl: () =>
    getEnv("NEXT_PUBLIC_MENTOR_IFRAME_URL", "https://mentor.iblai.org"),
  externalPricingPageUrl: () =>
    getEnv(
      "NEXT_PUBLIC_EXTERNAL_PRICING_PAGE_URL",
      "https://ibl.ai/plans?embedded-for-pricing=true",
    ),
  stripeEnabled: () => getEnv("NEXT_PUBLIC_STRIPE_ENABLED", "true"),
  baseWsUrl: () =>
    getEnv("NEXT_PUBLIC_BASE_WS_URL", "https://asgi.data.iblai.org"),
  liveKitServerUrl: () =>
    getEnv(
      "NEXT_PUBLIC_IBL_LIVE_KIT_SERVER_URL",
      "wss://livekit.call.iblai.org",
    ),
  mentorSettingsDisclaimer: () =>
    getEnv("NEXT_PUBLIC_MENTOR_SETTINGS_DISCLAIMER", ""),
  iframeFromOldMentor: () =>
    getEnv("NEXT_PUBLIC_IFRAME_FROM_OLD_MENTOR", "false"),
  enableRBAC: () => getEnv("NEXT_PUBLIC_ENABLE_RBAC", "false") === "true",
  sentryDsn: () =>
    getEnv(
      "NEXT_PUBLIC_IBL_SENTRY_DSN",
      "https://f953ef66c4e0d5bda480069132dc9aee@sentry.ibl.network/33",
    ),
  helpCenterUrl: () =>
    getEnv("NEXT_PUBLIC_HELP_CENTER_URL", "https://docs.ibl.ai"),
  supportEmail: () => getEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "support@ibl.ai"),
  enableGravatarOnProfilePic: () =>
    getEnv("NEXT_PUBLIC_ENABLE_GRAVATAR_ON_PROFILE_PIC", "true"),
  defaultEmbedCssUrl: () => getEnv("NEXT_PUBLIC_DEFAULT_EMBED_CSS_URL", ""),
  appBannerLink: () =>
    getEnv("NEXT_PUBLIC_APP_BANNER_LINK", "https://docs.ibl.ai"),
  appBannerLinkText: () =>
    getEnv("NEXT_PUBLIC_APP_BANNER_LINK_TEXT", "View all"),
  appBannerBadge: () => getEnv("NEXT_PUBLIC_APP_BANNER_BADGE", "New"),
  appBannerText: () =>
    getEnv(
      "NEXT_PUBLIC_APP_BANNER_TEXT",
      "Explore our latest features for students",
    ),
  showAppBanner: () => getEnv("NEXT_PUBLIC_SHOW_APP_BANNER", "false"),
  mentorTrainingMaximumFileSize: () =>
    getEnv("NEXT_PUBLIC_MENTOR_TRAINING_MAXIMUM_FILE_SIZE", "60"),
  hideAnalytics: () => getEnv("NEXT_PUBLIC_HIDE_ANALYTICS", "false"),
  showBaseMentor: () =>
    getEnv("NEXT_PUBLIC_SHOW_BASE_MENTOR", "false") === "true",
  disabedDatasets: () => getEnv("NEXT_PUBLIC_DISABLED_DATASETS", "zip|courses"),
  advertisingEnabled: () =>
    getEnv("NEXT_PUBLIC_ENABLE_ADVERTISING", "false") === "true",
  disabledAnalyticsReports: () =>
    getEnv(
      "NEXT_PUBLIC_DISABLED_ANALYTICS_REPORTS",
      "course|program|pathway|learner|video|user group metrics",
    ),
  platformBaseDomain: () =>
    getEnv("NEXT_PUBLIC_PLATFORM_BASE_DOMAIN", "iblai.app"),
};
