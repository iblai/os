import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolsSection } from '../tools-section';

// next/image renders an <img>; stub it to a plain img to keep assertions simple.
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
     
    <img alt={alt} src={src} />
  ),
}));

describe('ToolsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section heading and category filters', () => {
    render(<ToolsSection />);

    expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument();

    // Category chips (coined product names) — "User Success" replaces "Student Success".
    expect(screen.getByRole('button', { name: 'Content' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'User Success' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Student Success' }),
    ).not.toBeInTheDocument();
  });

  it('does not render any "Student" copy', () => {
    render(<ToolsSection />);
    expect(screen.queryByText(/Student/i)).not.toBeInTheDocument();
  });

  it('filters tools by the selected category', () => {
    render(<ToolsSection />);

    // Default category is "Content"; switch to "User Success".
    fireEvent.click(screen.getByRole('button', { name: 'User Success' }));

    // Quiz is tagged with the renamed "User Success" category.
    expect(screen.getByText('Quiz')).toBeInTheDocument();
  });

  it('toggles a tool favorite without selecting the tool', () => {
    const onToolSelect = vi.fn();
    render(<ToolsSection onToolSelect={onToolSelect} />);

    const cards = screen.getAllByText('Quiz')[0].closest('.cursor-pointer');
    expect(cards).not.toBeNull();
    const starButton = within(cards as HTMLElement).getByRole('button');
    fireEvent.click(starButton);

    // Toggling the star must not trigger card selection.
    expect(onToolSelect).not.toHaveBeenCalled();

    // Toggle again to cover the remove-from-favorites branch.
    fireEvent.click(starButton);
    expect(onToolSelect).not.toHaveBeenCalled();
  });

  it('calls onToolSelect with the tool id when a card is clicked', () => {
    const onToolSelect = vi.fn();
    render(<ToolsSection onToolSelect={onToolSelect} />);

    const card = screen.getAllByText('Quiz')[0].closest('.cursor-pointer');
    fireEvent.click(card as HTMLElement);

    expect(onToolSelect).toHaveBeenCalledWith('quiz');
  });

  it('does not throw when no onToolSelect handler is provided', () => {
    render(<ToolsSection />);
    const card = screen.getAllByText('Quiz')[0].closest('.cursor-pointer');
    expect(() => fireEvent.click(card as HTMLElement)).not.toThrow();
  });

  it('changes the sort option from the filter menu', async () => {
    const user = userEvent.setup();
    render(<ToolsSection />);

    const openMenu = async () => {
      await user.click(screen.getByRole('button', { name: /Filter/ }));
    };

    // Pick each sort option to exercise the getSortLabel + handleSortChange paths.
    await openMenu();
    await user.click(await screen.findByText('Alphabetical'));

    await openMenu();
    await user.click(await screen.findByText('Latest'));

    await openMenu();
    await user.click(await screen.findByText('Favorites'));

    await openMenu();
    await user.click(await screen.findByText('Sort by Most Used'));

    // After returning to "most-used", usage counts are displayed.
    expect(screen.getAllByText(/uses$/).length).toBeGreaterThan(0);
  });

  it('scrolls the categories container left and right', () => {
    const scrollTo = vi.fn();
    const container = document.createElement('div');
    Object.defineProperties(container, {
      scrollWidth: { value: 1000, configurable: true },
      clientWidth: { value: 300, configurable: true },
    });
    container.scrollTo = scrollTo as unknown as typeof container.scrollTo;

    const getById = vi
      .spyOn(document, 'getElementById')
      .mockReturnValue(container);

    const { container: root } = render(<ToolsSection />);

    // The two icon-only scroll buttons are the only ones with `md:hidden`.
    const scrollButtons = Array.from(
      root.querySelectorAll('button.md\\:hidden'),
    );
    expect(scrollButtons).toHaveLength(2);

    fireEvent.click(scrollButtons[0]); // left
    fireEvent.click(scrollButtons[1]); // right

    expect(scrollTo).toHaveBeenCalledTimes(2);
    getById.mockRestore();
  });

  it('handles a missing categories container gracefully', () => {
    const getById = vi.spyOn(document, 'getElementById').mockReturnValue(null);

    const { container: root } = render(<ToolsSection />);
    const scrollButtons = Array.from(
      root.querySelectorAll('button.md\\:hidden'),
    );
    expect(() => fireEvent.click(scrollButtons[0])).not.toThrow();

    getById.mockRestore();
  });
});
