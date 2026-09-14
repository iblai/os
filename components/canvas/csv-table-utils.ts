/**
 * CSV/TSV ⇄ GFM-table bridge for the text canvas.
 *
 * Delimited files (csv, tsv) stream as regular TEXT artifacts, so they take
 * the rich-text canvas path. The editor only understands markdown, and raw
 * `a,b,c` lines are markdown prose — they collapsed into one paragraph of
 * comma-separated words. This module converts the file body to a GFM table
 * on the way INTO the editor (so it renders as real tabular data) and turns
 * the editor's table back into delimited text on the way OUT (so a user edit
 * saves a valid .csv, never a markdown table inside a .csv file).
 *
 * Cells are DATA, not prose. Every cell is written as literal text: markdown
 * syntax inside it is backslash-escaped and the cell is wrapped in `<samp>`,
 * which the markdown pipeline's post-processing (lib/utils.ts linkifyHtml)
 * treats as literal — otherwise `2026-09-08_1109` became `2026-09-08` plus a
 * subscript, then a tel: link, and each save re-applied the rewrite and grew
 * the cell. Only http(s) URLs are left bare so they stay clickable.
 */

const DELIMITERS: Record<string, string> = {
  csv: ',',
  tsv: '\t',
};

/** GFM header/body separator row: `| --- | :-: |`, with optional outer pipes. */
const GFM_SEPARATOR_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Bare http(s) URL run inside a cell — kept unescaped so GFM autolinks it. */
const URL_RUN = /https?:\/\/[^\s<>]+/g;

