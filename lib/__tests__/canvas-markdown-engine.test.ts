import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ configureCanvasMarkdown: vi.fn() }));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  configureCanvasMarkdown: mocks.configureCanvasMarkdown,
}));

describe('canvas markdown engine registration', () => {
  // The first import of lib/utils transforms the whole markdown pipeline.
  it(
    "hands the SDK canvas this app's markdown converters on import",
    { timeout: 30_000 },
    async () => {
      const utils = await import('@/lib/utils');
      await import('@/lib/canvas-markdown-engine');

      expect(mocks.configureCanvasMarkdown).toHaveBeenCalledTimes(1);
      const engine = mocks.configureCanvasMarkdown.mock.calls[0][0];
      // The engine really is the chat's: GFM tables and KaTeX come through, and
      // HTML goes back to markdown the same way the chat converts it.
      expect(engine.markdownToHtml('| a |\n| --- |\n| 1 |')).toContain(
        '<table>',
      );
      expect(engine.markdownToHtml('$x^2$')).toContain('class="katex"');
      expect(engine.markdownToHtml('# Title')).toBe(
        utils.markdownToHtml('# Title'),
      );
      expect(engine.htmlToMarkdown('<h1>Title</h1>')).toBe(
        utils.htmlToMarkdown('<h1>Title</h1>'),
      );
    },
  );
});
