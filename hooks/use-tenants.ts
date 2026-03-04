import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { useLocalStorage } from '@/hooks/use-local-storage';

export function useTenantKey() {
  const [tenant, saveTenant] = useLocalStorage<string | null>(
    LOCAL_STORAGE_KEYS.DEFAULT_TENANT,
    null,
    {
      serializer: (value: string | null) => value as string,
    },
  );

  return { tenant, saveTenant };
}
