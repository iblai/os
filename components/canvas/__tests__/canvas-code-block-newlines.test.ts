import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { markdownToHtml } from '@/lib/utils';

// Regression for issue #2109: ProseMirror's DOM parser drops newline-only
// text nodes between inline <span>s inside <pre>, so highlighted HTML merged
// code lines ("Dictfrom", "log_executiondef") once loaded via setContent.

const ARTIFACT_FENCE = [
  '```python',
  'import json',
  'from typing import List, Dict',
  'from functools import wraps',
  'import logging',
  '',
  'logger = logging.getLogger(__name__)',
  '',
  'def log_execution(func):',
  '    """Decorator to log function execution times and results."""',
  '    @wraps(func)',
  '    def wrapper(*args, **kwargs):',
  '        logger.info(f"Starting {func.__name__}")',
  '        result = func(*args, **kwargs)',
  '        logger.info(f"Completed {func.__name__}")',
  '        return result',
  '    return wrapper',
  '',
  '@log_execution',
  'def process_data_batch(input_records: List[Dict]) -> List[Dict]:',
  '    """Process a batch of input records and return transformed results."""',
  '    processed_results = []',
  '    for record in input_records:',
  '        transformed_record = {',
  '            "id": record.get("id"),',
  '            "value": record.get("amount", 0) * 1.1',
  '        }',
  '        processed_results.append(transformed_record)',
  '    return processed_results',
  '```',
].join('\n');

const createEditor = (content: string) =>
  new Editor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-muted rounded-md p-4 font-mono text-sm',
          },
        },
      }),
    ],
    content,
  });

describe('canvas code block newline preservation (issue #2109)', () => {
  it('keeps every code line separate after markdownToHtml + setContent', () => {
    const editor = createEditor(markdownToHtml(ARTIFACT_FENCE));
    const text = editor.getText();
    editor.destroy();

    expect(text).toContain('Dict\nfrom functools');
    expect(text).toContain('@log_execution\ndef process_data_batch');
    expect(text).toContain('"""\n    @wraps(func)');
    expect(text).not.toContain('Dictfrom');
    expect(text).not.toContain('log_executiondef');
  });

  it('preserves the full fence body line count end to end', () => {
    const editor = createEditor(markdownToHtml(ARTIFACT_FENCE));
    const text = editor.getText();
    editor.destroy();

    const fenceBody = ARTIFACT_FENCE.split('\n').slice(1, -1);
    for (const line of fenceBody) {
      if (line.trim()) {
        expect(text).toContain(line);
      }
    }
    expect(text.split('\n').length).toBeGreaterThanOrEqual(fenceBody.length);
  });
});
