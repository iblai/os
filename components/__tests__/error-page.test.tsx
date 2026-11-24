import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ErrorPage } from '../error-page';

describe('the error page', () => {
  it('shows only what it was given', () => {
    render(<ErrorPage />);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the code, title and description when it has them', () => {
    render(
      <ErrorPage
        errorCode="404"
        customTitle="Page not found"
        customDescription="The page you are looking for has moved."
      />,
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The page you are looking for has moved.'),
    ).toBeInTheDocument();
  });

  it('offers Try again only when there is something to retry', () => {
    const reset = vi.fn();

    const { rerender } = render(<ErrorPage showReset reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);

    // Asked for, but with nothing behind it: a button that cannot retry is
    // worse than no button on the page someone lands on when things break.
    rerender(<ErrorPage showReset />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  // This page fills the whole window, and in the Chrome side panel it IS the
  // window: a `mailto:` followed in place replaced it with the browser's
  // broken-page icon, leaving no way back from the page that exists to
  // explain that something broke.
  it('opens the mail client away from the page it is shown on', () => {
    render(<ErrorPage supportEmail="help@acme.test" />);

    const link = screen.getByRole('link', { name: 'Contact support' });
    expect(link).toHaveAttribute('href', 'mailto:help@acme.test');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('says nothing about support when there is no address to offer', () => {
    render(<ErrorPage supportEmail={null} />);

    expect(screen.queryByRole('link', { name: 'Contact support' })).toBeNull();
  });
});
