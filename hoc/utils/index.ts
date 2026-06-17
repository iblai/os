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

/** Shape of a single field entry in the mentor settings `permissions.field` map. */
export type FieldPermission = {
  read?: boolean;
  write?: boolean;
  delete?: boolean;
};

/** The `permissions.field` map from the mentor settings endpoint. */
export type FieldPermissions = Record<string, FieldPermission> | undefined;

/**
 * Whether the current user may WRITE `field`. This is the exact mirror of the
 * `write` flag `WithFormPermissions` computes to enable/disable the matching
 * UI control, so the PUT payload can never contain a field whose control is
 * disabled (which is what the endpoint rejects with
 * `{"detail":"['No permission to write field: <name>']"}`).
 *
 * - field PRESENT in the permissions map → its `write` flag is authoritative,
 *   regardless of the RBAC config flag (this is how WithFormPermissions
 *   behaves — an explicit `write:false` always disables the control).
 * - field ABSENT from the map → writable only when RBAC gating is off, matching
 *   the WithFormPermissions default of `{ write: !enableRBAC }` for fields the
 *   endpoint does not describe.
 */
export const canWriteField = (
  permissions: FieldPermissions,
  field: string,
  enableRBAC: boolean = config.enableRBAC(),
): boolean => {
  const entry = permissions?.[field];
  if (entry) {
    return entry.write === true;
  }
  return !enableRBAC;
};

/**
 * Returns a shallow copy of `payload` with every field the user cannot write
 * stripped out, so a PUT only ever carries fields whose control is editable —
 * never a read-only field the endpoint would reject.
 *
 * `fieldNameMap` maps a payload key to the permission key that gates it, for
 * the cases where the two differ (e.g. `uploaded_profile_image` →
 * `profile_image`, `categories` → `metadata`). Payload keys absent from the
 * map are gated by their own name.
 *
 * Writability is decided by {@link canWriteField}: an explicit `write:false`
 * entry is always honoured (so it works even if the RBAC config flag is off but
 * the endpoint still returns field permissions), while fields the endpoint does
 * not describe are kept unless RBAC gating is enabled.
 */
export const pickWritableFields = <T extends Record<string, unknown>>(
  payload: T,
  permissions: FieldPermissions,
  options: {
    enableRBAC?: boolean;
    fieldNameMap?: Record<string, string>;
  } = {},
): Partial<T> => {
  const enableRBAC = options.enableRBAC ?? config.enableRBAC();
  const fieldNameMap = options.fieldNameMap ?? {};
  const result: Partial<T> = {};
  for (const key of Object.keys(payload) as Array<keyof T & string>) {
    const permissionKey = fieldNameMap[key] ?? key;
    if (canWriteField(permissions, permissionKey, enableRBAC)) {
      result[key] = payload[key];
    }
  }
  return result;
};
