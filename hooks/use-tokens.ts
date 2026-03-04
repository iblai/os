import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { useLocalStorage } from './use-local-storage';

export function useDmToken() {
  const [token] = useLocalStorage(LOCAL_STORAGE_KEYS.DM_TOKEN_KEY, '');

  return token;
}

export function useAxdToken() {
  const [token] = useLocalStorage(LOCAL_STORAGE_KEYS.AXD_TOKEN_KEY, '');

  return token;
}
