import { createSlice, PayloadAction, Slice } from '@reduxjs/toolkit/react';

// Define types for modal state
export interface ModalInfo {
  name: string;
  tab?: string;
  mentorId?: string;
}

export interface customAlertDialogInfo {
  message: string;
  validateTrigger: string;
  cancelTrigger?: string;
  isOpen: boolean;
  title: string;
}

export interface ModalState {
  modalStack: ModalInfo[];
  customAlertDialog: customAlertDialogInfo;
  iframeCloseButton: boolean;
  darkMode: boolean;
  shortcutsModal: boolean;
}

const initialState: ModalState = {
  modalStack: [],
  customAlertDialog: {
    message: '',
    validateTrigger: '',
    cancelTrigger: '',
    isOpen: false,
    title: '',
  },
  iframeCloseButton: false,
  shortcutsModal: false,
  darkMode: false,
};

export const modalSlice: Slice<ModalState> = createSlice({
  name: 'modalSlice',
  initialState,
  reducers: {
    // Renamed for clarity: This action is now primarily for syncing the URL state to Redux.
    // It can also be used for direct initialization if needed.
    setModalStack: (state, action: PayloadAction<ModalInfo[]>) => {
      state.modalStack = action.payload;
    },

    // Initialize the custom alert dialog stack from URL (or other sources)
    initCustomAlertDialog: (state, action: PayloadAction<customAlertDialogInfo>) => {
      state.customAlertDialog = action.payload;
    },

    // The following actions (pushModal, popModal, updateCurrentModalTab, clearModals)
    // are kept in case other parts of the application use them directly.
    // However, the refactored useNavigate hook will primarily rely on setModalStack
    // after computing the new stack and updating the URL.

    // Push a new modal to the stack
    pushModal: (state, action: PayloadAction<ModalInfo>) => {
      // This action can be used if direct manipulation of Redux stack is needed
      // outside the URL-driven flow. For URL-driven changes, setModalStack is preferred.
      state.modalStack.push(action.payload);
    },

    // Pop the top modal from the stack
    popModal: (state) => {
      // Similar to pushModal, for direct Redux manipulation.
      state.modalStack.pop();
    },

    // Update the tab of the top-most modal
    updateCurrentModalTab: (state, action: PayloadAction<string>) => {
      if (state.modalStack.length > 0) {
        const lastIndex = state.modalStack.length - 1;
        // Ensure the modal object exists before trying to spread its properties
        if (state.modalStack[lastIndex]) {
          state.modalStack[lastIndex] = {
            ...state.modalStack[lastIndex],
            tab: action.payload,
          };
        }
      }
    },

    // Clear all modals
    clearModals: (state) => {
      state.modalStack = [];
    },

    // iframeCloseButtonEnabled: (state, action: PayloadAction<boolean>) => {
    //   state.iframeCloseButton = action.payload;
    // },

    darkModeUpdated: (state, action: PayloadAction<boolean>) => {
      state.darkMode = action.payload;
    },

    shortcutsModalUpdated: (state, action: PayloadAction<boolean>) => {
      state.shortcutsModal = action.payload;
    },
  },
});

export const {
  setModalStack, // Renamed from initModalStack for broader use
  initCustomAlertDialog,
  pushModal,
  popModal,
  updateCurrentModalTab,
  clearModals,
  // iframeCloseButtonEnabled,
  darkModeUpdated,
  shortcutsModalUpdated,
} = modalSlice.actions;

// Selectors
export const selectModalStack = (state: { modals: ModalState }) => state.modals.modalStack;

export const selectCurrentModal = (state: { modals: ModalState }) => {
  const { modalStack } = state.modals;
  return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
};

export const selectIsModalOpen = (name: string) => (state: { modals: ModalState }) => {
  return state.modals.modalStack.some((modal) => modal.name === name);
};

export const selectModalTab = (name: string) => (state: { modals: ModalState }) => {
  const modal = state.modals.modalStack.find((m) => m.name === name);
  return modal?.tab;
};

export const selectModalMentorId = (state: { modals: ModalState }) => {
  const currentModal = selectCurrentModal(state);
  return currentModal?.mentorId;
};

export const selectShortcutsModal = (state: { modals: ModalState }) => state.modals.shortcutsModal;

export const modalReducer = modalSlice.reducer;
