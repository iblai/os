import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { StopStreamingButton } from '../stop-streaming-button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CSS_CLASS_NAMES } from '@/lib/constants';

const renderButton = (props: { stopGenerating: () => void }) => {
  return render(
    <TooltipProvider>
      <StopStreamingButton {...props} />
    </TooltipProvider>,
  );
};

describe('StopStreamingButton', () => {
  it('renders a button with correct type', () => {
    renderButton({ stopGenerating: vi.fn() });

    const button = screen.getByRole('button', { name: 'Stop streaming' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('calls stopGenerating on click', async () => {
    const stopGenerating = vi.fn();
    const user = userEvent.setup();
    renderButton({ stopGenerating });

    await user.click(screen.getByRole('button', { name: 'Stop streaming' }));

    expect(stopGenerating).toHaveBeenCalledTimes(1);
  });

  it('applies the correct CSS class from constants', () => {
    renderButton({ stopGenerating: vi.fn() });

    const button = screen.getByRole('button', { name: 'Stop streaming' });
    expect(button).toHaveClass(CSS_CLASS_NAMES.CHAT.STOP_STREAMING_BUTTON);
  });

  it('applies gradient and size styling', () => {
    renderButton({ stopGenerating: vi.fn() });

    const button = screen.getByRole('button', { name: 'Stop streaming' });
    expect(button).toHaveClass('h-9', 'w-9', 'rounded-lg', 'bg-gradient-to-r');
  });

  it('renders CircleStop icon with correct classes', () => {
    renderButton({ stopGenerating: vi.fn() });

    const button = screen.getByRole('button', { name: 'Stop streaming' });
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('h-5', 'w-5', 'text-white');
  });

  it('has screen reader text', () => {
    renderButton({ stopGenerating: vi.fn() });

    const srText = screen.getByText('Stop streaming');
    expect(srText).toHaveClass('sr-only');
  });

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup();
    renderButton({ stopGenerating: vi.fn() });

    await user.hover(screen.getByRole('button', { name: 'Stop streaming' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Stop Streaming');
  });

  it('forwards ref to the button element', () => {
    const ref = createRef<HTMLButtonElement>();

    render(
      <TooltipProvider>
        <StopStreamingButton ref={ref} stopGenerating={vi.fn()} />
      </TooltipProvider>,
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Stop streaming' }));
  });
});
