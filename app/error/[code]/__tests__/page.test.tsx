import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { customErrorMessages } from '@/lib/error';

const params: Record<string, string> = { code: '500' };
let query = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useParams: () => params,
  useSearchParams: () => query,
}));

const hideInitialLoader = vi.fn();
vi.mock('@/lib/initial-loader', () => ({
  hideInitialLoader: () => hideInitialLoader(),
}));

let tenantMetadata: { support_email?: string } | null = null;
vi.mock('@/hooks/use-tenant-object-metadata', () => ({
  useTenantObjectMetadata: () => tenantMetadata,
}));

vi.mock('@/components/errors/browser-agent-not-set-up', () => ({
  BrowserAgentNotSetUp: () => <div data-testid="not-set-up" />,
}));

vi.mock('@/components/errors/browser-agent-unsupported', () => ({
  BrowserAgentUnsupported: () => <div data-testid="unsupported" />,
}));

vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  ClientErrorPage: ({
    errorCode,
    header,
    message,
    showHomeButton,
    supportEmail,
    handleError,
  }: {
    errorCode: string;
    header?: string;
    message?: string;
    showHomeButton: boolean;
    supportEmail: string;
    handleError: (error: unknown) => void;
  }) => (
    <div data-testid="client-error-page">
      <span data-testid="code">{errorCode}</span>
      <span data-testid="header">{header ?? ''}</span>
      <span data-testid="message">{message ?? ''}</span>
      <span data-testid="home">{String(showHomeButton)}</span>
      <span data-testid="support">{supportEmail}</span>
      <button type="button" onClick={() => handleError({ boom: true })}>
        raise
      </button>
    </div>
  ),
}));

const ErrorPage = (await import('../page')).default;

beforeEach(() => {
  params.code = '500';
  query = new URLSearchParams();
  tenantMetadata = null;
  hideInitialLoader.mockClear();
});

afterEach(cleanup);

describe('error page', () => {
  it('hides the initial loader once, so the page is not painted under it', () => {
    render(<ErrorPage />);
    expect(hideInitialLoader).toHaveBeenCalledTimes(1);
  });

  // Each of these two is a dead end of its own with its own way out, which the
  // shared page cannot carry — so the page must pick, not fall through.
  it('gives the not-set-up organization its own screen', () => {
    query = new URLSearchParams({
      errorType: customErrorMessages.browserAgentNotSetUp.key,
    });
    render(<ErrorPage />);
    expect(screen.getByTestId('not-set-up')).toBeInTheDocument();
    expect(screen.queryByTestId('client-error-page')).toBeNull();
  });

  it('gives the organization that cannot run the assistant its own screen', () => {
    query = new URLSearchParams({
      errorType: customErrorMessages.browserAgentUnsupported.key,
    });
    render(<ErrorPage />);
    expect(screen.getByTestId('unsupported')).toBeInTheDocument();
    expect(screen.queryByTestId('client-error-page')).toBeNull();
  });

  it('renders any other known error through the shared page', () => {
    params.code = '404';
    query = new URLSearchParams({
      errorType: customErrorMessages.mentorNotFound.key,
    });
    render(<ErrorPage />);
    expect(screen.getByTestId('code')).toHaveTextContent('404');
    expect(screen.getByTestId('header')).toHaveTextContent(
      customErrorMessages.mentorNotFound.header,
    );
    expect(screen.getByTestId('message')).toHaveTextContent(
      customErrorMessages.mentorNotFound.message,
    );
    expect(screen.getByTestId('home')).toHaveTextContent('true');
  });

  it('says nothing it does not know when the error type is absent or unknown', () => {
    query = new URLSearchParams({ errorType: 'somethingElse' });
    render(<ErrorPage />);
    expect(screen.getByTestId('header')).toBeEmptyDOMElement();
    expect(screen.getByTestId('message')).toBeEmptyDOMElement();

    cleanup();
    query = new URLSearchParams();
    render(<ErrorPage />);
    expect(screen.getByTestId('header')).toBeEmptyDOMElement();
  });

  // An embed has no home to go to: the button would navigate the host page.
  it('offers no home button in an embed', () => {
    query = new URLSearchParams({ embed: 'true' });
    render(<ErrorPage />);
    expect(screen.getByTestId('home')).toHaveTextContent('false');
  });

  // Contact Support must reach whoever can act — the organization's own
  // address when it set one, ours only as the fallback.
  it('prefers the organization support address over ours', () => {
    tenantMetadata = { support_email: 'help@acme.test' };
    render(<ErrorPage />);
    expect(screen.getByTestId('support')).toHaveTextContent('help@acme.test');

    cleanup();
    tenantMetadata = { support_email: '' };
    render(<ErrorPage />);
    expect(screen.getByTestId('support')).not.toHaveTextContent(
      'help@acme.test',
    );
    expect(screen.getByTestId('support').textContent).toContain('@');
  });

  it('logs what the shared page reports, tagged for the log search', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorPage />);
    fireEvent.click(screen.getByRole('button', { name: 'raise' }));
    expect(logged).toHaveBeenCalledWith(
      JSON.stringify({
        tenant: 'client-error-page',
        error: { boom: true },
      }),
    );
    logged.mockRestore();
  });
});
