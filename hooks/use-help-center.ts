import { addProtocolToUrl } from '@iblai/iblai-js/web-utils';

import { config } from '@/lib/config';
import { useTenantObjectMetadata } from '@/hooks/use-tenant-object-metadata';

export function useHelpCenter(tenantKey?: string) {
  const metadata = useTenantObjectMetadata(tenantKey);

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
