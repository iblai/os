import { Node } from '@tiptap/core';
import katex from 'katex';

/**
 * Extract LaTeX source from a KaTeX-rendered HTML element.
 * KaTeX embeds the original TeX in an <annotation encoding="application/x-tex"> element.
 */
function extractLatexFromElement(element: HTMLElement): string {
  const annotation = element.querySelector(
    'annotation[encoding="application/x-tex"]',
  );
  if (annotation?.textContent) {
    return annotation.textContent;
  }
  return element.textContent ?? '';
}

/**
 * Render LaTeX to HTML string using KaTeX.
 */
function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      output: 'htmlAndMathml',
    });
  } catch {
    return latex;
  }
}

/**
 * Inline math node for TipTap.
 * Parses <span class="katex"> from KaTeX HTML and <span data-math-latex> from getHTML() output.
 * Both must be inline. Inline math lands inside a <p>. Display math does NOT:
 * under the unified pipeline @ziloen emits <pre><code class="language-math
 * math-display">, and rehype-katex replaces the <pre> itself, so
 * <span class="katex-display"> ends up as a ROOT-level sibling of the
 * paragraphs rather than nested in one. ProseMirror then wraps that stray
 * inline node into a paragraph of its own, which is why an inline node still
 * matches. Declaring either as a block node would reject the inline case.
 */
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          // From getHTML() serialization: read data attribute
          const dataLatex = element.getAttribute('data-math-latex');
          if (dataLatex) return dataLatex;
          // From markdownToHtml() KaTeX output: read annotation
          return extractLatexFromElement(element);
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      // Match serialized output from getHTML()
      {
        tag: 'span[data-math-latex]:not([data-math-display])',
      },
      // Match KaTeX HTML from markdownToHtml()
      {
        tag: 'span.katex',
        getAttrs(node) {
          const element = node as HTMLElement;
          // Skip elements inside katex-display (handled by MathDisplay)
          if (element.closest('.katex-display')) {
            return false;
          }
          return null;
        },
      },
    ];
  },

  // renderHTML is used by getHTML() serialization.
  // Output a span with data attributes so htmlToMarkdown() can extract latex.
  renderHTML({ node }) {
    return ['span', { 'data-math-latex': node.attrs.latex }];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.contentEditable = 'false';
      dom.innerHTML = renderLatex(node.attrs.latex, false);
      return { dom };
    };
  },
});

/**
 * Display math node for TipTap.
 * Parses <span class="katex-display"> from KaTeX HTML.
 * Must be inline (not block): see the note above — the wrapper is a <div>
 * under the unified pipeline, and ProseMirror re-wraps it into a paragraph.
 * Rendered visually as a block via CSS in the NodeView.
 */
export const MathBlock = Node.create({
  name: 'mathBlock',
  // Inline for the reason documented above the node definition
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          const dataLatex = element.getAttribute('data-math-latex');
          if (dataLatex) return dataLatex;
          return extractLatexFromElement(element);
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      // Match serialized output from getHTML()
      {
        tag: 'span[data-math-latex][data-math-display]',
      },
      // Match KaTeX HTML from markdownToHtml()
      {
        tag: 'span.katex-display',
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'span',
      { 'data-math-latex': node.attrs.latex, 'data-math-display': 'true' },
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.style.display = 'block';
      dom.contentEditable = 'false';
      dom.innerHTML = renderLatex(node.attrs.latex, true);
      return { dom };
    };
  },
});
