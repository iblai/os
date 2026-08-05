/**
 * @file normalize-list-indentation.ts
 * @input Markdown as emitted by an LLM, after LaTeX preprocessing
 * @output The same Markdown with under-indented nested list items re-indented
 *   to the parent item's content column. Consumed by <Markdown> (chat) and
 *   markdownToHtml (canvas).
 * @position Pure, dependency-free string transform.
 *
 * CommonMark only treats a list item as nested when its indent reaches the
 * parent item's content column (marker width + following space): 3+ columns
 * under `1. `, 2+ under `- `. LLMs routinely emit 2-space indents under
 * ordered markers, which both remark and marked parse as sibling lists (or
 * flatten into the parent, renumbering the items). Re-indent those children to
 * the parent's content column; correctly indented lists pass through
 * byte-for-byte.
 */

const MASK_OPEN = String.fromCharCode(0xe004);
const MASK_CLOSE = String.fromCharCode(0xe005);

const LIST_ITEM_PATTERN = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)(.*)$/;

type OpenList = {
  origIndent: number;
  origContentCol: number;
  shift: number;
};

export function normalizeListIndentation(content: string): string {
  if (typeof content !== 'string' || content.length === 0) {
    return typeof content === 'string' ? content : '';
  }

  // Code is literal by definition and block math has its own line grammar
  // (`- x + y` inside a $$ fence is an equation, not a bullet), so neither may
  // reach the line scan below. Mask them first, restore verbatim at the end.
  // The trailing unpaired fence matters for streaming: while the closing ```
  // has not arrived yet, the open fence body must not be re-indented.
  const placeholders: string[] = [];
  const mask = (segment: string): string => {
    const index = placeholders.length;
    placeholders.push(segment);
    return `${MASK_OPEN}${index}${MASK_CLOSE}`;
  };
  let masked = content
    .replace(/(`{3,})[\s\S]*?\1/g, mask)
    .replace(/(~{3,})[\s\S]*?\1/g, mask)
    .replace(
      /(^|\n)([ \t]*(?:`{3,}|~{3,})[\s\S]*)$/,
      (_match, before: string, fence: string) => before + mask(fence),
    )
    .replace(/^[ \t]*\$\$[ \t]*\n[\s\S]*?\n[ \t]*\$\$[ \t]*$/gm, mask)
    .replace(/(`+)((?:(?!\1)[\s\S])+?)\1(?!`)/g, mask);

  const stack: OpenList[] = [];
  let lastLineBlank = false;

  const lines = masked.split('\n').map((line) => {
    if (line.trim() === '') {
      lastLineBlank = true;
      return line;
    }

    const itemMatch = line.match(LIST_ITEM_PATTERN);
    if (itemMatch) {
      const [, indentText, marker, gap, rest] = itemMatch;
      const indent = indentText.length;
      while (stack.length && indent <= stack[stack.length - 1].origIndent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      let newIndent = indent;
      if (parent) {
        newIndent =
          indent >= parent.origContentCol
            ? indent + parent.shift
            : parent.origContentCol + parent.shift;
      }
      stack.push({
        origIndent: indent,
        origContentCol: indent + marker.length + Math.min(gap.length, 4),
        shift: newIndent - indent,
      });
      lastLineBlank = false;
      if (newIndent === indent) return line;
      return ' '.repeat(newIndent) + marker + gap + rest;
    }

    const indent = line.length - line.trimStart().length;
    // A paragraph after a blank line closes every list item whose content
    // column it does not reach; without the blank it is a lazy continuation of
    // the innermost open item and closes nothing.
    if (lastLineBlank) {
      while (stack.length && indent < stack[stack.length - 1].origContentCol) {
        stack.pop();
      }
    }
    lastLineBlank = false;
    const owner = stack[stack.length - 1];
    if (owner && owner.shift !== 0 && indent >= owner.origContentCol) {
      return ' '.repeat(indent + owner.shift) + line.slice(indent);
    }
    return line;
  });

  let result = lines.join('\n');
  const restorePattern = new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, 'g');
  // Masks can nest (a fence inside a masked $$ block), so restore until none
  // remain.
  let previous;
  do {
    previous = result;
    result = result.replace(
      restorePattern,
      (_, index) => placeholders[Number(index)] ?? '',
    );
  } while (result !== previous);
  return result;
}
