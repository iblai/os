import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { AIMessageCopy } from '../ai-message-copy';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockCopy = vi.fn();
let mockStatus: 'idle' | 'success' = 'idle';

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({
    copy: mockCopy,
    status: mockStatus,
  }),
}));

function renderCopy(content = 'Hello world') {
  return render(
    <TooltipProvider>
      <AIMessageCopy content={content} />
    </TooltipProvider>,
  );
}

describe('AIMessageCopy', () => {
  beforeEach(() => {
    mockCopy.mockReset();
    mockStatus = 'idle';
  });

  it('renders a button with correct aria-label', () => {
    renderCopy();
    expect(screen.getByLabelText('Copy to Clipboard')).toBeInTheDocument();
  });

  it('renders Copy icon in idle state', () => {
    renderCopy();
    const button = screen.getByLabelText('Copy to Clipboard');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('h-4', 'w-4');
  });

  it('calls copy with content on click', async () => {
    const user = userEvent.setup();
    renderCopy('test content');

    await user.click(screen.getByLabelText('Copy to Clipboard'));

    expect(mockCopy).toHaveBeenCalledWith('test content');
  });

  it('shows checkmark icon when status is success', () => {
    mockStatus = 'success';
    renderCopy();
    const button = screen.getByLabelText('Copy to Clipboard');
    const svg = button.querySelector('svg');
    expect(svg).toHaveClass('text-blue-500');
  });

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup();
    renderCopy();

    await user.hover(screen.getByLabelText('Copy to Clipboard'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Copy to Clipboard');
  });

  // Issue #576 — programmatic focus (DOM swap, .focus() from code) should
  // NOT open the tooltip, but keyboard Tab navigation (:focus-visible)
  // should still open it normally.
  it('does not show tooltip when focus is programmatic (issue #576)', () => {
    renderCopy();

    const button = screen.getByLabelText('Copy to Clipboard');
    button.focus();
    expect(button).toHaveFocus();

    // Tooltip should not appear when focus arrives via .focus() / DOM swap.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('still shows tooltip when focus arrives via keyboard Tab (issue #576)', async () => {
    const user = userEvent.setup();
    renderCopy();

    // Tab into the button so :focus-visible matches.
    await user.tab();
    const button = screen.getByLabelText('Copy to Clipboard');
    expect(button).toHaveFocus();

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Copy to Clipboard');
  });

  // Issue #576 — exercise the preventDefault branch by mocking
  // `matches(':focus-visible')` to false (simulating non-keyboard focus in
  // a real browser). JSDOM otherwise treats any focused element as
  // focus-visible, leaving the suppression branch unreachable in tests.
  it('exercises the preventDefault branch on non-focus-visible focus (issue #576)', async () => {
    renderCopy();
    const button = screen.getByLabelText('Copy to Clipboard');

    vi.spyOn(button, 'matches').mockImplementation((selector: string) =>
      selector === ':focus-visible'
        ? false
        : Element.prototype.matches.call(button, selector),
    );

    button.focus();
    expect(button).toHaveFocus();

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('skips the preventDefault branch when :focus-visible is matched (issue #576)', () => {
    renderCopy();
    const button = screen.getByLabelText('Copy to Clipboard');

    vi.spyOn(button, 'matches').mockImplementation((selector: string) =>
      selector === ':focus-visible'
        ? true
        : Element.prototype.matches.call(button, selector),
    );

    button.focus();
    expect(button).toHaveFocus();
  });

  it('shows "Copied" tooltip when status is success', async () => {
    mockStatus = 'success';
    const user = userEvent.setup();
    renderCopy();

    await user.hover(screen.getByLabelText('Copy to Clipboard'));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Copied');
  });

  it('has screen reader text', () => {
    renderCopy();
    const srText = screen.getByText('Copy to Clipboard');
    expect(srText).toHaveClass('sr-only');
  });

  it('forwards ref to the button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <TooltipProvider>
        <AIMessageCopy ref={ref} content="test" />
      </TooltipProvider>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
