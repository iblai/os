/**
 * Markdown <-> HTML engine, split out of lib/utils so the heavy remark/rehype/
 * KaTeX/mhchem pipeline is no longer dragged into every module that only needs
 * a trivial helper (cn, isLoggedIn, ...). Import these from here, not lib/utils.
 */
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { remark } from 'remark';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import zilMath from '@ziloen/remark-math';
import { rehypeAlignedMath } from './rehype-aligned-math';
import { rehypeVerbCode } from './rehype-verb-code';
import { remarkLatexIslands } from './remark-latex-islands';
import { remarkLatexLineBreaks } from './remark-latex-line-breaks';
import { remarkTrimAutolinkHost } from './remark-trim-autolink-host';
import { rehypeReportMathErrors } from './markdown-math-error-reporter';
import { KATEX_ERROR_COLOR } from './katex-options';
import 'katex/contrib/mhchem';
import { normalizeListIndentation } from './normalize-list-indentation';
import { isHtml } from './utils';

export function htmlToMarkdown(htmlText: string) {
  if (!htmlText || typeof htmlText !== 'string') {
    return '';
  }

  try {
    let processedHtml = htmlText;

    // Restore display math from TipTap editor serialization (data-math-latex with data-math-display)
    processedHtml = processedHtml.replace(
      /<span\s+data-math-latex="([^"]*?)"\s+data-math-display="true"\s*><\/span>/g,
      (_, tex) => `$$${decodeHtmlEntities(tex)}$$`,
    );

    // Restore inline math from TipTap editor serialization (data-math-latex without data-math-display)
    processedHtml = processedHtml.replace(
      /<span\s+data-math-latex="([^"]*?)"\s*><\/span>/g,
      (_, tex) => `$${decodeHtmlEntities(tex)}$`,
    );

    // Restore inline math from KaTeX annotation elements
    // KaTeX renders math with an annotation element containing the original LaTeX
    // Use [\s\S]*? instead of .*? with 's' flag for ES5/ES6 compatibility
    processedHtml = processedHtml.replace(
      /<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g,
      (_, tex) => `$${decodeHtmlEntities(tex)}$`,
    );

    // Restore display math from KaTeX display elements
    processedHtml = processedHtml.replace(
      /<span class="katex-display">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g,
      (_, tex) => `$$${decodeHtmlEntities(tex)}$$`,
    );

    const file = remark()
      .use(rehypeParse, { emitParseErrors: true, duplicateAttribute: false })
      .use(rehypeRemark)
      .use(remarkGfm)
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '_',
        strong: '*',
        fences: true,
      })
      .processSync(processedHtml);

    return String(file).trimEnd();
  } catch (error) {
    console.error('[Markdown] Failed to convert HTML to markdown:', error);
    return htmlText;
  }
}

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text: string): string {
  if (typeof document === 'undefined') {
    // Server-side fallback - decode common entities manually
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export function parsePrompt(prompt: string) {
  if (isHtml(prompt)) {
    return htmlToMarkdown(prompt);
  }

  return prompt;
}

/**
 * Pre-process markdown to fix common formatting issues before conversion
 */
function preprocessMarkdownForHtml(markdown: string): string {
  let processed = markdown;

  // Handle ```markdown code blocks - extract content and render as actual markdown
  // This handles cases where LLM wraps markdown content in code blocks.
  // Runs before the code mask below on purpose: the unwrapped content IS
  // markdown and must go through the fixes.
  processed = processed.replace(
    /```(?:markdown|md)\s*\n([\s\S]*?)```/gi,
    (_match, content) => content.trim(),
  );

  // Every fix below is a whole-document regex, and a code-fence body is
  // literal text where a `# comment` line or the exact newline layout must
  // survive byte-for-byte (the list-break fix used to inject blank lines into
  // fenced code, and the heading fixes merged comment lines). Mask fenced and
  // inline code first -- including a trailing fence whose closer has not
  // streamed in yet -- and restore verbatim at the end.
  const codeOpen = String.fromCharCode(0xe006);
  const codeClose = String.fromCharCode(0xe007);
  const codePlaceholders: string[] = [];
  const maskCode = (segment: string): string => {
    const index = codePlaceholders.length;
    codePlaceholders.push(segment);
    return `${codeOpen}${index}${codeClose}`;
  };
  processed = processed
    .replace(/(`{3,})[\s\S]*?\1/g, maskCode)
    .replace(/(~{3,})[\s\S]*?\1/g, maskCode)
    .replace(
      /(^|\n)([ \t]*(?:`{3,}|~{3,})[\s\S]*)$/,
      (_match, before: string, fence: string) => before + maskCode(fence),
    )
    .replace(/(`+)((?:(?!\1)[\s\S])+?)\1(?!`)/g, maskCode);

  // Restore escaped markdown links so they render as actual links
  // Example: "\[Get started\](https://example.com)" -> "[Get started](https://example.com)"
  processed = processed.replace(
    /\\\[([^\]]+?)\\\]\s*\(([^)]+)\)/g,
    (match, label, href) => {
      const trimmedHref = String(href ?? '').trim();
      if (
        /^(https?:\/\/|mailto:|tel:|www\.)/i.test(trimmedHref) ||
        EMAIL_PATTERN.test(trimmedHref)
      ) {
        return `[${label}](${trimmedHref})`;
      }
      return match;
    },
  );

  // Fix headings with newlines after # (e.g., "#\nTitle" -> "# Title")
  // This handles cases where LLM outputs malformed heading syntax
  processed = processed.replace(/^(#{1,6})\s*\n+(.+)$/gm, '$1 $2');

  // Remove excessive newlines after headings (keep max 1 newline)
  processed = processed.replace(/^(#{1,6}\s+.+)\n{3,}/gm, '$1\n\n');

  // Ensure proper spacing around bold/italic markers within headings
  // Fix cases like "# **Title**\n" to work correctly
  processed = processed.replace(/^(#{1,6})\s*(\*\*|__)/gm, '$1 $2');

  // Ensure list items have proper line breaks
  // Fix consecutive list items that might be on same line
  processed = processed.replace(/([^\n])(\n)([-*+]|\d+\.)\s/g, '$1\n\n$3 ');

  // Restore code verbatim.
  const restoreCodePattern = new RegExp(`${codeOpen}(\\d+)${codeClose}`, 'g');
  processed = processed.replace(
    restoreCodePattern,
    (_, index) => codePlaceholders[Number(index)] ?? '',
  );

  return processed;
}

const LINKIFY_SKIP_TAGS = new Set([
  'A',
  'CODE',
  'PRE',
  // <samp> is literal sample output. The canvas wraps csv/tsv cells in it
  // (components/canvas/csv-table-utils.ts) so data like a run id
  // `2026-09-08_1109` is neither turned into a subscript nor into a tel:
  // link — both rewrites drop characters and then get re-applied on every
  // save, growing the cell each time.
  'SAMP',
  'SCRIPT',
  'STYLE',
  'TEXTAREA',
]);
const LINKIFY_PATTERN_SOURCE =
  '(?:https?:\\/\\/[^\\s<]+|www\\.[^\\s<]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|(?<!\\w)(?:\\+?\\d|\\(\\d)[\\d\\s().-]{6,}\\d(?!\\w))';
const MARKDOWN_LINK_PATTERN = '\\[([^\\]]+)\\]\\s*\\(([^)]+)\\)';
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const SUP_SUB_PATTERN_SOURCE =
  '([A-Za-z0-9\\)\\]\\}])(?:\\^\\(([^)]+)\\)|\\^\\{([^}]+)\\}|\\^([A-Za-z0-9]+)|_([0-9]+))';

const getLinkifyRegex = () => new RegExp(LINKIFY_PATTERN_SOURCE, 'gi');
const getMarkdownLinkRegex = () => new RegExp(MARKDOWN_LINK_PATTERN, 'g');
const hasMarkdownLink = (text: string) =>
  new RegExp(MARKDOWN_LINK_PATTERN).test(text);
const getSupSubRegex = () => new RegExp(SUP_SUB_PATTERN_SOURCE, 'g');
const hasSupSubPattern = (text: string) =>
  new RegExp(SUP_SUB_PATTERN_SOURCE).test(text);

const shouldSkipLinkify = (element: Element | null): boolean => {
  let current: Element | null = element;
  while (current) {
    if (LINKIFY_SKIP_TAGS.has(current.tagName)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const shouldSkipSupSub = (element: Element | null): boolean => {
  let current: Element | null = element;
  while (current) {
    if (LINKIFY_SKIP_TAGS.has(current.tagName) || current.tagName === 'MATH') {
      return true;
    }
    if (
      current.classList?.contains('katex') ||
      current.classList?.contains('katex-display')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const stripTrailingPunctuation = (
  text: string,
): { linkText: string; trailing: string } => {
  let linkText = text;
  let trailing = '';

  const punctuationMatch = linkText.match(/[.,!?;:]+$/);
  if (punctuationMatch) {
    trailing = punctuationMatch[0] + trailing;
    linkText = linkText.slice(0, -punctuationMatch[0].length);
  }

  const bracketPairs = [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '{', close: '}' },
  ];

  for (const { open, close } of bracketPairs) {
    while (linkText.endsWith(close)) {
      const openCount = (linkText.match(new RegExp(`\\${open}`, 'g')) ?? [])
        .length;
      const closeCount = (linkText.match(new RegExp(`\\${close}`, 'g')) ?? [])
        .length;
      if (closeCount > openCount) {
        trailing = close + trailing;
        linkText = linkText.slice(0, -1);
      } else {
        break;
      }
    }
  }

  return { linkText, trailing };
};

const normalizePhoneNumber = (text: string): string | null => {
  const trimmed = text.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (!hasPlus && digits.length < 10 && !/[()\s.-]/.test(trimmed)) {
    return null;
  }

  return hasPlus ? `+${digits}` : digits;
};

const resolveLinkMatch = (
  rawMatch: string,
): { href: string; text: string; trailing: string } | null => {
  const { linkText, trailing } = stripTrailingPunctuation(rawMatch);
  if (!linkText) {
    return null;
  }

  if (/^https?:\/\//i.test(linkText)) {
    return { href: linkText, text: linkText, trailing };
  }
  /* istanbul ignore next -- @preserve www URL pattern rarely matched in tests */
  if (/^www\./i.test(linkText)) {
    return { href: `http://${linkText}`, text: linkText, trailing };
  }
  /* istanbul ignore next -- @preserve email pattern */
  if (EMAIL_PATTERN.test(linkText)) {
    return { href: `mailto:${linkText}`, text: linkText, trailing };
  }

  const normalizedPhone = normalizePhoneNumber(linkText);
  if (normalizedPhone) {
    return { href: `tel:${normalizedPhone}`, text: linkText, trailing };
  }
  /* istanbul ignore next -- @preserve fallback when no link type matched */
  return null;
};

const linkifyTextNode = (
  text: string,
  doc: Document,
): DocumentFragment | null => {
  const matches = Array.from(text.matchAll(getLinkifyRegex()));
  /* istanbul ignore next -- @preserve early return when no matches */
  if (matches.length === 0) {
    return null;
  }

  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;

  matches.forEach((match) => {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, index)));
    }

    const rawMatch = match[0];
    const resolved = resolveLinkMatch(rawMatch);

    if (resolved) {
      const anchor = doc.createElement('a');
      anchor.setAttribute('href', resolved.href);
      anchor.textContent = resolved.text;
      fragment.appendChild(anchor);
      /* istanbul ignore next -- @preserve trailing text after link */
      if (resolved.trailing) {
        fragment.appendChild(doc.createTextNode(resolved.trailing));
      }
    } else {
      /* istanbul ignore next -- @preserve fallback when link resolution fails */
      fragment.appendChild(doc.createTextNode(rawMatch));
    }

    lastIndex = index + rawMatch.length;
  });
  /* istanbul ignore next -- @preserve append trailing text */
  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
};

const normalizeMarkdownLinkText = (text: string): string => {
  return text.replace(/\\([\\[\]()])/g, '$1');
};

/* istanbul ignore next -- @preserve internal href normalization helper */
const normalizeMarkdownLinkHref = (text: string): string => {
  let href = text.trim();
  if (
    (href.startsWith('<') && href.endsWith('>')) ||
    (href.startsWith('"') && href.endsWith('"'))
  ) {
    href = href.slice(1, -1);
  }
  if (href.startsWith("'") && href.endsWith("'")) {
    href = href.slice(1, -1);
  }
  const firstToken = href.split(/\s+/)[0];
  href = firstToken ?? href;
  href = href.replace(/\\:/g, ':').replace(/\\\)/g, ')').replace(/\\\(/g, '(');
  return href;
};

/* istanbul ignore next -- @preserve internal helper for linkifying text */
const appendLinkifiedText = (
  fragment: DocumentFragment,
  text: string,
  doc: Document,
) => {
  if (!text) return;
  const linkified = linkifyTextNode(text, doc);
  if (linkified) {
    fragment.appendChild(linkified);
  } else {
    fragment.appendChild(doc.createTextNode(text));
  }
};

const linkifyMarkdownTextNode = (
  text: string,
  doc: Document,
): DocumentFragment | null => {
  const sourceText = text.replace(/\\([\\[\]()])/g, '$1');
  if (!hasMarkdownLink(sourceText)) {
    return null;
  }

  const regex = getMarkdownLinkRegex();
  let match: RegExpExecArray | null;
  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;

  while ((match = regex.exec(sourceText)) !== null) {
    const matchIndex = match.index ?? 0;
    const isImage = matchIndex > 0 && sourceText[matchIndex - 1] === '!';

    /* istanbul ignore next -- @preserve image link handling (![alt](url)) */
    if (isImage) {
      const before = sourceText.slice(
        lastIndex,
        matchIndex > 0 ? matchIndex - 1 : 0,
      );
      appendLinkifiedText(fragment, before, doc);
      fragment.appendChild(doc.createTextNode(`!${match[0]}`));
      lastIndex = matchIndex + match[0].length;
      continue;
    }

    const before = sourceText.slice(lastIndex, matchIndex);
    appendLinkifiedText(fragment, before, doc);

    const label = normalizeMarkdownLinkText(match[1]);
    const href = normalizeMarkdownLinkHref(match[2]);

    if (href) {
      const anchor = doc.createElement('a');
      anchor.setAttribute('href', href);
      anchor.textContent = label;
      fragment.appendChild(anchor);
      /* istanbul ignore next -- @preserve fallback for invalid href */
    } else {
      fragment.appendChild(doc.createTextNode(match[0]));
    }

    lastIndex = matchIndex + match[0].length;
  }

  /* istanbul ignore next -- @preserve append remaining text after matches */
  if (lastIndex < sourceText.length) {
    appendLinkifiedText(fragment, sourceText.slice(lastIndex), doc);
  }

  return fragment;
};

const supSubTextNode = (
  text: string,
  doc: Document,
): DocumentFragment | null => {
  const matches = Array.from(text.matchAll(getSupSubRegex()));
  /* istanbul ignore next -- @preserve early return when no sup/sub patterns */
  if (matches.length === 0) {
    return null;
  }

  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;

  matches.forEach((match) => {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, index)));
    }

    const base = match[1];
    const supValue = match[2] ?? match[3] ?? match[4];
    const subValue = match[5];
    const value = supValue ?? subValue ?? '';
    const tag = supValue ? 'sup' : 'sub';

    fragment.appendChild(doc.createTextNode(base));
    const node = doc.createElement(tag);
    node.textContent = value;
    fragment.appendChild(node);

    lastIndex = index + match[0].length;
  });

  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
};

const linkifyHtml = (html: string): string => {
  /* istanbul ignore next -- @preserve SSR check for server-side rendering */
  if (typeof document === 'undefined') {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const replaceTextNode = (textNode: Text) => {
    /* istanbul ignore next -- @preserve defensive check for orphan/skipped nodes */
    if (!textNode.parentElement || shouldSkipLinkify(textNode.parentElement)) {
      return;
    }
    const value = textNode.nodeValue ?? '';
    /* istanbul ignore next -- @preserve defensive check for empty text nodes */
    if (!value) {
      return;
    }

    const markdownFragment = linkifyMarkdownTextNode(
      value,
      container.ownerDocument,
    );
    if (markdownFragment && textNode.parentNode) {
      textNode.parentNode.replaceChild(markdownFragment, textNode);
      return;
    }

    /* istanbul ignore next -- @preserve early return when no linkifiable content */
    if (!value.match(getLinkifyRegex())) {
      return;
    }

    const fragment = linkifyTextNode(value, container.ownerDocument);
    if (fragment && textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  };

  if (typeof document.createTreeWalker === 'function') {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        /* istanbul ignore next -- @preserve defensive check for orphan nodes */
        if (!node.parentElement) {
          return NodeFilter.FILTER_REJECT;
        }
        if (shouldSkipLinkify(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !node.nodeValue.match(getLinkifyRegex())) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach((textNode) => {
      replaceTextNode(textNode);
    });
    /* istanbul ignore else -- @preserve fallback for environments without TreeWalker */
  } else {
    /* istanbul ignore next -- @preserve */
    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        replaceTextNode(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const element = node as Element;
      if (shouldSkipLinkify(element)) {
        return;
      }
      const children = Array.from(element.childNodes);
      children.forEach((child) => walkNodes(child));
    };
    /* istanbul ignore next -- @preserve */
    walkNodes(container);
  }

  const replaceSupSubTextNode = (textNode: Text) => {
    /* istanbul ignore next -- @preserve defensive check for orphan/skipped nodes */
    if (!textNode.parentElement || shouldSkipSupSub(textNode.parentElement)) {
      return;
    }
    const value = textNode.nodeValue ?? '';
    /* istanbul ignore next -- @preserve defensive check for empty text nodes */
    if (!value || !hasSupSubPattern(value)) {
      return;
    }

    const fragment = supSubTextNode(value, container.ownerDocument);
    if (fragment && textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  };

  if (typeof document.createTreeWalker === 'function') {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        /* istanbul ignore next -- @preserve defensive check for orphan nodes */
        if (!node.parentElement) {
          return NodeFilter.FILTER_REJECT;
        }
        if (shouldSkipSupSub(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !hasSupSubPattern(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach((textNode) => {
      replaceSupSubTextNode(textNode);
    });
    /* istanbul ignore else -- @preserve fallback for environments without TreeWalker */
  } else {
    /* istanbul ignore next -- @preserve */
    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        replaceSupSubTextNode(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const element = node as Element;
      if (shouldSkipSupSub(element)) {
        return;
      }
      const children = Array.from(element.childNodes);
      children.forEach((child) => walkNodes(child));
    };
    /* istanbul ignore next -- @preserve */
    walkNodes(container);
  }

  return container.innerHTML;
};

// The LaTeX and maths stack is the chat renderer's (components/markdown.tsx),
// in the same order -- @ziloen/remark-math, remarkLatexIslands,
// remarkLatexLineBreaks, then rehypeVerbCode, rehypeAlignedMath, rehype-katex
// and the telemetry pass -- so a formula resolves identically on both paths.
// The rest deliberately differs, and the differences are visible:
//   - no remark-breaks: canvas keeps the old `marked` `breaks: false`
//     behaviour, so a single newline is a space here and a <br> in chat;
//   - no Streamdown codeMeta: canvas has no code-fence metadata to read;
//   - no rehype-harden: chat's raw -> sanitize -> harden chain ends with
//     harden's link/image origin policy, which canvas does not need (it has
//     no interstitial and its links open through the editor);
//   - the whole string is parsed in one piece, where chat block-splits it
//     first with parseLatexAwareBlocks.
// Built once at module scope.
// Streamdown's own sanitiser schema, so the two paths allow the same HTML.
// `clobberPrefix: ''` keeps heading/footnote ids unprefixed, and `tel:` is
// permitted for parity with the chat renderer's urlTransform.
const sanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'tel'],
  },
};

const markdownHtmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(zilMath)
  .use(remarkLatexIslands)
  .use(remarkLatexLineBreaks)
  .use(remarkTrimAutolinkHost)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  // Must sit between rehype-raw and rehype-katex, exactly as it does in
  // Streamdown: raw HTML from the message is scrubbed here, while KaTeX's own
  // markup is generated afterwards and so is never subject to the schema
  // (defaultSchema would strip its MathML and class names).
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeVerbCode)
  .use(rehypeAlignedMath)
  // htmlAndMathml keeps the <annotation> element the canvas math/export
  // consumers read back, and is accessibility-friendly.
  .use(rehypeKatex, { output: 'htmlAndMathml', errorColor: KATEX_ERROR_COLOR })
  .use(rehypeReportMathErrors, { path: 'canvas' })
  .use(rehypeStringify, { allowDangerousHtml: true });

export function markdownToHtml(markdownText: string) {
  if (!markdownText || typeof markdownText !== 'string') {
    return '';
  }

  try {
    // Pre-process to fix common markdown issues
    const cleanedMarkdown = normalizeListIndentation(
      preprocessMarkdownForHtml(markdownText),
    );

    const html = String(markdownHtmlProcessor.processSync(cleanedMarkdown));
    return linkifyHtml(html);
  } catch (error) {
    /* istanbul ignore next -- @preserve defensive error handling */
    console.error('[Markdown] Failed to convert markdown to HTML:', error);
    /* istanbul ignore next -- @preserve */
    return markdownText;
  }
}
