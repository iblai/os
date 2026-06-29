import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { MentorListModal } from '../mentor-list-modal';

describe('MentorListModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render content when closed', () => {
    render(
      <MentorListModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(
      screen.queryByText('Abilene Christian University'),
    ).not.toBeInTheDocument();
  });

  it('renders the search box and the full mentor list when open', () => {
    render(<MentorListModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();

    expect(
      screen.getByText('Abilene Christian University'),
    ).toBeInTheDocument();
    expect(screen.getByText('Accelerated Computing Agent')).toBeInTheDocument();
    expect(screen.getByText('Adelphi University')).toBeInTheDocument();
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
  });

  it('calls onSelect with the chosen mentor when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<MentorListModal isOpen onClose={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('AI Agent'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '4', name: 'AI Agent' }),
    );
  });

  it('filters by mentor name', () => {
    render(<MentorListModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'adelphi' },
    });

    expect(screen.getByText('Adelphi University')).toBeInTheDocument();
    expect(screen.queryByText('AI Agent')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Abilene Christian University'),
    ).not.toBeInTheDocument();
  });

  it('filters by mentor description', () => {
    render(<MentorListModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />);

    // Matches only the "AI Agent" description ("Language Models, Unleashed.").
    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'unleashed' },
    });

    expect(screen.getByText('AI Agent')).toBeInTheDocument();
    expect(screen.queryByText('Adelphi University')).not.toBeInTheDocument();
  });

  it('renders an empty list when nothing matches the query', () => {
    render(<MentorListModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'zzz-no-match' },
    });

    expect(screen.queryByText('AI Agent')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Abilene Christian University'),
    ).not.toBeInTheDocument();
  });
});
