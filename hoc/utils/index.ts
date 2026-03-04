import { config } from '@/lib/config';

export const rbacPermissionToDisplay = (
  permissionFields: string[],
  permissions: Record<string, { read: boolean; write: boolean }>,
) => {
  if (!config.enableRBAC() || !permissions || permissionFields.length === 0) {
    return true;
  }
  let display = false;
  for (let field of permissionFields) {
    if (permissions[field]?.read) {
      display = true;
    }
  }
  return display;
};
