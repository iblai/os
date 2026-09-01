import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'acme', mentorId: 'mentor-1' }),
}));

import { CopyButtonIcon } from '../copy-button-icon';

const writeText = vi.fn<(text: string) => Promise<void>>();

describe('CopyButtonIcon', () => {
  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    // Note: assign directly rather than via userEvent.setup(), which installs
    // its own clipboard stub and would hide the real call.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('default (icon-only) mode', () => {
    it('renders an icon-only button with the icon-only aria-label', () => {
      render(<CopyButtonIcon text="hello" />);
      const button = screen.getByRole('button', {
        name: 'Copy text to clipboard',
      });
      // No visible text — the accessible name is the only label.
      expect(button.textContent).toBe('');
    });

    it('copies the text and swaps the aria-label on success', async () => {
      render(<CopyButtonIcon text="hello world" />);

      fireEvent.click(
        screen.getByRole('button', { name: 'Copy text to clipboard' }),
      );

      expect(writeText).toHaveBeenCalledWith('hello world');
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Text copied to clipboard' }),
        ).toBeInTheDocument();
      });
    });

    it('still renders no visible text after a successful copy', async () => {
      render(<CopyButtonIcon text="hello" />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Text copied to clipboard' })
            .textContent,
        ).toBe('');
      });
    });
  });

  describe('labelled mode', () => {
    it('renders the visible label alongside the icon', () => {
      render(<CopyButtonIcon text="hello" label="Copy" />);
      const button = screen.getByRole('button', {
        name: 'Copy text to clipboard',
      });
      expect(button.textContent).toBe('Copy');
    });

    it('swaps the visible label to "Copied" after copying', async () => {
      render(<CopyButtonIcon text="const x = 1;" label="Copy" />);

      fireEvent.click(screen.getByRole('button'));

      expect(writeText).toHaveBeenCalledWith('const x = 1;');
      await waitFor(() => {
        expect(screen.getByRole('button').textContent).toBe('Copied');
      });
      // The aria-label strings are shared with the icon-only mode and must not
      // drift — e2e a11y checkpoints assert on them.
      expect(
        screen.getByRole('button', { name: 'Text copied to clipboard' }),
      ).toBeInTheDocument();
    });

    it('reverts to the label once the success window elapses', async () => {
      // Fake timers must be installed before the click so the reset timeout
      // the hook schedules is the fake one.
      vi.useFakeTimers();
      render(<CopyButtonIcon text="hello" label="Copy" />);

      fireEvent.click(screen.getByRole('button'));
      // Flush the clipboard promise so the success state lands.
      await act(async () => {});
      expect(screen.getByRole('button').textContent).toBe('Copied');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByRole('button').textContent).toBe('Copy');
    });
  });

  it('forwards data-testid, className and variant to the underlying button', () => {
    render(
      <CopyButtonIcon
        text="hello"
        label="Copy"
        variant="ghost"
        className="text-[#cccccc]"
        data-testid="code-block-copy"
      />,
    );
    const button = screen.getByTestId('code-block-copy');
    expect(button.className).toContain('text-[#cccccc]');
    // `ghost` carries no surface of its own, unlike the default `outline`,
    // so it sits directly on the dark code-block header.
    expect(button.className).not.toContain('bg-background');
  });

  it('defaults to the outline variant when none is given', () => {
    render(<CopyButtonIcon text="hello" data-testid="plain-copy" />);
    expect(screen.getByTestId('plain-copy').className).toContain(
      'bg-background',
    );
  });
});
