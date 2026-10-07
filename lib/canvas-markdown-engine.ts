/**
 * Hands the SDK's canvas this app's markdown engine, once, at start-up.
 *
 * The canvas (`CanvasView` from the SDK) converts markdown to HTML on the way
 * into its editor and back on the way out to a save. It must render a
 * document exactly as the chat beside it renders it — GFM tables, KaTeX
 * math, the same sanitising — and that engine is `markdownToHtml` /
 * `htmlToMarkdown` here, shared with the chat's own `Markdown`. Registering
 * it means every canvas, live or read-only in history, uses it; the SDK's own
 * converters are only the fallback for hosts that register nothing.
 *
 * KaTeX's stylesheet comes with the engine that renders KaTeX: the SDK does
 * not bundle it (bundled, its relative font URLs would point nowhere).
 */
import 'katex/dist/katex.min.css';
import { configureCanvasMarkdown } from '@iblai/iblai-js/web-containers';
import { htmlToMarkdown, markdownToHtml } from '@/lib/utils';

// Wrapped, not passed by reference: the converters are read when a canvas
// converts, not when the app boots.
configureCanvasMarkdown({
  markdownToHtml: (markdown) => markdownToHtml(markdown),
  htmlToMarkdown: (html) => htmlToMarkdown(html),
});
