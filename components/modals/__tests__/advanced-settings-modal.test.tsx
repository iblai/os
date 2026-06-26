import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdvancedSettingsModal } from '../advanced-settings-modal';

// ============================================================================
// TESTS
// ============================================================================

describe('AdvancedSettingsModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the title and action buttons when open', () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('does not render the title when closed', () => {
      render(<AdvancedSettingsModal isOpen={false} onClose={vi.fn()} />);

      expect(screen.queryByText('Advanced Settings')).not.toBeInTheDocument();
    });

    it('renders all five tab triggers', () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByRole('tab', { name: /Notifications/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Emails/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Tasks/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Voice/ })).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /Monetization/ }),
      ).toBeInTheDocument();
    });

    it('renders the notifications tab content by default', () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByText('Notification Frequency')).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('shows the emails tab content when the emails tab is selected', async () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      await userEvent.click(screen.getByRole('tab', { name: /Emails/ }));

      expect(screen.getByText('Welcome Email Template')).toBeInTheDocument();
      expect(screen.getByText('Follow-up Email Template')).toBeInTheDocument();
      expect(screen.getByText('Email Branding')).toBeInTheDocument();
    });

    it('shows the tasks tab content when the tasks tab is selected', async () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      await userEvent.click(screen.getByRole('tab', { name: /Tasks/ }));

      expect(screen.getByText('Enable Task Assignment')).toBeInTheDocument();
      expect(screen.getByText('Task Reminders')).toBeInTheDocument();
      expect(
        screen.getByText('Default Task Due Date (days)'),
      ).toBeInTheDocument();
      expect(screen.getByText('Task Categories')).toBeInTheDocument();
    });

    it('shows the voice tab content when the voice tab is selected', async () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      await userEvent.click(screen.getByRole('tab', { name: /Voice/ }));

      expect(screen.getByText('Enable Voice Interaction')).toBeInTheDocument();
      expect(screen.getByText('Voice Type')).toBeInTheDocument();
      expect(screen.getByText('Speech Rate')).toBeInTheDocument();
      expect(
        screen.getByText('Voice Recognition Sensitivity'),
      ).toBeInTheDocument();
    });

    it('shows the monetization tab content when the monetization tab is selected', async () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      await userEvent.click(screen.getByRole('tab', { name: /Monetization/ }));

      expect(screen.getByText('Enable Paid Access')).toBeInTheDocument();
      expect(screen.getByText('Pricing Model')).toBeInTheDocument();
      expect(screen.getByText('Price ($)')).toBeInTheDocument();
      expect(screen.getByText('Billing Cycle')).toBeInTheDocument();
      expect(screen.getByText('Free Trial Period (days)')).toBeInTheDocument();
      expect(screen.getByText('Payment Processors')).toBeInTheDocument();
      expect(screen.getByText('Stripe')).toBeInTheDocument();
      expect(screen.getByText('PayPal')).toBeInTheDocument();
      expect(screen.getByText('Apple Pay')).toBeInTheDocument();
      expect(screen.getByText('Google Pay')).toBeInTheDocument();
    });
  });

  describe('notification frequency select', () => {
    it('renders the frequency options when opened', () => {
      render(<AdvancedSettingsModal isOpen={true} onClose={vi.fn()} />);

      // Open the frequency Select (default value renders "Immediate").
      const trigger = screen.getByRole('combobox');
      fireEvent.click(trigger);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Hourly Digest')).toBeInTheDocument();
      expect(within(listbox).getByText('Daily Digest')).toBeInTheDocument();
      expect(within(listbox).getByText('Weekly Digest')).toBeInTheDocument();
    });
  });

  describe('onClose', () => {
    it('calls onClose when the cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<AdvancedSettingsModal isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the dialog is dismissed via escape', () => {
      const onClose = vi.fn();
      render(<AdvancedSettingsModal isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(document.activeElement || document.body, {
        key: 'Escape',
        code: 'Escape',
      });

      expect(onClose).toHaveBeenCalled();
    });
  });
});
