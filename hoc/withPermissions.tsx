'use client';

import { config } from '@/lib/config';
import React from 'react';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import {
  WithFormPermissions as BaseWithFormPermissions,
  WithPermissions as BaseWithPermissions,
  checkRbacPermission as baseCheckRbacPermission,
} from '@iblai/iblai-js/web-utils';

type WithFormPermissionsProps = {
  name: string | string[];
  permissions: Record<string, { read?: boolean; write: boolean; delete?: boolean }>;
  children: (props: { disabled: boolean; canDelete?: boolean }) => React.ReactNode;
};

/**
 * Wrapper around web-utils WithFormPermissions that automatically provides enableRBAC from config
 */
const WithFormPermissions: React.FC<WithFormPermissionsProps> = ({
  name,
  permissions,
  children,
}) => {
  return (
    <BaseWithFormPermissions name={name} permissions={permissions} enableRBAC={config.enableRBAC()}>
      {children}
    </BaseWithFormPermissions>
  );
};

export default WithFormPermissions;

/**
 * Check if the user has the permissions to access the component
 * Wrapper around web-utils WithPermissions that automatically provides rbacPermissions from Redux store
 * @param rbacResource - The resource in the permission rbac slice to check for.
 * @param children - The component to render if the user has the permissions.
 */
type WithPermissionsProps = {
  rbacResource: string;
  children: (props: { hasPermission: boolean }) => React.ReactNode;
};

export const WithPermissions = ({ rbacResource, children }: WithPermissionsProps) => {
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  return (
    <BaseWithPermissions rbacResource={rbacResource} rbacPermissions={rbacPermissions}>
      {children}
    </BaseWithPermissions>
  );
};

/**
 * Check RBAC permissions for a single resource
 * Wrapper around web-utils checkRbacPermission that automatically provides enableRBAC from config
 * @param rbacPermissions - The RBAC permissions object
 * @param rbacResource - The resource path to check (e.g., "mentors#read" or "mentor#write")
 * @returns boolean indicating if permission exists
 */
export const checkRbacPermission = (rbacPermissions: object, rbacResource: string): boolean => {
  return baseCheckRbacPermission(rbacPermissions, rbacResource, config.enableRBAC());
};
