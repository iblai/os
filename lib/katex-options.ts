/**
 * KaTeX renders unparseable TeX in `errorColor` (default `#cc0000`), a red box
 * that reads as an application crash. Model output is sometimes genuinely
 * malformed LaTeX that no normalization can repair, so both renderers fall
 * back to the app's muted foreground instead: the source stays legible without
 * shouting. Shared by the chat renderer and the canvas HTML pipeline so the
 * two agree.
 */
export const KATEX_ERROR_COLOR = 'var(--muted-foreground)';
