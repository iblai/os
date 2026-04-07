import { describe, it, expect } from 'vitest';
import {
  SUBSCRIPTION_DIALOG_TITLES,
  SUBSCRIPTION_DIALOG_BTN_LABELS,
  SUBSCRIPTION_CREDIT_LIMIT_ERROR_MESSAGE,
} from '../constants';

describe('hooks/subscription/constants', () => {
  describe('SUBSCRIPTION_DIALOG_TITLES', () => {
    it('should have FREE_TRIAL title', () => {
      expect(SUBSCRIPTION_DIALOG_TITLES.FREE_TRIAL).toBe('Free Trial');
    });

    it('should have FREE_PACKAGE title', () => {
      expect(SUBSCRIPTION_DIALOG_TITLES.FREE_PACKAGE).toBe('Upgrade package');
    });

    it('should have STUDENT_UNDER_PAID_PACKAGE title', () => {
      expect(SUBSCRIPTION_DIALOG_TITLES.STUDENT_UNDER_PAID_PACKAGE).toBe(
        'Contact your tenant admin',
      );
    });

    it('should have PAID_PACKAGE title', () => {
      expect(SUBSCRIPTION_DIALOG_TITLES.PAID_PACKAGE).toBe('Add more credits');
    });

    it('should have exactly 4 titles defined', () => {
      expect(Object.keys(SUBSCRIPTION_DIALOG_TITLES)).toHaveLength(4);
    });
  });

  describe('SUBSCRIPTION_DIALOG_BTN_LABELS', () => {
    it('should have FREE_TRIAL button label', () => {
      expect(SUBSCRIPTION_DIALOG_BTN_LABELS.FREE_TRIAL).toBe('Upgrade');
    });

    it('should have FREE_PACKAGE button label', () => {
      expect(SUBSCRIPTION_DIALOG_BTN_LABELS.FREE_PACKAGE).toBe('Upgrade');
    });

    it('should have STUDENT_UNDER_PAID_PACKAGE button label', () => {
      expect(SUBSCRIPTION_DIALOG_BTN_LABELS.STUDENT_UNDER_PAID_PACKAGE).toBe(
        'Contact admin',
      );
    });

    it('should have PAID_PACKAGE button label', () => {
      expect(SUBSCRIPTION_DIALOG_BTN_LABELS.PAID_PACKAGE).toBe('Add credits');
    });

    it('should have exactly 4 button labels defined', () => {
      expect(Object.keys(SUBSCRIPTION_DIALOG_BTN_LABELS)).toHaveLength(4);
    });
  });

  describe('SUBSCRIPTION_CREDIT_LIMIT_ERROR_MESSAGE', () => {
    it('should have correct error message', () => {
      expect(SUBSCRIPTION_CREDIT_LIMIT_ERROR_MESSAGE).toBe(
        'You do not have enough credits to proceed.',
      );
    });
  });
});
