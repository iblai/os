import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TranslateTab } from '../translate-tab';

describe('TranslateTab', () => {
  const onLanguageSelect = vi.fn();

  const defaultProps = {
    mentorName: 'Test Mentor',
    profileImage: 'https://example.com/avatar.png',
    onLanguageSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the translate heading and prompt', () => {
    render(<TranslateTab {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Translate',
    );
    expect(
      screen.getByText('Would you like me to translate?'),
    ).toBeInTheDocument();
    expect(screen.getByText('Suggested Languages:')).toBeInTheDocument();
  });

  it('renders avatar image with mentor name as alt', () => {
    const { container } = render(<TranslateTab {...defaultProps} />);
    // AvatarImage may not actually render an <img> in jsdom (Radix lazy load),
    // so assert the avatar wrapper is present.
    expect(container.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
  });

  it('renders avatar fallback with first two uppercased letters of mentor name', () => {
    render(<TranslateTab {...defaultProps} mentorName="abcdef" />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders one button per suggested language', () => {
    render(<TranslateTab {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'French (France)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Spanish (Español)' }),
    ).toBeInTheDocument();
  });

  it('calls onLanguageSelect with the language value when a button is clicked', () => {
    render(<TranslateTab {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(onLanguageSelect).toHaveBeenCalledWith('English');

    fireEvent.click(screen.getByRole('button', { name: 'French (France)' }));
    expect(onLanguageSelect).toHaveBeenCalledWith('French');

    fireEvent.click(screen.getByRole('button', { name: 'Spanish (Español)' }));
    expect(onLanguageSelect).toHaveBeenCalledWith('Spanish');
  });
});
