import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { LocalModelRow, type LocalRowStatus } from '../local-model-row';

// next/image -> plain img so the grayscale class is readable directly.
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />,
}));

function renderRow(
  overrides: Partial<React.ComponentProps<typeof LocalModelRow>> = {},
) {
  const onActivate = vi.fn();
  const utils = render(
    <LocalModelRow
      name="llama3.2"
      size="2 GB"
      logo="/llm-llama-provider.jpeg"
      status="not-installed"
      progress={0}
      onActivate={onActivate}
      {...overrides}
    />,
  );
  return { ...utils, onActivate };
}

/** The progress fill is the only element carrying an inline width. */
const fillOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('span[style*="width"]');

describe('LocalModelRow', () => {
  it('offers a download with the model size when it is not installed', () => {
    const { onActivate } = renderRow();

    const button = screen.getByRole('button', {
      name: 'Download llama3.2, 2 GB, on-device model',
    });
    expect(button).toBeEnabled();
    expect(screen.getByText('On-device')).toBeInTheDocument();
    expect(screen.getByText('2 GB')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('shows a starting row before any progress has been reported', () => {
    const { container } = renderRow({ status: 'starting' });

    expect(
      screen.getByRole('button', { name: 'Starting download of llama3.2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Starting…')).toBeInTheDocument();
    // A visible sliver immediately, so a pull never looks like it did nothing.
    expect(fillOf(container)).toHaveStyle({ width: '6%' });
  });

  it('shows progress and offers cancellation while downloading', () => {
    const { container, onActivate } = renderRow({
      status: 'downloading',
      progress: 42.4,
    });

    const button = screen.getByRole('button', {
      name: 'Cancel download of llama3.2, 42 percent',
    });
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(fillOf(container)).toHaveStyle({ width: '42%' });

    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('keeps the fill visible when a download reports zero progress', () => {
    const { container } = renderRow({ status: 'downloading', progress: 0 });
    expect(fillOf(container)).toHaveStyle({ width: '6%' });
  });

  it.each([
    ['above the maximum', 150, '100%'],
    ['below zero', -10, '6%'],
  ])('clamps progress reported %s', (_label, progress, width) => {
    const { container } = renderRow({ status: 'downloading', progress });
    expect(fillOf(container)).toHaveStyle({ width });
  });

  it('lets an installed model be selected without extra labelling', () => {
    const { container, onActivate } = renderRow({ status: 'installed' });

    const button = screen.getByRole('button', {
      name: 'Use llama3.2, on-device model',
    });
    // The absence of the size + download affordance is what marks it ready.
    expect(screen.queryByText('2 GB')).not.toBeInTheDocument();
    expect(fillOf(container)).toBeNull();

    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('marks the selected model as in use and inert', () => {
    const { onActivate } = renderRow({ status: 'selected' });

    const button = screen.getByRole('button', {
      name: 'Selected llama3.2, on-device model, in use',
    });
    expect(button).toBeDisabled();
    expect(screen.getByText('In use')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('surfaces the failure reason on an errored row', () => {
    renderRow({ status: 'error', errorMessage: 'no disk space' });

    expect(
      screen.getByRole('button', {
        name: 'Retry download of llama3.2, no disk space',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('no disk space')).toBeInTheDocument();
  });

  it('falls back to a generic retry label when the error carries no reason', () => {
    renderRow({ status: 'error' });

    expect(
      screen.getByRole('button', { name: 'Retry download of llama3.2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Download failed — retry')).toBeInTheDocument();
  });

  it('blocks a second download while another model is pulling', () => {
    const { container, onActivate } = renderRow({
      disabled: true,
      disabledReason: 'Another model is downloading',
    });

    const button = screen.getByRole('button', {
      name: 'Download llama3.2, 2 GB, on-device model',
    });
    expect(button).toBeDisabled();
    // The title explains why, since a disabled control cannot say so itself.
    expect(button).toHaveAttribute('title', 'Another model is downloading');
    // The logo is decorative (empty alt), so it has no img role to query by.
    expect(container.querySelector('img')).toHaveClass('grayscale');

    fireEvent.click(button);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('still allows cancelling the row that is itself downloading', () => {
    // `disabled` means "another model is pulling" — for the pulling row itself
    // that flag must not take away the only way to stop it.
    const { onActivate } = renderRow({
      status: 'downloading',
      progress: 10,
      disabled: true,
      disabledReason: 'Another model is downloading',
    });

    const button = screen.getByRole('button', {
      name: 'Cancel download of llama3.2, 10 percent',
    });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it.each<LocalRowStatus>(['not-installed', 'installed', 'error'])(
    'titles a %s row with its own action label',
    (status) => {
      renderRow({ status });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'title',
        button.getAttribute('aria-label'),
      );
    },
  );
});
