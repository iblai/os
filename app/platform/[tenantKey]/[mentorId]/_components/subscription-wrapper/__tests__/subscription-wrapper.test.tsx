import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SubscriptionWrapper } from '../index';

let mockIsPreviewMode = false;
vi.mock('@/hooks/use-is-preview-mode', () => ({
  useIsPreviewMode: () => mockIsPreviewMode,
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  SubscriptionTopBanner: ({ hidden }: { hidden?: boolean }) => (
    <div data-testid="subscription-top-banner" data-hidden={String(hidden)} />
  ),
}));

beforeEach(() => {
  mockIsPreviewMode = false;
});

describe('SubscriptionWrapper', () => {
  it('renders the SDK banner', () => {
    render(<SubscriptionWrapper />);

    expect(screen.getByTestId('subscription-top-banner')).toHaveAttribute(
      'data-hidden',
      'false',
    );
  });

  it('keeps the banner hidden while previewing an agent', () => {
    mockIsPreviewMode = true;
    render(<SubscriptionWrapper />);

    expect(screen.getByTestId('subscription-top-banner')).toHaveAttribute(
      'data-hidden',
      'true',
    );
  });
});
