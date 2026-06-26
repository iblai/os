import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { WebsiteCrawlModal } from '../website-crawl-modal';
import { ResourceType } from '../../resource-types';

// Native-ish Select mock so the pattern-type options are clickable in jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value}>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div
      role="option"
      data-value={value}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  ),
}));

// ----------------------------------------------------------------------------
// A lightweight fake of the @tanstack/react-form "form" object returned by
// useWebsiteCrawlerResource. It is stateful enough to exercise every branch in
// the component: field rendering, validators, error display, pattern add/remove,
// pattern-type select, and the submit/submitting state.
// ----------------------------------------------------------------------------

type FieldState = { value: unknown; errors: unknown };

function makeFakeForm(initial: {
  values: Record<string, unknown>;
  validators?: Record<string, (v: unknown) => unknown>;
  isSubmitting?: boolean;
}) {
  const state: Record<string, FieldState> = {};
  for (const key of Object.keys(initial.values)) {
    state[key] = { value: initial.values[key], errors: undefined };
  }
  let listeners: Array<() => void> = [];
  const notify = () => listeners.forEach((l) => l());

  const handleSubmit = vi.fn();

  const Field = ({
    name,
    validators,
    children,
  }: {
    name: string;
    validators?: { onChange?: (args: { value: unknown }) => unknown };
    children: (field: unknown) => React.ReactNode;
  }) => {
    const [, force] = React.useReducer((c) => c + 1, 0);
    React.useEffect(() => {
      listeners.push(force);
      return () => {
        listeners = listeners.filter((l) => l !== force);
      };
    }, []);

    const fieldState = state[name] ?? { value: '', errors: undefined };
    const field = {
      name,
      state: { value: fieldState.value, meta: { errors: fieldState.errors } },
      handleChange: (value: unknown) => {
        fieldState.value = value;
        if (validators?.onChange) {
          const err = validators.onChange({ value });
          fieldState.errors = err || undefined;
        }
        notify();
      },
    };
    return <>{children(field)}</>;
  };

  const Subscribe = ({
    selector,
    children,
  }: {
    selector: (s: unknown) => unknown;
    children: (selected: unknown) => React.ReactNode;
  }) => {
    const [, force] = React.useReducer((c) => c + 1, 0);
    React.useEffect(() => {
      listeners.push(force);
      return () => {
        listeners = listeners.filter((l) => l !== force);
      };
    }, []);
    const fakeState = {
      values: Object.fromEntries(
        Object.entries(state).map(([k, v]) => [k, v.value]),
      ),
      isSubmitting: initial.isSubmitting ?? false,
    };
    return <>{children(selector(fakeState))}</>;
  };

  return {
    form: { Field, Subscribe, handleSubmit, reset: vi.fn() },
    state,
    notify,
  };
}

// Mutable handles set per-test before render.
let crawlerMatchPatterns: string[] = [];
const setCrawlerMatchPatterns = vi.fn((next: string[]) => {
  crawlerMatchPatterns = next;
});
let handleCheckUrlIsValid = vi.fn((url: string) => url.startsWith('http'));
let fakeFormHandle: ReturnType<typeof makeFakeForm>;

vi.mock('@/hooks/use-website-crawler-resource', () => ({
  useWebsiteCrawlerResource: () => ({
    form: fakeFormHandle.form,
    handleCheckUrlIsValid,
    crawlerMatchPatterns,
    setCrawlerMatchPatterns,
  }),
}));

const resource: ResourceType = {
  id: 'web-crawler',
  name: 'Web Crawler',
  bgColor: 'bg-blue-100',
  isActive: true,
  type: 'webcrawler',
  accept: 'url',
  icon: <span>WC</span>,
};

function renderModal() {
  fakeFormHandle = makeFakeForm({
    values: {
      url: '',
      crawler_max_depth: 1,
      crawler_max_pages_limit: 1,
      crawler_pattern_type: 'glob',
      temp_crawler_match_patterns: '',
    },
  });
  return render(<WebsiteCrawlModal resource={resource} />);
}

