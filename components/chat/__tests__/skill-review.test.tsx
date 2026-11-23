import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillReview, shortUrl } from '@/components/chat/skill-review';
import type { RecordedStep } from '@/lib/recorded-skill';
import type { SkillRecording } from '@/hooks/use-skill-recording';

const createSkill = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

let recording: SkillRecording | null = null;

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'acme', mentorId: 'agent-1' }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateAgentSkillMutation: () => [createSkill, { isLoading: false }],
}));

vi.mock('sonner', () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}));

vi.mock('@/providers/skill-recording-provider', () => ({
  useSkillRecordingContext: () => recording,
}));

const steps: RecordedStep[] = [
  {
    tool: 'click',
    target: { role: 'button', name: 'Export' },
    url: 'https://admin.acme.com/reports',
  },
  {
    tool: 'type',
    target: { role: 'textbox', name: 'Search' },
    value: 'acme corp',
    url: 'https://admin.acme.com/reports',
  },
];

const panel = (over: Partial<SkillRecording> = {}): SkillRecording => ({
  isRecording: false,
  count: 0,
  steps,
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
  clear: vi.fn(),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  createSkill.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  recording = panel();
});

describe('when there is nothing to review', () => {
  it('shows nothing at all', () => {
    recording = panel({ steps: null });
    const { container } = render(<SkillReview />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('reviewing a recording', () => {
  it('lists what was recorded in the words a person reads', () => {
    render(<SkillReview />);

    expect(screen.getByText('Click')).toBeInTheDocument();
    expect(screen.getByText('button “Export”')).toBeInTheDocument();
    expect(screen.getByText('Type into')).toBeInTheDocument();
  });

  it('will not save until it has a name', async () => {
    render(<SkillReview />);

    expect(screen.getByRole('button', { name: 'Save Skill' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Skill name'), 'Weekly report');
    expect(screen.getByRole('button', { name: 'Save Skill' })).toBeEnabled();
  });

  it('saves it to the agent that recorded it', async () => {
    render(<SkillReview />);
    await userEvent.type(screen.getByLabelText('Skill name'), 'Weekly report');
    await userEvent.click(screen.getByRole('button', { name: 'Save Skill' }));

    await waitFor(() => expect(createSkill).toHaveBeenCalled());
    expect(createSkill.mock.calls[0][0]).toMatchObject({
      org: 'acme',
      mentor: 'agent-1',
      name: 'Weekly report',
      slug: 'weekly-report',
    });
  });

  it('leaves out a step the person dropped', async () => {
    render(<SkillReview />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove step 1' }),
    );
    await userEvent.type(screen.getByLabelText('Skill name'), 'Weekly report');
    await userEvent.click(screen.getByRole('button', { name: 'Save Skill' }));

    await waitFor(() => expect(createSkill).toHaveBeenCalled());
    const { instruction } = createSkill.mock.calls[0][0];
    expect(instruction).not.toContain('Export');
    expect(instruction).toContain('Search');
  });

  it('writes a typed value into the skill only when it is kept', async () => {
    render(<SkillReview />);
    await userEvent.type(screen.getByLabelText('Skill name'), 'Weekly report');
    await userEvent.click(screen.getByRole('button', { name: 'Save Skill' }));
    await waitFor(() => expect(createSkill).toHaveBeenCalled());

    // Captured so review can offer it; written only on purpose.
    expect(createSkill.mock.calls[0][0].instruction).not.toContain('acme corp');
  });

  it('keeps the value when the person says to always use it', async () => {
    render(<SkillReview />);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.type(screen.getByLabelText('Skill name'), 'Weekly report');
    await userEvent.click(screen.getByRole('button', { name: 'Save Skill' }));

    await waitFor(() => expect(createSkill).toHaveBeenCalled());
    expect(createSkill.mock.calls[0][0].instruction).toContain('acme corp');
  });

  it('forgets the recording once it is saved', async () => {
    render(<SkillReview />);
    await userEvent.type(screen.getByLabelText('Skill name'), 'Weekly report');
    await userEvent.click(screen.getByRole('button', { name: 'Save Skill' }));

    await waitFor(() => expect(recording?.clear).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('keeps the recording when saving failed, so it is not lost', async () => {
    createSkill.mockReturnValue({
      unwrap: () => Promise.reject(new Error('500')),
    });
    render(<SkillReview />);
    await userEvent.type(screen.getByLabelText('Skill name'), 'Weekly report');
    await userEvent.click(screen.getByRole('button', { name: 'Save Skill' }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(recording?.clear).not.toHaveBeenCalled();
  });

  it('throws the recording away when the person discards it', async () => {
    render(<SkillReview />);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(recording?.clear).toHaveBeenCalled();
    expect(createSkill).not.toHaveBeenCalled();
  });
});

describe('a step that does not fit', () => {
  it('shortens an address instead of widening the panel', () => {
    // The panel is one narrow column; a mail thread's URL is ninety
    // characters and used to push every row sideways.
    expect(
      shortUrl(
        'https://mail.google.com/mail/u/0/#inbox/FMfcgzQjgqSSbXnbXhzTsWbfRPMNXbSM',
      ),
    ).toBe('mail.google.com/mail/u/0/#inbox/FMfcgzQ…');
  });

  it('leaves a short one alone', () => {
    expect(shortUrl('https://acme.com/reports')).toBe('acme.com/reports');
  });

  it('tells two threads of the same mailbox apart', () => {
    const one = shortUrl('https://mail.google.com/mail/u/0/#inbox/AAA111');
    const two = shortUrl('https://mail.google.com/mail/u/0/#inbox/BBB222');
    expect(one).not.toBe(two);
  });

  it('keeps something that is not an address at all', () => {
    expect(shortUrl('not a url')).toBe('not a url');
  });

  it('lets the full address be read on hover', () => {
    recording = panel({
      steps: [
        {
          tool: 'navigate',
          target: { role: 'page', name: 'Inbox' },
          url: 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQjgq',
        },
      ],
    });
    render(<SkillReview />);

    expect(
      screen.getByTitle(/mail.google.com\/mail\/u\/0/),
    ).toBeInTheDocument();
  });

  it('wraps rather than letting a row grow wider than the panel', () => {
    render(<SkillReview />);

    // `min-w-0` is what makes wrapping possible inside a flex row.
    const text = screen.getByText('Click').parentElement;
    expect(text).toHaveClass('min-w-0');
    expect(text).toHaveClass('break-words');
  });
});

describe('a value there is nothing to keep', () => {
  it('offers no checkbox for an empty one', () => {
    recording = panel({
      steps: [
        {
          tool: 'type',
          target: { role: 'textbox', name: 'To recipients' },
          value: '',
          url: 'https://mail.google.com/',
        },
      ],
    });
    render(<SkillReview />);

    // `Always use ""` asks a question with no answer.
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('what is left', () => {
  it('counts the steps', () => {
    render(<SkillReview />);
    expect(screen.getByText('2 steps')).toBeInTheDocument();
  });

  it('counts one properly', () => {
    recording = panel({ steps: [steps[0]] });
    render(<SkillReview />);
    expect(screen.getByText('1 step')).toBeInTheDocument();
  });

  it('says so when every step has been removed', async () => {
    render(<SkillReview />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove step 1' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove step 2' }),
    );

    expect(screen.getByText(/Every step was removed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Skill' })).toBeDisabled();
  });

  it('numbers what remains from one, with no gaps', async () => {
    recording = panel({ steps: [steps[0], steps[1], steps[0]] });
    render(<SkillReview />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove step 1' }),
    );

    const numbers = screen
      .getAllByRole('listitem')
      .map((row) => row.textContent?.trim().charAt(0));
    expect(numbers).toEqual(['1', '2']);
  });
});
