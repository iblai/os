import { addProtocolToUrl, useTenantMetadata } from '@iblai/iblai-js/web-utils';

import { config } from '@/lib/config';

export function useHelpCenter(tenantKey?: string) {
  const { metadata } = useTenantMetadata({ org: tenantKey ?? '' });

  return {
    helpCenterUrl: addProtocolToUrl(
      metadata?.support_url ||
        metadata?.help_center_url ||
        config.helpCenterUrl(),
    ),
    documentationUrl: addProtocolToUrl(
      metadata?.documentation_url || config.documentationUrl(),
    ),
    supportEmail: metadata?.support_email || config.supportEmail(),
    showHelp: metadata?.show_help !== false,
  };
}
