import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock katex before importing the module
const mockRenderToString = vi.fn();
vi.mock('katex', () => ({
  default: {
    renderToString: (...args: any[]) => mockRenderToString(...args),
  },
}));

// Import after mocks
import { MathInline, MathBlock } from '../tiptap-math-extension';

describe('tiptap-math-extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRenderToString.mockImplementation(
      (latex: string) => `<span class="katex">${latex}</span>`,
    );
  });

  // ============================================================================
  // MathInline
  // ============================================================================
  describe('MathInline', () => {
    it('should have correct name', () => {
      expect(MathInline.name).toBe('mathInline');
    });

    it('should be configured as inline and atom', () => {
      const config = MathInline.config;
      expect(config.group).toBe('inline');
      expect(config.inline).toBe(true);
      expect(config.atom).toBe(true);
    });

    describe('addAttributes', () => {
      it('should define latex attribute with default empty string', () => {
        const attrs = MathInline.config.addAttributes!.call(MathInline);
        expect(attrs.latex.default).toBe('');
      });

      it('should parse latex from data-math-latex attribute', () => {
        const attrs = MathInline.config.addAttributes!.call(MathInline);
        const element = document.createElement('span');
        element.setAttribute('data-math-latex', 'x^2');
        expect(attrs.latex.parseHTML!(element)).toBe('x^2');
      });

      it('should parse latex from annotation element when no data attribute', () => {
        const attrs = MathInline.config.addAttributes!.call(MathInline);
        const element = document.createElement('span');
        element.classList.add('katex');
        const annotation = document.createElement('annotation');
        annotation.setAttribute('encoding', 'application/x-tex');
        annotation.textContent = '\\alpha + \\beta';
        element.appendChild(annotation);
        expect(attrs.latex.parseHTML!(element)).toBe('\\alpha + \\beta');
      });

      it('should fall back to textContent when no annotation', () => {
        const attrs = MathInline.config.addAttributes!.call(MathInline);
        const element = document.createElement('span');
        element.textContent = 'fallback text';
        expect(attrs.latex.parseHTML!(element)).toBe('fallback text');
      });

      it('should return empty string for empty element with no annotation', () => {
        const attrs = MathInline.config.addAttributes!.call(MathInline);
        const element = document.createElement('span');
        expect(attrs.latex.parseHTML!(element)).toBe('');
      });

      it('should return empty object from renderHTML', () => {
        const attrs = MathInline.config.addAttributes!.call(MathInline);
        expect(attrs.latex.renderHTML!({})).toEqual({});
      });
    });

    describe('parseHTML', () => {
      it('should match span[data-math-latex] without data-math-display', () => {
        const rules = MathInline.config.parseHTML!.call(MathInline);
        expect(rules[0].tag).toBe('span[data-math-latex]:not([data-math-display])');
      });

      it('should match span.katex', () => {
        const rules = MathInline.config.parseHTML!.call(MathInline);
        expect(rules[1].tag).toBe('span.katex');
      });

      it('should reject span.katex inside katex-display', () => {
        const rules = MathInline.config.parseHTML!.call(MathInline);
        const getAttrs = rules[1].getAttrs!;

        const parent = document.createElement('span');
        parent.classList.add('katex-display');
        const child = document.createElement('span');
        child.classList.add('katex');
        parent.appendChild(child);

        expect(getAttrs(child)).toBe(false);
      });

      it('should accept span.katex not inside katex-display', () => {
        const rules = MathInline.config.parseHTML!.call(MathInline);
        const getAttrs = rules[1].getAttrs!;

        const element = document.createElement('span');
        element.classList.add('katex');
        document.body.appendChild(element);

        expect(getAttrs(element)).toBeNull();
        document.body.removeChild(element);
      });
    });

    describe('renderHTML', () => {
      it('should output span with data-math-latex attribute', () => {
        const renderHTML = MathInline.config.renderHTML!;
        const result = renderHTML.call(MathInline, {
          node: { attrs: { latex: 'x^2 + y^2' } } as any,
          HTMLAttributes: {},
        } as any);
        expect(result).toEqual(['span', { 'data-math-latex': 'x^2 + y^2' }]);
      });

      it('should handle empty latex', () => {
        const renderHTML = MathInline.config.renderHTML!;
        const result = renderHTML.call(MathInline, {
          node: { attrs: { latex: '' } } as any,
          HTMLAttributes: {},
        } as any);
        expect(result).toEqual(['span', { 'data-math-latex': '' }]);
      });
    });

    describe('addNodeView', () => {
      it('should create a span with rendered KaTeX content', () => {
        mockRenderToString.mockReturnValue('<span>rendered</span>');
        const nodeViewFactory = MathInline.config.addNodeView!.call(MathInline);
        const nodeView = (nodeViewFactory as any)({
          node: { attrs: { latex: 'x^2' } },
        });
        expect(nodeView.dom.tagName).toBe('SPAN');
        expect(nodeView.dom.contentEditable).toBe('false');
        expect(nodeView.dom.innerHTML).toBe('<span>rendered</span>');
        expect(mockRenderToString).toHaveBeenCalledWith('x^2', {
          throwOnError: false,
          displayMode: false,
          output: 'htmlAndMathml',
        });
      });

      it('should handle KaTeX render failure gracefully', () => {
        mockRenderToString.mockImplementation(() => {
          throw new Error('KaTeX error');
        });
        const nodeViewFactory = MathInline.config.addNodeView!.call(MathInline);
        const nodeView = (nodeViewFactory as any)({
          node: { attrs: { latex: 'invalid \\bad' } },
        });
        // Falls back to raw latex string
        expect(nodeView.dom.innerHTML).toBe('invalid \\bad');
      });
    });
  });

  // ============================================================================
  // MathBlock
  // ============================================================================
  describe('MathBlock', () => {
    it('should have correct name', () => {
      expect(MathBlock.name).toBe('mathBlock');
    });

    it('should be configured as inline (for ProseMirror compatibility) and atom', () => {
      const config = MathBlock.config;
      expect(config.group).toBe('inline');
      expect(config.inline).toBe(true);
      expect(config.atom).toBe(true);
    });

    describe('addAttributes', () => {
      it('should define latex attribute with default empty string', () => {
        const attrs = MathBlock.config.addAttributes!.call(MathBlock);
        expect(attrs.latex.default).toBe('');
      });

      it('should parse latex from data-math-latex attribute', () => {
        const attrs = MathBlock.config.addAttributes!.call(MathBlock);
        const element = document.createElement('span');
        element.setAttribute('data-math-latex', '\\frac{a}{b}');
        expect(attrs.latex.parseHTML!(element)).toBe('\\frac{a}{b}');
      });

      it('should parse latex from annotation element', () => {
        const attrs = MathBlock.config.addAttributes!.call(MathBlock);
        const element = document.createElement('span');
        element.classList.add('katex-display');
        const annotation = document.createElement('annotation');
        annotation.setAttribute('encoding', 'application/x-tex');
        annotation.textContent = 'E = mc^2';
        element.appendChild(annotation);
        expect(attrs.latex.parseHTML!(element)).toBe('E = mc^2');
      });

      it('should fall back to textContent', () => {
        const attrs = MathBlock.config.addAttributes!.call(MathBlock);
        const element = document.createElement('span');
        element.textContent = 'plain text';
        expect(attrs.latex.parseHTML!(element)).toBe('plain text');
      });

      it('should return empty object from renderHTML', () => {
        const attrs = MathBlock.config.addAttributes!.call(MathBlock);
        expect(attrs.latex.renderHTML!({})).toEqual({});
      });
    });

    describe('parseHTML', () => {
      it('should match span[data-math-latex][data-math-display]', () => {
        const rules = MathBlock.config.parseHTML!.call(MathBlock);
        expect(rules[0].tag).toBe('span[data-math-latex][data-math-display]');
      });

      it('should match span.katex-display', () => {
        const rules = MathBlock.config.parseHTML!.call(MathBlock);
        expect(rules[1].tag).toBe('span.katex-display');
      });
    });

    describe('renderHTML', () => {
      it('should output span with data-math-latex and data-math-display', () => {
        const renderHTML = MathBlock.config.renderHTML!;
        const result = renderHTML.call(MathBlock, {
          node: { attrs: { latex: '\\sum_{i=1}^n' } } as any,
          HTMLAttributes: {},
        } as any);
        expect(result).toEqual([
          'span',
          { 'data-math-latex': '\\sum_{i=1}^n', 'data-math-display': 'true' },
        ]);
      });
    });

    describe('addNodeView', () => {
      it('should create a span with display:block and rendered KaTeX', () => {
        mockRenderToString.mockReturnValue('<span>display math</span>');
        const nodeViewFactory = MathBlock.config.addNodeView!.call(MathBlock);
        const nodeView = (nodeViewFactory as any)({
          node: { attrs: { latex: '\\int_0^1 f(x) dx' } },
        });
        expect(nodeView.dom.tagName).toBe('SPAN');
        expect(nodeView.dom.style.display).toBe('block');
        expect(nodeView.dom.contentEditable).toBe('false');
        expect(nodeView.dom.innerHTML).toBe('<span>display math</span>');
        expect(mockRenderToString).toHaveBeenCalledWith('\\int_0^1 f(x) dx', {
          throwOnError: false,
          displayMode: true,
          output: 'htmlAndMathml',
        });
      });

      it('should handle KaTeX render failure gracefully', () => {
        mockRenderToString.mockImplementation(() => {
          throw new Error('KaTeX error');
        });
        const nodeViewFactory = MathBlock.config.addNodeView!.call(MathBlock);
        const nodeView = (nodeViewFactory as any)({
          node: { attrs: { latex: 'bad \\cmd' } },
        });
        expect(nodeView.dom.innerHTML).toBe('bad \\cmd');
      });
    });
  });
});
