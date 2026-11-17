import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ configureCanvasMarkdown: vi.fn() }));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  configureCanvasMarkdown: mocks.configureCanvasMarkdown,
}));

// Imported at the top, not inside the test. `vi.mock` is hoisted above these,
// so the registration still happens against the mock and the assertion below
// still proves it happened on import — but compiling the markdown pipeline now
// costs collection time rather than the test's own budget, where it was close
// enough to the timeout to fail whenever the machine was busy.
import * as mdEngine from '@/lib/markdown-engine';
import '@/lib/canvas-markdown-engine';

describe('canvas markdown engine registration', () => {
  it("hands the SDK canvas this app's markdown converters on import", () => {
    expect(mocks.configureCanvasMarkdown).toHaveBeenCalledTimes(1);
    const engine = mocks.configureCanvasMarkdown.mock.calls[0][0];
    // The engine really is the chat's: GFM tables and KaTeX come through, and
    // HTML goes back to markdown the same way the chat converts it.
    expect(engine.markdownToHtml('| a |\n| --- |\n| 1 |')).toContain('<table>');
    expect(engine.markdownToHtml('$x^2$')).toContain('class="katex"');
    expect(engine.markdownToHtml('# Title')).toBe(
      mdEngine.markdownToHtml('# Title'),
    );
    expect(engine.htmlToMarkdown('<h1>Title</h1>')).toBe(
      mdEngine.htmlToMarkdown('<h1>Title</h1>'),
    );
  });
});