/** Inline markdown syntax that would restyle or swallow cell text. */
const MARKDOWN_INLINE_SPECIALS = /[\\`*_~[\]<>$|]/g;

/** `&amp;`-style entities would be decoded by rehype-raw; keep them literal. */
const HTML_ENTITY = /&(?=#?\w+;)/g;

const normalizeExtension = (fileExtension?: string | null): string =>
  (fileExtension ?? '').trim().toLowerCase().replace(/^\./, '');

/** Field delimiter for a delimited-text extension; undefined for anything else. */
export const getDelimitedFileDelimiter = (
  fileExtension?: string | null,
): string | undefined => DELIMITERS[normalizeExtension(fileExtension)];

/** Whether the extension is one the canvas renders as a table (csv/tsv). */
export const isDelimitedFileExtension = (
  fileExtension?: string | null,
): boolean => getDelimitedFileDelimiter(fileExtension) !== undefined;

/**
 * The delimited-text extension for an artifact, or undefined. The explicit
 * `file_extension` wins when it is itself csv/tsv; otherwise the title's
 * suffix decides — stream-start events default a missing extension to
 * "txt" while the backend titles shared files by filename ("leads.csv"),
 * so the title is the reliable signal for a VM-shared file.
 */
export const resolveDelimitedFileExtension = (
  fileExtension?: string | null,
  title?: string | null,
): 'csv' | 'tsv' | undefined => {
  const ext = normalizeExtension(fileExtension);
  if (isDelimitedFileExtension(ext)) return ext as 'csv' | 'tsv';
  // A real, non-placeholder extension (md, py, …) is authoritative.
  if (ext && ext !== 'txt') return undefined;
  const titleExt = (title ?? '')
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/)?.[1];
  if (titleExt && isDelimitedFileExtension(titleExt)) {
    return titleExt as 'csv' | 'tsv';
  }
  return undefined;
};

/**
 * RFC 4180-style parser: quoted fields, doubled-quote escapes, delimiters
 * and newlines inside quotes, CRLF/LF line endings. Blank lines are dropped.
 */
export const parseDelimitedText = (
  text: string,
  delimiter: string,
): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // CRLF: let the LF close the row; a lone CR closes it itself.
      if (text[i + 1] === '\n') {
        i += 1;
        continue;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
};

/** Whether the text already is a GFM table (header row + separator row). */
export const isGfmTable = (text: string): boolean => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return false;
  return /^\s*\|/.test(lines[0]) && GFM_SEPARATOR_ROW.test(lines[1]);
};

/** Backslash-escape inline markdown outside bare URLs. */
const escapeMarkdownInline = (text: string): string => {
  let out = '';
  let last = 0;
  for (const match of text.matchAll(URL_RUN)) {
    const index = match.index ?? 0;
    out += escapeMarkdownSegment(text.slice(last, index));
    // Only `|` would end the table cell; everything else in a URL is literal.
    out += match[0].replace(/\|/g, '\\|');
    last = index + match[0].length;
  }
  out += escapeMarkdownSegment(text.slice(last));
  return out;
};

const escapeMarkdownSegment = (text: string): string =>
  text
    .replace(MARKDOWN_INLINE_SPECIALS, (ch) => `\\${ch}`)
    .replace(HTML_ENTITY, '\\&');

/**
 * A cell's text as a literal GFM table cell: no line breaks (a cell is one
 * line), markdown escaped, wrapped in `<samp>` so the HTML post-processing
 * leaves it alone. Empty cells stay empty.
 */
const renderTableCell = (cell: string): string => {
  const flat = cell.replace(/\r\n|\r|\n/g, ' ').trim();
  if (!flat) return '';
  return `<samp>${escapeMarkdownInline(flat)}</samp>`;
};

/**
 * Convert delimited text to a GFM table. Returns the input unchanged when
 * the extension is not csv/tsv, the text is empty, or it is already a GFM
 * table (the canvas re-normalizes editor content, so this must be
 * idempotent). Ragged rows are padded to the widest row.
 */
export const delimitedTextToMarkdownTable = (
  text: string,
  fileExtension?: string | null,
): string => {
  const delimiter = getDelimitedFileDelimiter(fileExtension);
  if (!delimiter) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (isGfmTable(trimmed)) return trimmed;

  const rows = parseDelimitedText(trimmed, delimiter);
  if (rows.length === 0) return text;

  const width = Math.max(...rows.map((cells) => cells.length));
  const toLine = (cells: string[]): string => {
    const padded = [...cells, ...Array(width - cells.length).fill('')];
    return `| ${padded.map(renderTableCell).join(' | ')} |`;
  };
  const [header, ...body] = rows;
  const separator = `| ${Array(width).fill('---').join(' | ')} |`;
  return [toLine(header), separator, ...body.map(toLine)].join('\n');
};

/**
 * Plain text of a table cell as it appears in markdown — either our own
 * generated form (`<samp>` + escapes) or the editor serializer's (`\_`,
 * `<https://x>` autolinks, `[text](url)` links). Links reduce to their
 * visible text: the cell is data, and the href was derived from it.
 */
const plainTextFromMarkdownCell = (cell: string): string =>
  cell
    .replace(/<\/?samp>/g, '')
    .replace(/<((?:https?|mailto|tel):[^>\s]+)>/g, (_m, target: string) =>
      target.replace(/^(?:mailto|tel):/, ''),
    )
    .replace(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '$1')
    .replace(/\\([!-/:-@[-`{-~])/g, '$1')
    .trim();

/** Split a GFM table row into raw cells, honoring `\|` escapes. */
const splitTableRow = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let i = 0;
  const body = line.trim();
  const start = body.startsWith('|') ? 1 : 0;
  const end =
    body.endsWith('|') && !body.endsWith('\\|') ? body.length - 1 : body.length;
  for (i = start; i < end; i += 1) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '|') {
      current += '|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map(plainTextFromMarkdownCell);
};

const quoteField = (field: string, delimiter: string): string => {
  const needsQuotes =
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r');
  return needsQuotes ? `"${field.replace(/"/g, '""')}"` : field;
};

/**
 * Convert table markdown back to delimited text for saving into a csv/tsv
 * artifact. Table rows become records (the separator row is dropped); any
 * non-table line the user typed is kept verbatim as its own record. Returns
 * the markdown unchanged for non-delimited extensions. Prefer
 * `editorHtmlToDelimitedText` when the live editor is available — it reads
 * cell text straight from the DOM and never has to undo serializer escapes.
 */
export const markdownTableToDelimitedText = (
  markdown: string,
  fileExtension?: string | null,
): string => {
  const delimiter = getDelimitedFileDelimiter(fileExtension);
  if (!delimiter) return markdown;

  const records: string[] = [];
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.startsWith('|')) {
      records.push(line);
      continue;
    }
    if (GFM_SEPARATOR_ROW.test(line)) continue;
    records.push(
      splitTableRow(line)
        .map((cell) => quoteField(cell, delimiter))
        .join(delimiter),
    );
  }
  return records.join('\n');
};

/** Visible text of an editor table cell; paragraphs and <br> become newlines. */
const editorCellText = (cell: Element): string => {
  const clone = cell.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  const paragraphs = Array.from(clone.querySelectorAll('p'));
  const text =
    paragraphs.length > 0
      ? paragraphs.map((p) => p.textContent ?? '').join('\n')
      : (clone.textContent ?? '');
  return text.trim();
};

/**
 * Convert the editor's HTML (TipTap `editor.getHTML()`) to delimited text
 * for saving. Reads each cell's visible text from the DOM, so whatever the
 * renderer did to a cell for display (autolinks, marks) is invisible here
 * and the stored file only ever contains what the user sees. Lines outside
 * the table become their own records. Returns null when the HTML has no
 * table (or no DOM parser), so callers can fall back to the markdown path.
 */
export const editorHtmlToDelimitedText = (
  html: string,
  fileExtension?: string | null,
): string | null => {
  const delimiter = getDelimitedFileDelimiter(fileExtension);
  if (!delimiter || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.querySelector('table')) return null;

  const records: string[] = [];
  for (const el of Array.from(doc.body.children)) {
    if (el.tagName === 'TABLE') {
      el.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.children).filter((c) =>
          /^T[DH]$/.test(c.tagName),
        );
        records.push(
          cells
            .map((cell) => quoteField(editorCellText(cell), delimiter))
            .join(delimiter),
        );
      });
      continue;
    }
    const text = editorCellText(el);
    if (text) records.push(text);
  }
  return records.join('\n');
};
