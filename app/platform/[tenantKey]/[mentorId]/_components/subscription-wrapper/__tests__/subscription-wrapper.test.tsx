import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SubscriptionWrapper } from '../index';

// ---- Test-controlled mock state ----
let mockCurrentTenant: any;
let mockStripeEnabled: string;
let mockIsLoggedIn: boolean;

// Mock the useCurrentTenant hook
vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: () => ({ currentTenant: mockCurrentTenant }),
}));

// Mock the config
vi.mock('@/lib/config', () => ({
  config: {
    stripeEnabled: () => mockStripeEnabled,
  },
}));

// Mock the utils - isLoggedIn and isStripeActivated
vi.mock('@/lib/utils', () => ({
  isLoggedIn: () => mockIsLoggedIn,
  isStripeActivated: (tenant: any) => {
    // Mirrors the actual isStripeActivated logic:
    // config.stripeEnabled() === 'true' &&
    // (!currentTenant?.is_enterprise || (currentTenant?.key === 'main' && currentTenant?.is_enterprise))
    return (
      mockStripeEnabled === 'true' &&
      (!tenant?.is_enterprise ||
        (tenant?.key === 'main' && tenant?.is_enterprise))
    );
  },
}));

// Mock the MentorECommerceWrapper component
vi.mock('../mentor-e-commerce-wrapper', () => ({
  MentorECommerceWrapper: () => (
    <div data-testid="mentor-ecommerce-wrapper">MentorECommerceWrapper</div>
  ),
}));

beforeEach(() => {
  mockCurrentTenant = null;
  mockStripeEnabled = 'true';
  mockIsLoggedIn = true;
});

describe('SubscriptionWrapper - Enterprise Bypass with isStripeActivated', () => {
  describe('when current_tenant.is_enterprise is true on NON-main tenant', () => {
    it('renders null and does not show MentorECommerceWrapper', () => {
      mockCurrentTenant = {
        key: 'enterprise-tenant', // NOT main
        org: 'enterprise-org',
        is_admin: true,
        is_enterprise: true,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);

      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('renders null for enterprise non-admin users on non-main tenant', () => {
      mockCurrentTenant = {
        key: 'custom-enterprise',
        org: 'custom-org',
        is_admin: false,
        is_enterprise: true,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);

      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when current_tenant.is_enterprise is true on MAIN tenant (special case)', () => {
    it('renders MentorECommerceWrapper - enterprise on main tenant DOES have stripe access', () => {
      mockCurrentTenant = {
        key: 'main', // Main tenant special case
        org: 'main-org',
        is_admin: true,
        is_enterprise: true,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);

      // New behavior: enterprise on main tenant CAN access stripe
      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });

    it('renders MentorECommerceWrapper for enterprise non-admin on main tenant', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: true,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);

      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });
  });

  describe('when current_tenant.is_enterprise is false', () => {
    it('renders MentorECommerceWrapper for logged-in non-enterprise users with stripe enabled', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);

      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });

    it('renders MentorECommerceWrapper for admin users on non-enterprise tenants', () => {
      mockCurrentTenant = {
        key: 'tenant-123',
        org: 'org-123',
        is_admin: true,
        is_enterprise: false,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);

      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });
  });

  describe('when current_tenant.is_enterprise is undefined', () => {
    it('renders MentorECommerceWrapper (treats undefined as non-enterprise)', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        // is_enterprise not set
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);

      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });
  });

  describe('other conditions that disable ecommerce', () => {
    it('renders null when user is not logged in', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = false;

      const { container } = render(<SubscriptionWrapper />);

      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('renders null when stripe is disabled', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockStripeEnabled = 'false';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);

      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('renders null when both conditions fail (not logged in + stripe disabled)', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockStripeEnabled = 'false';
      mockIsLoggedIn = false;

      const { container } = render(<SubscriptionWrapper />);

      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('combined enterprise + other conditions', () => {
    it('renders null when enterprise=true on non-main tenant even if all other conditions are met', () => {
      mockCurrentTenant = {
        key: 'custom-tenant', // NOT main
        org: 'custom-org',
        is_admin: true,
        is_enterprise: true,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);

      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('renders null when enterprise=true on non-main and stripe disabled', () => {
      mockCurrentTenant = {
        key: 'enterprise-tenant',
        org: 'enterprise-org',
        is_admin: false,
        is_enterprise: true,
      };
      mockStripeEnabled = 'false';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);

      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('renders null when enterprise=true on main but stripe disabled', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: true,
        is_enterprise: true,
      };
      mockStripeEnabled = 'false';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);

      // Even though enterprise on main would normally have access,
      // stripe being disabled blocks it
      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders MentorECommerceWrapper when currentTenant is null (is_enterprise defaults to falsy)', () => {
      mockCurrentTenant = null;
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);

      // When currentTenant is null, !currentTenant?.is_enterprise evaluates to true
      // So the ecommerce wrapper renders (since logged in + stripe enabled)
      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });

    it('renders MentorECommerceWrapper when currentTenant is undefined (is_enterprise defaults to falsy)', () => {
      mockCurrentTenant = undefined;
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);

      // When currentTenant is undefined, !currentTenant?.is_enterprise evaluates to true
      // So the ecommerce wrapper renders (since logged in + stripe enabled)
      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });
  });

  describe('isStripeActivated logic validation', () => {
    it('stripe enabled + non-enterprise = active', () => {
      mockCurrentTenant = {
        key: 'any',
        org: 'any',
        is_admin: true,
        is_enterprise: false,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);
      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });

    it('stripe enabled + enterprise on main = active (special case)', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main',
        is_admin: true,
        is_enterprise: true,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      render(<SubscriptionWrapper />);
      expect(
        screen.getByTestId('mentor-ecommerce-wrapper'),
      ).toBeInTheDocument();
    });

    it('stripe enabled + enterprise on non-main = NOT active', () => {
      mockCurrentTenant = {
        key: 'other',
        org: 'other',
        is_admin: true,
        is_enterprise: true,
      };
      mockStripeEnabled = 'true';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);
      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it('stripe disabled = NOT active regardless of enterprise status', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main',
        is_admin: true,
        is_enterprise: false,
      };
      mockStripeEnabled = 'false';
      mockIsLoggedIn = true;

      const { container } = render(<SubscriptionWrapper />);
      expect(
        screen.queryByTestId('mentor-ecommerce-wrapper'),
      ).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });
});
