import { useAuthContext } from '@iblai/iblai-js/web-utils';

export function useAccessingPublicRoute() {
  const { userIsAccessingPublicRoute } = useAuthContext();

  return userIsAccessingPublicRoute;
}