describe('WebsiteCrawlModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    crawlerMatchPatterns = [];
    handleCheckUrlIsValid = vi.fn((url: string) => url.startsWith('http'));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the title, description and form fields', () => {
    renderModal();
    expect(screen.getByText('Web Crawler Configuration')).toBeInTheDocument();
    expect(
      screen.getByText('Configure your web crawler settings and URL patterns'),
    ).toBeInTheDocument();
    expect(screen.getByText('Max Crawl Depth')).toBeInTheDocument();
    expect(screen.getByText('Max Pages Limit')).toBeInTheDocument();
    expect(screen.getByText('Pattern Type')).toBeInTheDocument();
    expect(screen.getByText('No patterns added')).toBeInTheDocument();
  });

  it('calls form.handleSubmit when the form is submitted', () => {
    renderModal();
    const submitButton = screen.getByRole('button', { name: 'Submit' });
    fireEvent.click(submitButton);
    expect(fakeFormHandle.form.handleSubmit).toHaveBeenCalled();
  });

  // -- URL field validators -------------------------------------------------
  it('shows required error when the url is cleared', () => {
    renderModal();
    const urlInput = screen.getByLabelText('URL');
    // Populate then clear so the controlled onChange actually fires.
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.change(urlInput, { target: { value: '' } });
    expect(screen.getByText('URL is required')).toBeInTheDocument();
  });

  it('shows invalid url error when the url fails validation', () => {
    handleCheckUrlIsValid = vi.fn(() => false);
    renderModal();
    const urlInput = screen.getByLabelText('URL');
    fireEvent.change(urlInput, { target: { value: 'bad-url' } });
    expect(screen.getByText('Invalid URL')).toBeInTheDocument();
  });

  it('accepts a valid url without showing an error', () => {
    renderModal();
    const urlInput = screen.getByLabelText('URL');
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    expect(screen.queryByText('Invalid URL')).not.toBeInTheDocument();
    expect(screen.queryByText('URL is required')).not.toBeInTheDocument();
  });

  // -- Max depth validators -------------------------------------------------
  it('shows required error when max crawl depth is cleared (NaN)', () => {
    renderModal();
    const depthInput = screen.getByLabelText('Max Crawl Depth');
    fireEvent.change(depthInput, { target: { value: '' } });
    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });

  it('shows greater-than-zero error when max crawl depth is below 1', () => {
    renderModal();
    const depthInput = screen.getByLabelText('Max Crawl Depth');
    fireEvent.change(depthInput, { target: { value: '-5' } });
    expect(screen.getByText('Must be greater than 0')).toBeInTheDocument();
  });

  it('shows max error when max crawl depth exceeds 10000', () => {
    renderModal();
    const depthInput = screen.getByLabelText('Max Crawl Depth');
    fireEvent.change(depthInput, { target: { value: '20000' } });
    expect(screen.getByText('Must be less than 10000')).toBeInTheDocument();
  });

  // -- Max pages validators -------------------------------------------------
  it('shows required error when max pages limit is cleared (NaN)', () => {
    renderModal();
    const pagesInput = screen.getByLabelText('Max Pages Limit');
    fireEvent.change(pagesInput, { target: { value: '' } });
    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });

  it('shows greater-than-zero error when max pages limit is below 1', () => {
    renderModal();
    const pagesInput = screen.getByLabelText('Max Pages Limit');
    fireEvent.change(pagesInput, { target: { value: '-2' } });
    expect(screen.getByText('Must be greater than 0')).toBeInTheDocument();
  });

  // -- Pattern type select --------------------------------------------------
  it('updates the pattern type when a new option is selected', () => {
    renderModal();
    fireEvent.click(screen.getByText('Regular Expression'));
    expect(fakeFormHandle.state.crawler_pattern_type.value).toBe('regex');
  });

  // -- Pattern add / remove -------------------------------------------------
  it('adds a pattern via the plus button', () => {
    renderModal();
    const patternInput = screen.getByLabelText('Crawler Match Patterns');
    fireEvent.change(patternInput, { target: { value: 'https://a.com/' } });
    fireEvent.click(screen.getByLabelText('Add pattern'));
    expect(setCrawlerMatchPatterns).toHaveBeenCalledWith(['https://a.com/']);
  });

  it('does not add a pattern when the input is only whitespace', () => {
    renderModal();
    const patternInput = screen.getByLabelText('Crawler Match Patterns');
    fireEvent.change(patternInput, { target: { value: '   ' } });
    const addButton = screen.getByLabelText('Add pattern');
    expect(addButton).toBeDisabled();
  });

  it('adds a pattern when Enter is pressed in the input', () => {
    renderModal();
    const patternInput = screen.getByLabelText('Crawler Match Patterns');
    fireEvent.change(patternInput, { target: { value: 'https://b.com/' } });
    fireEvent.keyPress(patternInput, {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
    });
    expect(setCrawlerMatchPatterns).toHaveBeenCalledWith(['https://b.com/']);
  });

  it('does not add a pattern on Enter when the input is empty', () => {
    renderModal();
    const patternInput = screen.getByLabelText('Crawler Match Patterns');
    fireEvent.keyPress(patternInput, {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
    });
    expect(setCrawlerMatchPatterns).not.toHaveBeenCalled();
  });

  it('ignores non-Enter key presses in the pattern input', () => {
    renderModal();
    const patternInput = screen.getByLabelText('Crawler Match Patterns');
    fireEvent.change(patternInput, { target: { value: 'https://c.com/' } });
    fireEvent.keyPress(patternInput, { key: 'a', code: 'KeyA', charCode: 97 });
    expect(setCrawlerMatchPatterns).not.toHaveBeenCalled();
  });

  it('renders existing patterns and removes one when its X is clicked', () => {
    crawlerMatchPatterns = ['https://x.com/', 'https://y.com/'];
    renderModal();

    expect(screen.getByText('https://x.com/')).toBeInTheDocument();
    expect(screen.getByText('https://y.com/')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove pattern: https://x.com/'));
    expect(setCrawlerMatchPatterns).toHaveBeenCalledWith(['https://y.com/']);
  });

  it('shows an invalid url error for glob patterns that fail validation', () => {
    handleCheckUrlIsValid = vi.fn(() => false);
    renderModal();
    const patternInput = screen.getByLabelText('Crawler Match Patterns');
    fireEvent.change(patternInput, { target: { value: 'bad' } });
    expect(screen.getByText('Invalid URL')).toBeInTheDocument();
  });

  // -- Submitting state -----------------------------------------------------
  it('shows the submitting state when the form is submitting', () => {
    fakeFormHandle = makeFakeForm({
      values: {
        url: '',
        crawler_max_depth: 1,
        crawler_max_pages_limit: 1,
        crawler_pattern_type: 'glob',
        temp_crawler_match_patterns: '',
      },
      isSubmitting: true,
    });
    render(<WebsiteCrawlModal resource={resource} />);

    expect(
      screen.getByRole('button', { name: 'Submitting...' }),
    ).toBeDisabled();
    expect(screen.getByText('Form is being submitted')).toBeInTheDocument();
  });
});
