import { describe, it, expect } from 'vitest';
import {
  modalReducer,
  setModalStack,
  initCustomAlertDialog,
  pushModal,
  popModal,
  updateCurrentModalTab,
  clearModals,
  darkModeUpdated,
  shortcutsModalUpdated,
  selectModalStack,
  selectCurrentModal,
  selectIsModalOpen,
  selectModalTab,
  selectModalMentorId,
  selectShortcutsModal,
  type ModalInfo,
  type ModalState,
  type customAlertDialogInfo,
} from '../slice';

describe('navigation slice', () => {
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

  describe('initial state', () => {
    it('should have empty modal stack', () => {
      const state = modalReducer(undefined, { type: '@@INIT' });
      expect(state.modalStack).toEqual([]);
    });

    it('should have default custom alert dialog', () => {
      const state = modalReducer(undefined, { type: '@@INIT' });
      expect(state.customAlertDialog).toEqual({
        message: '',
        validateTrigger: '',
        cancelTrigger: '',
        isOpen: false,
        title: '',
      });
    });

    it('should have default flags', () => {
      const state = modalReducer(undefined, { type: '@@INIT' });
      expect(state.iframeCloseButton).toBe(false);
      expect(state.shortcutsModal).toBe(false);
      expect(state.darkMode).toBe(false);
    });
  });

  describe('setModalStack', () => {
    it('should set modal stack', () => {
      const modals: ModalInfo[] = [{ name: 'settings' }, { name: 'profile', tab: 'general' }];

      const state = modalReducer(initialState, setModalStack(modals));
      expect(state.modalStack).toEqual(modals);
    });

    it('should replace existing modal stack', () => {
      const modals1: ModalInfo[] = [{ name: 'settings' }];
      const modals2: ModalInfo[] = [{ name: 'profile' }, { name: 'help' }];

      let state = modalReducer(initialState, setModalStack(modals1));
      state = modalReducer(state, setModalStack(modals2));
      expect(state.modalStack).toEqual(modals2);
    });
  });

  describe('initCustomAlertDialog', () => {
    it('should initialize custom alert dialog', () => {
      const dialog: customAlertDialogInfo = {
        message: 'Are you sure?',
        validateTrigger: 'confirm',
        cancelTrigger: 'cancel',
        isOpen: true,
        title: 'Confirmation',
      };

      const state = modalReducer(initialState, initCustomAlertDialog(dialog));
      expect(state.customAlertDialog).toEqual(dialog);
    });
  });

  describe('pushModal', () => {
    it('should push modal to stack', () => {
      const modal: ModalInfo = { name: 'settings' };
      const state = modalReducer(initialState, pushModal(modal));
      expect(state.modalStack).toHaveLength(1);
      expect(state.modalStack[0]).toEqual(modal);
    });

    it('should push multiple modals', () => {
      const modal1: ModalInfo = { name: 'settings' };
      const modal2: ModalInfo = { name: 'profile', tab: 'general' };

      let state = modalReducer(initialState, pushModal(modal1));
      state = modalReducer(state, pushModal(modal2));

      expect(state.modalStack).toHaveLength(2);
      expect(state.modalStack[0]).toEqual(modal1);
      expect(state.modalStack[1]).toEqual(modal2);
    });

    it('should push modal with mentorId', () => {
      const modal: ModalInfo = { name: 'mentor-details', mentorId: 'mentor-123' };
      const state = modalReducer(initialState, pushModal(modal));
      expect(state.modalStack[0].mentorId).toBe('mentor-123');
    });
  });

  describe('popModal', () => {
    it('should pop modal from stack', () => {
      const modals: ModalInfo[] = [{ name: 'settings' }, { name: 'profile' }];
      let state = modalReducer(initialState, setModalStack(modals));
      state = modalReducer(state, popModal(undefined));

      expect(state.modalStack).toHaveLength(1);
      expect(state.modalStack[0]).toEqual({ name: 'settings' });
    });

    it('should handle popping from empty stack', () => {
      const state = modalReducer(initialState, popModal(undefined));
      expect(state.modalStack).toEqual([]);
    });

    it('should pop last modal leaving stack empty', () => {
      let state = modalReducer(initialState, pushModal({ name: 'settings' }));
      state = modalReducer(state, popModal(undefined));
      expect(state.modalStack).toEqual([]);
    });
  });

  describe('updateCurrentModalTab', () => {
    it('should update tab of current modal', () => {
      let state = modalReducer(initialState, pushModal({ name: 'settings', tab: 'general' }));
      state = modalReducer(state, updateCurrentModalTab('advanced'));

      expect(state.modalStack[0].tab).toBe('advanced');
    });

    it('should update only the last modal', () => {
      let state = modalReducer(initialState, pushModal({ name: 'settings', tab: 'general' }));
      state = modalReducer(state, pushModal({ name: 'profile', tab: 'info' }));
      state = modalReducer(state, updateCurrentModalTab('preferences'));

      expect(state.modalStack[0].tab).toBe('general');
      expect(state.modalStack[1].tab).toBe('preferences');
    });

    it('should handle empty stack', () => {
      const state = modalReducer(initialState, updateCurrentModalTab('advanced'));
      expect(state.modalStack).toEqual([]);
    });

    it('should add tab property if it did not exist', () => {
      let state = modalReducer(initialState, pushModal({ name: 'settings' }));
      state = modalReducer(state, updateCurrentModalTab('general'));

      expect(state.modalStack[0].tab).toBe('general');
    });
  });

  describe('clearModals', () => {
    it('should clear all modals', () => {
      const modals: ModalInfo[] = [{ name: 'settings' }, { name: 'profile' }, { name: 'help' }];

      let state = modalReducer(initialState, setModalStack(modals));
      state = modalReducer(state, clearModals(undefined));

      expect(state.modalStack).toEqual([]);
    });

    it('should handle clearing empty stack', () => {
      const state = modalReducer(initialState, clearModals(undefined));
      expect(state.modalStack).toEqual([]);
    });
  });

  describe('darkModeUpdated', () => {
    it('should enable dark mode', () => {
      const state = modalReducer(initialState, darkModeUpdated(true));
      expect(state.darkMode).toBe(true);
    });

    it('should disable dark mode', () => {
      let state = modalReducer(initialState, darkModeUpdated(true));
      state = modalReducer(state, darkModeUpdated(false));
      expect(state.darkMode).toBe(false);
    });
  });

  describe('shortcutsModalUpdated', () => {
    it('should open shortcuts modal', () => {
      const state = modalReducer(initialState, shortcutsModalUpdated(true));
      expect(state.shortcutsModal).toBe(true);
    });

    it('should close shortcuts modal', () => {
      let state = modalReducer(initialState, shortcutsModalUpdated(true));
      state = modalReducer(state, shortcutsModalUpdated(false));
      expect(state.shortcutsModal).toBe(false);
    });
  });

  describe('selectors', () => {
    const mockState = {
      modals: {
        modalStack: [
          { name: 'settings', tab: 'general' },
          { name: 'profile', tab: 'info', mentorId: 'mentor-123' },
        ],
        customAlertDialog: {
          message: 'Test',
          validateTrigger: 'ok',
          isOpen: true,
          title: 'Alert',
        },
        iframeCloseButton: false,
        shortcutsModal: true,
        darkMode: false,
      },
    };

    describe('selectModalStack', () => {
      it('should select modal stack', () => {
        expect(selectModalStack(mockState)).toEqual(mockState.modals.modalStack);
      });
    });

    describe('selectCurrentModal', () => {
      it('should select last modal', () => {
        expect(selectCurrentModal(mockState)).toEqual({
          name: 'profile',
          tab: 'info',
          mentorId: 'mentor-123',
        });
      });

      it('should return null for empty stack', () => {
        const emptyState = { modals: { ...mockState.modals, modalStack: [] } };
        expect(selectCurrentModal(emptyState)).toBeNull();
      });
    });

    describe('selectIsModalOpen', () => {
      it('should return true if modal is open', () => {
        expect(selectIsModalOpen('settings')(mockState)).toBe(true);
        expect(selectIsModalOpen('profile')(mockState)).toBe(true);
      });

      it('should return false if modal is not open', () => {
        expect(selectIsModalOpen('help')(mockState)).toBe(false);
        expect(selectIsModalOpen('unknown')(mockState)).toBe(false);
      });
    });

    describe('selectModalTab', () => {
      it('should return tab for named modal', () => {
        expect(selectModalTab('settings')(mockState)).toBe('general');
        expect(selectModalTab('profile')(mockState)).toBe('info');
      });

      it('should return undefined for modal without tab', () => {
        const stateWithoutTab = {
          modals: { ...mockState.modals, modalStack: [{ name: 'help' }] },
        };
        expect(selectModalTab('help')(stateWithoutTab)).toBeUndefined();
      });

      it('should return undefined for non-existent modal', () => {
        expect(selectModalTab('unknown')(mockState)).toBeUndefined();
      });
    });

    describe('selectModalMentorId', () => {
      it('should return mentorId from current modal', () => {
        expect(selectModalMentorId(mockState)).toBe('mentor-123');
      });

      it('should return undefined if current modal has no mentorId', () => {
        const stateWithoutMentorId = {
          modals: { ...mockState.modals, modalStack: [{ name: 'settings' }] },
        };
        expect(selectModalMentorId(stateWithoutMentorId)).toBeUndefined();
      });

      it('should return undefined for empty stack', () => {
        const emptyState = { modals: { ...mockState.modals, modalStack: [] } };
        expect(selectModalMentorId(emptyState)).toBeUndefined();
      });
    });

    describe('selectShortcutsModal', () => {
      it('should return shortcuts modal state', () => {
        expect(selectShortcutsModal(mockState)).toBe(true);
      });

      it('should return false when shortcuts modal is closed', () => {
        const closedState = { modals: { ...mockState.modals, shortcutsModal: false } };
        expect(selectShortcutsModal(closedState)).toBe(false);
      });
    });
  });

  describe('complex scenarios', () => {
    it('should handle full navigation flow', () => {
      let state = modalReducer(initialState, pushModal({ name: 'home' }));
      expect(state.modalStack).toHaveLength(1);

      state = modalReducer(state, pushModal({ name: 'settings', tab: 'general' }));
      expect(state.modalStack).toHaveLength(2);

      state = modalReducer(state, updateCurrentModalTab('advanced'));
      expect(state.modalStack[1].tab).toBe('advanced');

      state = modalReducer(state, popModal(undefined));
      expect(state.modalStack).toHaveLength(1);
      expect(state.modalStack[0].name).toBe('home');
    });

    it('should handle modal replacement', () => {
      let state = modalReducer(initialState, pushModal({ name: 'modal1' }));
      state = modalReducer(state, pushModal({ name: 'modal2' }));

      const newStack: ModalInfo[] = [{ name: 'modal3' }, { name: 'modal4' }];
      state = modalReducer(state, setModalStack(newStack));

      expect(state.modalStack).toEqual(newStack);
    });
  });
});
