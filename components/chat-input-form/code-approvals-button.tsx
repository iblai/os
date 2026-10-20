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

// One mode for every chat, saved by the desktop and shared by every Code
// control on screen, so two composers (the canvas split) never disagree and a
// composer mounting mid-chat shows the mode in force. `picks` counts the
// user's choices and `seeds` the profile's mode taking effect, so a read that
// started before either never overwrites it.
//
// Seeded to Ask Me, NOT to the saved default: until the desktop answers we do
// not know the mode, and claiming Automatic in that window tells a user who
// chose Ask Me that Code may act unasked. Rust holds the same invariant from
// the other side, where damage can only make Code ask more, never less.
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
