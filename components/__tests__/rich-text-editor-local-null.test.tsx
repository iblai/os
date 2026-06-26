import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

/**
 * Focused test for the LOCAL RichTextEditor's null-editor guard.
 *
 * When TipTap's `useEditor` has not yet produced an editor instance it returns
 * null. In that state the EditorToolbar must render nothing (early return) and
 * EditorContent must render without throwing. We mock `@tiptap/react` so that
 * `useEditor` returns null deterministically to cover that branch.
 */
vi.mock('@tiptap/react', () => ({
  useEditor: () => null,
  // EditorContent renders an empty placeholder regardless of editor state.
  EditorContent: () => <div data-testid="editor-content" />,
  Editor: class {},
}));

import { RichTextEditor } from '../rich-text-editor';

describe('RichTextEditor (local) — null editor guard', () => {
  it('renders nothing in the toolbar when the editor is null', () => {
    const onChange = vi.fn();
    const { container, getByTestId } = render(
      <RichTextEditor value="" onChange={onChange} />,
    );

    // The EditorContent placeholder still renders.
    expect(getByTestId('editor-content')).toBeInTheDocument();

    // The toolbar (EditorToolbar) returns null, so no toggle buttons exist.
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('does not crash when disabled with a null editor', () => {
    const onChange = vi.fn();
    expect(() =>
      render(<RichTextEditor value="x" onChange={onChange} disabled />),
    ).not.toThrow();
  });
});
