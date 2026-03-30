"use client";

import React from "react";

import { useSelector } from "react-redux";

import { RootState } from "@/store";
import { MODALS } from "@/lib/constants";
import { useNavigate } from "@/hooks/user-navigate";
import {
  selectIsModalOpen,
  selectShortcutsModal,
  shortcutsModalUpdated,
} from "@/features/navigation/slice";

// Modals
import { SettingsModal } from "@/components/modals/settings-modal";
// import { CreateMentorModal } from '@/components/modals/create-mentor-modal';
import { CustomAlertDialog } from "../custom-alert-dialog";
import { ExternalPricingModal } from "./external-pricing-modal";
import {
  setOpenPricingModal,
  setOpenAppleRestrictionModal,
} from "@/features/subscription/subscription-slice";
import { AppleRestrictionModal } from "@/components/modals/apple-restriction-modal";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  InvitedUsersDialog,
  InviteUserDialog,
} from "@iblai/iblai-js/web-containers";
import { TenantKeyMentorIdParams } from "@/lib/types";
import { useParams } from "next/navigation";
import { ShortcutsModal } from "./shortcuts-modal";
import { MyMentorsModal } from "./my-mentors-modal";
import { NoMentorSelectedModal } from "./no-mentor-selected-modal";

export const ModalContainer = () => {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const [isInvitedUsersDialogOpen, setIsInvitedUsersDialogOpen] =
    React.useState(false);
  const {
    // Close modal functions
    // closeCreateMentorModal,
    closeInviteUserModal,
    closeSettingsModal,
    closeMyMentorsModal,
    closeNoMentorSelectedModal,
    showMyMentorsModal,
  } = useNavigate();

  // Get state once with useSelector
  const state = useSelector((state: RootState) => state);
  const dispatch = useAppDispatch();

  const { customAlertDialog } = state.modals;

  const { openPricingModal, openAppleRestrictionModal } = state.subscription;

  // Use state with selectors
  // const showCreateMentorModal = selectIsModalOpen(MODALS.CREATE_MENTOR.name)(
  //   state
  // );
  const showInviteUserModal = selectIsModalOpen(MODALS.INVITE_USER.name)(state);
  const showSettingsModal = selectIsModalOpen(MODALS.SETTINGS.name)(state);
  const showNoMentorSelectedModal = selectIsModalOpen(
    MODALS.NO_MENTOR_SELECTED.name,
  )(state);

  const closeShortcutsModal = () => {
    dispatch(shortcutsModalUpdated(false));
  };
  const showShortcutsModal = useAppSelector(selectShortcutsModal);

  return (
    <>
      {/* Create Mentor Modal */}
      {/* {showCreateMentorModal && (
        <CreateMentorModal
          isOpen={showCreateMentorModal}
          onClose={closeCreateMentorModal}
        />
      )} */}

      {/* Invite User Modal */}
      {showInviteUserModal && (
        <InviteUserDialog
          isOpen={showInviteUserModal}
          onClose={closeInviteUserModal}
          tenant={tenantKey}
          //onSeeAllInvitedUsersClick={() => setIsInvitedUsersDialogOpen(true)}
        />
      )}

      {isInvitedUsersDialogOpen && (
        <InvitedUsersDialog
          onClose={() => setIsInvitedUsersDialogOpen(false)}
          tenant={tenantKey}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={closeSettingsModal}
        />
      )}

      {/* Custom Alert Dialog */}
      {customAlertDialog.isOpen && (
        <CustomAlertDialog
          isOpen={customAlertDialog.isOpen}
          title={customAlertDialog.title}
          message={customAlertDialog.message}
          validateTrigger={customAlertDialog.validateTrigger}
          cancelTrigger={customAlertDialog.cancelTrigger}
        />
      )}

      {openPricingModal && (
        <ExternalPricingModal
          isOpen={openPricingModal}
          onClose={() => dispatch(setOpenPricingModal(false))}
        />
      )}

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <ShortcutsModal
          isOpen={showShortcutsModal}
          onClose={closeShortcutsModal}
        />
      )}

      {/* My Mentors Modal */}
      {showMyMentorsModal && (
        <MyMentorsModal
          isOpen={showMyMentorsModal}
          onClose={closeMyMentorsModal}
        />
      )}

      {/* No Mentor Selected Modal */}
      {showNoMentorSelectedModal && (
        <NoMentorSelectedModal
          isOpen={showNoMentorSelectedModal}
          onClose={closeNoMentorSelectedModal}
        />
      )}

      {/* Apple Restriction Modal */}
      {openAppleRestrictionModal && (
        <AppleRestrictionModal
          isOpen={openAppleRestrictionModal}
          onClose={() => dispatch(setOpenAppleRestrictionModal(false))}
        />
      )}
    </>
  );
};
