import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// IMPORTANT: this imports the LOCAL TipTap toolbar editor (components/rich-text-editor.tsx),
// which is a different component from the SDK RichTextEditor tested elsewhere.
import { RichTextEditor } from '../rich-text-editor';

/**
 * Tests for the LOCAL RichTextEditor (TipTap-based toolbar editor).
 *
 * Covers:
 * - Rendering the toolbar + editor content area
 * - Toolbar toggles (headings, bold, italic, inline code, code block, blockquote)
 * - value/onChange (markdown output via onUpdate)
 * - disabled state (contenteditable false + setEditable effect)
 * - markdown vs html input branches (isHtml ? value : markdownToHtml(value))
 */

const focusEditor = async (user: ReturnType<typeof userEvent.setup>) => {
  const editor = document.querySelector('.ProseMirror') as HTMLElement;
  await user.click(editor);
  return editor;
};

describe('RichTextEditor (local TipTap toolbar editor)', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toolbar buttons and editor content area', () => {
    render(<RichTextEditor value="" onChange={onChange} />);

    expect(screen.getByLabelText(/toggle heading 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle heading 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle heading 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle bold/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle italic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle inline code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle code block/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/toggle blockquote/i)).toBeInTheDocument();

    const editor = document.querySelector('.ProseMirror');
    expect(editor).toBeInTheDocument();
  });

  it('renders exactly the eight toolbar toggle buttons', () => {
    render(<RichTextEditor value="" onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    // 3 headings + bold + italic + inline code + code block + blockquote = 8
    expect(buttons.length).toBe(8);
  });

  it('renders markdown input by converting it to HTML', async () => {
    render(<RichTextEditor value="**bold text**" onChange={onChange} />);

    await waitFor(() => {
      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor.textContent).toContain('bold text');
      expect(editor.querySelector('strong')).toBeInTheDocument();
    });
  });

  it('renders HTML input directly (isHtml branch)', async () => {
    render(
      <RichTextEditor
        value="<p><em>italic html</em></p>"
        onChange={onChange}
      />,
    );

    await waitFor(() => {
      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor.textContent).toContain('italic html');
      expect(editor.querySelector('em')).toBeInTheDocument();
    });
  });

  it('toggles bold and emits markdown via onChange', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onChange={onChange} />);

    await focusEditor(user);

    const boldButton = screen.getByLabelText(/toggle bold/i);
    await user.click(boldButton);
    await user.keyboard('hello');

    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
  });

  it('reflects active bold state from pre-formatted content', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="**already bold**" onChange={onChange} />);

    await focusEditor(user);
    const boldButton = screen.getByLabelText(/toggle bold/i);

    await waitFor(() => {
      expect(boldButton).toHaveAttribute('data-state', 'on');
    });
  });

  it('reflects active italic state from pre-formatted content', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="*already italic*" onChange={onChange} />);

    await focusEditor(user);
    const italicButton = screen.getByLabelText(/toggle italic/i);

    await waitFor(() => {
      expect(italicButton).toHaveAttribute('data-state', 'on');
    });
  });

  it('reflects active inline code state from pre-formatted content', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="`code`" onChange={onChange} />);

    await focusEditor(user);
    const codeButton = screen.getByLabelText(/toggle inline code/i);

    await waitFor(() => {
      expect(codeButton).toHaveAttribute('data-state', 'on');
    });
  });

  it('reflects active heading states for each level', async () => {
    const user = userEvent.setup();

    const { unmount: u1 } = render(
      <RichTextEditor value="# Heading 1" onChange={onChange} />,
    );
    await focusEditor(user);
    await waitFor(() => {
      expect(screen.getByLabelText(/toggle heading 1/i)).toHaveAttribute(
        'data-state',
        'on',
      );
    });
    u1();

    const { unmount: u2 } = render(
      <RichTextEditor value="## Heading 2" onChange={onChange} />,
    );
    await focusEditor(user);
    await waitFor(() => {
      expect(screen.getByLabelText(/toggle heading 2/i)).toHaveAttribute(
        'data-state',
        'on',
      );
    });
    u2();

    render(<RichTextEditor value="### Heading 3" onChange={onChange} />);
    await focusEditor(user);
    await waitFor(() => {
      expect(screen.getByLabelText(/toggle heading 3/i)).toHaveAttribute(
        'data-state',
        'on',
      );
    });
  });

  it('toggles headings, italic, inline code, code block and blockquote without error', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onChange={onChange} />);

    await focusEditor(user);

    await user.click(screen.getByLabelText(/toggle heading 1/i));
    await user.click(screen.getByLabelText(/toggle heading 2/i));
    await user.click(screen.getByLabelText(/toggle heading 3/i));
    await user.click(screen.getByLabelText(/toggle italic/i));
    await user.click(screen.getByLabelText(/toggle inline code/i));
    await user.click(screen.getByLabelText(/toggle code block/i));
    await user.click(screen.getByLabelText(/toggle blockquote/i));

    // All toolbar buttons remain present after interactions.
    expect(screen.getAllByRole('button').length).toBe(8);
  });

  it('reflects active code block and blockquote state from HTML content', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <RichTextEditor
        value={'<pre><code>code block</code></pre>'}
        onChange={onChange}
      />,
    );
    await focusEditor(user);
    await waitFor(() => {
      expect(screen.getByLabelText(/toggle code block/i)).toHaveAttribute(
        'data-state',
        'on',
      );
    });
    unmount();

    render(
      <RichTextEditor
        value={'<blockquote><p>a quote</p></blockquote>'}
        onChange={onChange}
      />,
    );
    await focusEditor(user);
    await waitFor(() => {
      expect(screen.getByLabelText(/toggle blockquote/i)).toHaveAttribute(
        'data-state',
        'on',
      );
    });
  });

  it('is non-editable when disabled', () => {
    render(<RichTextEditor value="content" onChange={onChange} disabled />);

    const editor = document.querySelector('.ProseMirror') as HTMLElement;
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  it('updates editability when the disabled prop changes', async () => {
    const { rerender } = render(
      <RichTextEditor value="" onChange={onChange} disabled={false} />,
    );

    let editor = document.querySelector('.ProseMirror') as HTMLElement;
    expect(editor).toHaveAttribute('contenteditable', 'true');

    rerender(<RichTextEditor value="" onChange={onChange} disabled />);

    await waitFor(() => {
      editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });
  });

  it('emits markdown (not html) via onChange when typing plain text', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onChange={onChange} />);

    const editor = (await focusEditor(user)) as HTMLElement;
    editor.focus();
    await user.keyboard('Plain text here');

    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalled();
        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(typeof lastCall[0]).toBe('string');
        // Markdown output should not be wrapped in <p> tags.
        expect(lastCall[0]).not.toMatch(/^<p>/);
      },
      { timeout: 3000 },
    );
  });
});
