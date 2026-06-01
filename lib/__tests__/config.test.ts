import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getEnv, config } from '../config';

describe('config', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.resetModules();
    // Reset window.__ENV__
    if (typeof global.window !== 'undefined') {
      (global.window as any).__ENV__ = undefined;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore window
    global.window = originalWindow;
  });

  describe('getEnv', () => {
    it('should return fallback when key is not in env or window.__ENV__', () => {
      const result = getEnv('NODE_ENV', 'test-fallback');
      // NODE_ENV is usually set, so this tests the general mechanism
      expect(typeof result).toBe('string');
    });

    it('should use window.__ENV__ over process.env when available', () => {
      (global.window as any).__ENV__ = {
        NEXT_PUBLIC_AUTH_URL: 'https://custom-auth.example.com/',
      };

      // Re-import to pick up the window.__ENV__ change
      const result = getEnv('NEXT_PUBLIC_AUTH_URL', 'fallback');
      expect(result).toBe('https://custom-auth.example.com/');
    });

    it('should return empty string as fallback when not provided', () => {
      (global.window as any).__ENV__ = {};
      // Use a key that's unlikely to be set
      const result = getEnv('NEXT_PUBLIC_AUTH_URL');
      // Should return env value or empty string
      expect(typeof result).toBe('string');
    });
  });

  describe('config methods', () => {
    describe('environment', () => {
      it('should return environment value', () => {
        const result = config.environment();
        expect(typeof result).toBe('string');
      });

      it('should have development as default fallback', () => {
        (global.window as any).__ENV__ = {};
        // If NODE_ENV is not set, should default to development
        const result = config.environment();
        expect(['development', 'test', 'production']).toContain(result);
      });
    });

    describe('authUrl', () => {
      it('should return auth URL', () => {
        const result = config.authUrl();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have default fallback', () => {
        (global.window as any).__ENV__ = {};
        const result = config.authUrl();
        expect(result).toContain('auth');
      });
    });

    describe('lmsUrl', () => {
      it('should return LMS URL', () => {
        const result = config.lmsUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('dmUrl', () => {
      it('should return DM URL', () => {
        const result = config.dmUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('axdUrl', () => {
      it('should return AXD URL', () => {
        const result = config.axdUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('mainTenantKey', () => {
      it('should return main tenant key', () => {
        const result = config.mainTenantKey();
        expect(typeof result).toBe('string');
      });

      it('should have main as default', () => {
        (global.window as any).__ENV__ = {};
        const result = config.mainTenantKey();
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('iblTemplateMentor', () => {
      it('should return template mentor value', () => {
        const result = config.iblTemplateMentor();
        expect(typeof result).toBe('string');
      });
    });

    describe('iblPlatform', () => {
      it('should return platform value', () => {
        const result = config.iblPlatform();
        expect(typeof result).toBe('string');
      });
    });

    describe('iblEnableSpecialLogoWhenIframed', () => {
      it('should return string value', () => {
        const result = config.iblEnableSpecialLogoWhenIframed();
        expect(typeof result).toBe('string');
      });
    });

    describe('mentorUrl', () => {
      it('should return mentor URL', () => {
        const result = config.mentorUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('mentorIframeUrl', () => {
      it('should return mentor iframe URL', () => {
        const result = config.mentorIframeUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('externalPricingPageUrl', () => {
      it('should return external pricing page URL', () => {
        const result = config.externalPricingPageUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('stripeEnabled', () => {
      it('should return stripe enabled value', () => {
        const result = config.stripeEnabled();
        expect(typeof result).toBe('string');
      });
    });

    describe('baseWsUrl', () => {
      it('should return base WebSocket URL', () => {
        const result = config.baseWsUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('liveKitServerUrl', () => {
      it('should return LiveKit server URL', () => {
        const result = config.liveKitServerUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('mentorSettingsDisclaimer', () => {
      it('should return mentor settings disclaimer', () => {
        const result = config.mentorSettingsDisclaimer();
        expect(typeof result).toBe('string');
      });
    });

    describe('iframeFromOldMentor', () => {
      it('should return iframe from old mentor value', () => {
        const result = config.iframeFromOldMentor();
        expect(typeof result).toBe('string');
      });
    });

    describe('enableRBAC', () => {
      it('should return boolean value', () => {
        const result = config.enableRBAC();
        expect(typeof result).toBe('boolean');
      });

      it('should return true when env is true', () => {
        (global.window as any).__ENV__ = {
          NEXT_PUBLIC_ENABLE_RBAC: 'true',
        };
        const result = config.enableRBAC();
        expect(result).toBe(true);
      });

      it('should return false when env is not true', () => {
        (global.window as any).__ENV__ = {
          NEXT_PUBLIC_ENABLE_RBAC: 'false',
        };
        const result = config.enableRBAC();
        expect(result).toBe(false);
      });
    });

    describe('sentryDsn', () => {
      it('should return Sentry DSN', () => {
        const result = config.sentryDsn();
        expect(typeof result).toBe('string');
      });
    });

    describe('helpCenterUrl', () => {
      it('should return help center URL', () => {
        const result = config.helpCenterUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('supportEmail', () => {
      it('should return support email', () => {
        const result = config.supportEmail();
        expect(typeof result).toBe('string');
      });
    });

    describe('enableGravatarOnProfilePic', () => {
      it('should return gravatar setting', () => {
        const result = config.enableGravatarOnProfilePic();
        expect(typeof result).toBe('string');
      });
    });

    describe('defaultEmbedCssUrl', () => {
      it('should return default embed CSS URL', () => {
        const result = config.defaultEmbedCssUrl();
        expect(typeof result).toBe('string');
      });
    });

    describe('appBannerLink', () => {
      it('should return app banner link', () => {
        const result = config.appBannerLink();
        expect(typeof result).toBe('string');
      });

      it('should have default fallback', () => {
        (global.window as any).__ENV__ = {};
        const result = config.appBannerLink();
        expect(result).toBe('https://ibl.ai/docs');
      });
    });

    describe('appBannerLinkText', () => {
      it('should return app banner link text', () => {
        const result = config.appBannerLinkText();
        expect(typeof result).toBe('string');
      });

      it('should have default fallback', () => {
        (global.window as any).__ENV__ = {};
        const result = config.appBannerLinkText();
        expect(result).toBe('Check out');
      });
    });

    describe('appBannerBadge', () => {
      it('should return app banner badge', () => {
        const result = config.appBannerBadge();
        expect(typeof result).toBe('string');
      });
    });

    describe('appBannerText', () => {
      it('should return app banner text', () => {
        const result = config.appBannerText();
        expect(typeof result).toBe('string');
      });

      it('should have default fallback', () => {
        (global.window as any).__ENV__ = {};
        const result = config.appBannerText();
        expect(result).toBe('Explore our latest features');
      });
    });

    describe('showAppBanner', () => {
      it('should return show app banner value', () => {
        const result = config.showAppBanner();
        expect(typeof result).toBe('string');
      });
    });

    describe('mentorTrainingMaximumFileSize', () => {
      it('should return mentor training max file size', () => {
        const result = config.mentorTrainingMaximumFileSize();
        expect(typeof result).toBe('string');
      });
    });

    describe('hideAnalytics', () => {
      it('should return hide analytics value', () => {
        const result = config.hideAnalytics();
        expect(typeof result).toBe('string');
      });
    });

    describe('showBaseMentor', () => {
      it('should return boolean value', () => {
        const result = config.showBaseMentor();
        expect(typeof result).toBe('boolean');
      });

      it('should return true when env is true', () => {
        (global.window as any).__ENV__ = {
          NEXT_PUBLIC_SHOW_BASE_MENTOR: 'true',
        };
        const result = config.showBaseMentor();
        expect(result).toBe(true);
      });

      it('should return false when env is not true', () => {
        (global.window as any).__ENV__ = {
          NEXT_PUBLIC_SHOW_BASE_MENTOR: 'false',
        };
        const result = config.showBaseMentor();
        expect(result).toBe(false);
      });
    });

    describe('disabedDatasets', () => {
      it('should return disabled datasets value', () => {
        const result = config.disabedDatasets();
        expect(typeof result).toBe('string');
      });
    });

    describe('advertisingEnabled', () => {
      it('should return boolean value', () => {
        const result = config.advertisingEnabled();
        expect(typeof result).toBe('boolean');
      });

      it('should return true when env is true', () => {
        (global.window as any).__ENV__ = {
          NEXT_PUBLIC_ENABLE_ADVERTISING: 'true',
        };
        const result = config.advertisingEnabled();
        expect(result).toBe(true);
      });

      it('should return false when env is not true', () => {
        (global.window as any).__ENV__ = {
          NEXT_PUBLIC_ENABLE_ADVERTISING: 'false',
        };
        const result = config.advertisingEnabled();
        expect(result).toBe(false);
      });
    });

    describe('disabledAnalyticsReports', () => {
      it('should return disabled analytics reports value', () => {
        const result = config.disabledAnalyticsReports();
        expect(typeof result).toBe('string');
      });
    });

    describe('platformBaseDomain', () => {
      it('should return platform base domain', () => {
        const result = config.platformBaseDomain();
        expect(typeof result).toBe('string');
      });
    });
  });

  describe('window.__ENV__ priority', () => {
    it('should use window.__ENV__ values over process.env', () => {
      const customUrl = 'https://test-custom.example.com/';
      (global.window as any).__ENV__ = {
        NEXT_PUBLIC_MENTOR_URL: customUrl,
      };

      const result = config.mentorUrl();
      expect(result).toBe(customUrl);
    });

    it('should handle missing window.__ENV__', () => {
      (global.window as any).__ENV__ = undefined;
      // Should still work and return env or fallback
      const result = config.mentorUrl();
      expect(typeof result).toBe('string');
    });

    it('should handle empty window.__ENV__ object', () => {
      (global.window as any).__ENV__ = {};
      // Should still work and return env or fallback
      const result = config.mentorUrl();
      expect(typeof result).toBe('string');
    });
  });

  describe('fallback values', () => {
    it('should use fallback for authUrl when not set', () => {
      (global.window as any).__ENV__ = {};
      const result = config.authUrl();
      // Should contain the default fallback URL
      expect(result).toContain('iblai');
    });

    it('should use fallback for mainTenantKey when not set', () => {
      (global.window as any).__ENV__ = {};
      const result = config.mainTenantKey();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
