import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlaggedPromptsList } from '../flagged-prompts-list';
import { FlaggedPrompt } from '../types';

const createPrompt = (
  overrides: Partial<FlaggedPrompt> = {},
): FlaggedPrompt => ({
  id: 'prompt-1',
  userId: 'user-1',
  userEmail: 'john@example.com',
  userFullName: 'John Doe',
  type: 'Moderation',
  prompt: 'This is a flagged prompt',
  systemResponse: 'This prompt was flagged for moderation.',
  timestamp: '2026-01-15T10:00:00Z',
  timeAgo: '2 hours ago',
  fullDate: 'January 15, 2026',
  ...overrides,
});

describe('FlaggedPromptsList', () => {
  it('should render empty state when no prompts are provided', () => {
    render(
      <FlaggedPromptsList
        prompts={[]}
        selectedPrompt={null}
        onPromptClick={vi.fn()}
      />,
    );

    expect(screen.getByText('No flagged prompts found')).toBeInTheDocument();
  });

  it('should render prompt details', () => {
    const prompt = createPrompt();

    render(
      <FlaggedPromptsList
        prompts={[prompt]}
        selectedPrompt={null}
        onPromptClick={vi.fn()}
      />,
    );

    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Moderation')).toBeInTheDocument();
    expect(screen.getByText('This is a flagged prompt')).toBeInTheDocument();
  });

  it('should render multiple prompts', () => {
    const prompts = [
      createPrompt({ id: 'prompt-1', userFullName: 'John Doe' }),
      createPrompt({
        id: 'prompt-2',
        userFullName: 'Jane Smith',
        userEmail: 'jane@example.com',
      }),
    ];

    render(
      <FlaggedPromptsList
        prompts={prompts}
        selectedPrompt={null}
        onPromptClick={vi.fn()}
      />,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should highlight the selected prompt', () => {
    const prompt = createPrompt();

    const { container } = render(
      <FlaggedPromptsList
        prompts={[prompt]}
        selectedPrompt={prompt}
        onPromptClick={vi.fn()}
      />,
    );

    const promptRow = container.querySelector('.bg-gray-100');
    expect(promptRow).toBeInTheDocument();
  });

  it('should not highlight unselected prompts', () => {
    const prompt = createPrompt();

    const { container } = render(
      <FlaggedPromptsList
        prompts={[prompt]}
        selectedPrompt={null}
        onPromptClick={vi.fn()}
      />,
    );

    expect(container.querySelector('.bg-gray-100')).not.toBeInTheDocument();
  });

  it('should call onPromptClick when a prompt is clicked', () => {
    const prompt = createPrompt();
    const onPromptClick = vi.fn();

    render(
      <FlaggedPromptsList
        prompts={[prompt]}
        selectedPrompt={null}
        onPromptClick={onPromptClick}
      />,
    );

    fireEvent.click(screen.getByText('John Doe'));
    expect(onPromptClick).toHaveBeenCalledWith(prompt);
  });

  it('should apply Moderation type badge styling', () => {
    const prompt = createPrompt({ type: 'Moderation' });

    render(
      <FlaggedPromptsList
        prompts={[prompt]}
        selectedPrompt={null}
        onPromptClick={vi.fn()}
      />,
    );

    const badge = screen.getByText('Moderation');
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('should apply Safety type badge styling', () => {
    const prompt = createPrompt({ type: 'Safety' });

    render(
      <FlaggedPromptsList
        prompts={[prompt]}
        selectedPrompt={null}
        onPromptClick={vi.fn()}
      />,
    );

    const badge = screen.getByText('Safety');
    expect(badge).toHaveClass('bg-blue-200', 'text-blue-800');
  });

  it('should not highlight a prompt when a different prompt is selected', () => {
    const prompts = [
      createPrompt({ id: 'prompt-1', userFullName: 'John Doe' }),
      createPrompt({ id: 'prompt-2', userFullName: 'Jane Smith' }),
    ];
    const selected = prompts[1];

    const { container } = render(
      <FlaggedPromptsList
        prompts={prompts}
        selectedPrompt={selected}
        onPromptClick={vi.fn()}
      />,
    );

    const highlightedRows = container.querySelectorAll('.bg-gray-100');
    expect(highlightedRows).toHaveLength(1);
  });
});
