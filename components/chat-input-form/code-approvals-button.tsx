'use client';

import { useTranslations } from 'next-intl';
import {
  ApprovalsModeButton,
  createApprovalModeStore,
  PERMISSION_MODES,
  PERMISSION_MODE_ICONS,
  type PermissionMode,
} from '@iblai/iblai-js/web-containers/next';

export { PERMISSION_MODES, PERMISSION_MODE_ICONS, type PermissionMode };

// Module-level: one mode for every chat, shared by every Code control on
// screen, so the canvas split's two composers never disagree.
const codeApprovalModeStore = createApprovalModeStore();

export const {
  useApprovalMode,
  useOfferApprovals,
  useApprovalsOffered,
  setApprovalMode,
  applyApprovalMode,
  loadApprovalMode,
  seedApprovalMode,
  resetApprovalModeForTests,
} = codeApprovalModeStore;

export function CodeApprovalsButton({
  mode,
  onChange,
}: {
  mode: PermissionMode;
  onChange: (mode: PermissionMode) => void;
}) {
  const t = useTranslations('chatInputFormCodingModeButton');
  return (
    <ApprovalsModeButton
      mode={mode}
      onChange={onChange}
      labels={{
        permissionModeLabel: t('permissionModeLabel'),
        permissionModeManual: t('permissionModeManual'),
        permissionModeAuto: t('permissionModeAuto'),
        permissionModeManualHint: t('permissionModeManualHint'),
        permissionModeAutoHint: t('permissionModeAutoHint'),
        approvalsAria: (name) => t('approvalsAria', { mode: name }),
      }}
    />
  );
}
