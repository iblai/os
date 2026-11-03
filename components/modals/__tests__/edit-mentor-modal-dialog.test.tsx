import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  EditMentorModalDialog,
  type Prompt,
} from '../edit-mentor-modal-dialog';

vi.mock('@iblai/iblai-js/web-containers', () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const prompt: Prompt = { label: 'System Prompt', type: 'systemPrompt' };

function Harness({
  onClose,
  editPrompt,
}: {
  onClose: () => void;
  editPrompt: (value: string, type: Prompt['type']) => void;
}) {
  const [value, setValue] = React.useState('');
  return (
    <EditMentorModalDialog
      isOpen
      onClose={onClose}
      prompt={prompt}
      value={value}
      editPrompt={(next, type) => {
        setValue(next);
        editPrompt(next, type);
      }}
    />
  );
}

describe('EditMentorModalDialog', () => {
  const onClose = vi.fn();
  const editPrompt = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    editPrompt.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders a Save button', () => {
    render(<Harness onClose={onClose} editPrompt={editPrompt} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('keeps typed text and closes on Save without a network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    render(<Harness onClose={onClose} editPrompt={editPrompt} />);

    await user.type(screen.getByTestId('rich-text-editor'), 'Be kind');
    expect(editPrompt).toHaveBeenLastCalledWith('Be kind', 'systemPrompt');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still closes with Escape', async () => {
    const user = userEvent.setup();
    render(<Harness onClose={onClose} editPrompt={editPrompt} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
