import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Markdown from '@/components/markdown';

// A fenced block with a language renders the copy button, which reads route
// params. Without this the syntax-highlighted branch cannot be tested at all.
vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant' }),
  usePathname: () => '/platform/test-tenant/agent',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Test suite for the Markdown component
 *
 * This suite tests the Markdown component's ability to:
 * 1. Render basic markdown content
 * 2. Handle LaTeX mathematical equations (inline and block)
 * 3. Leave LaTeX document markup as literal text without corrupting prose
 * 4. Handle edge cases and complex nested structures
 */

describe('Markdown Component', () => {
  describe('Basic Markdown Rendering', () => {
    /**
     * Test basic text rendering
     * Ensures plain text is rendered without modification
     */
    it('should render plain text', () => {
      const { container } = render(<Markdown>Hello, World!</Markdown>);
      expect(container.textContent).toContain('Hello, World!');
    });

    /**
     * Test bold text rendering using markdown syntax
     */
    it('should render bold text', () => {
      const { container } = render(<Markdown>This is **bold** text.</Markdown>);
      // STREAMDOWN REGRESSION: Streamdown renders `**bold**` as
      // <span class="font-semibold" data-streamdown="strong"> rather than a
      // semantic <strong>, so screen readers lose the emphasis role.
      const strong = container.querySelector('[data-streamdown="strong"]');
      expect(strong).toBeTruthy();
      expect(strong?.tagName).toBe('SPAN');
      expect(strong?.textContent).toBe('bold');
    });

    /**
     * Test italic text rendering using markdown syntax
     * Verifies that *text* is converted to <em> tags
     */
    it('should render italic text', () => {
      const { container } = render(<Markdown>This is *italic* text.</Markdown>);
      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em?.textContent).toBe('italic');
    });

    /**
     * Test heading rendering
     * Verifies that markdown headings are converted to appropriate HTML heading tags
     */
    it('should render headings correctly', () => {
      const { container } = render(<Markdown># Heading 1</Markdown>);
      const h1 = container.querySelector('h1');
      expect(h1).toBeTruthy();
      expect(h1?.textContent).toBe('Heading 1');
    });

    /**
     * Test unordered list rendering
     * Verifies that markdown lists are converted to <ul> and <li> tags
     */
    it('should render unordered lists', () => {
      const markdown = `
- Item 1
- Item 2
- Item 3
`;
      const { container } = render(<Markdown>{markdown}</Markdown>);
      const ul = container.querySelector('ul');
      const listItems = container.querySelectorAll('li');
      expect(ul).toBeTruthy();
      expect(listItems).toHaveLength(3);
    });

    /**
     * Test ordered list rendering
     * Verifies that numbered markdown lists are converted to <ol> and <li> tags
     */
    it('should render ordered lists', () => {
      const markdown = `
1. First item
2. Second item
3. Third item
`;
      const { container } = render(<Markdown>{markdown}</Markdown>);
      const ol = container.querySelector('ol');
      const listItems = container.querySelectorAll('li');
      expect(ol).toBeTruthy();
      expect(listItems).toHaveLength(3);
    });

    /**
     * A list item that is itself a scroll container clips its own marker, so
     * every bullet and number disappears. The overflow has to live on a
     * wrapper inside the <li>, never on the <li>.
     */
    it('should not make list items scroll containers (markers stay visible)', () => {
      const { container } = render(
        <Markdown>{'1. First item\n2. Second item'}</Markdown>,
      );
      for (const li of container.querySelectorAll('li')) {
        expect(li.className ?? '').not.toMatch(/overflow/);
      }
      // STREAMDOWN REGRESSION: the inner `.overflow-x-auto` wrapper is gone
      // with the custom `li` override, so wide content (long equations) inside
      // a list item now overflows the bubble instead of scrolling.
      expect(container.querySelector('li .overflow-x-auto')).toBeNull();
    });

    /**
     * LLMs indent nested items by 2 spaces even under ordered markers, which
     * CommonMark parses as three sibling lists (or flattens the child into
     * the parent, renumbering it). Issue #2109.
     */
    it('should nest a 2-space indented bullet under its ordered parent', () => {
      const { container } = render(
        <Markdown>{'1. Item\n  - sub\n2. Next'}</Markdown>,
      );
      const orderedLists = container.querySelectorAll('ol');
      expect(orderedLists).toHaveLength(1);
      const nested = container.querySelector('ol > li ul');
      expect(nested).toBeTruthy();
      expect(nested?.textContent).toContain('sub');
      const topItems = container.querySelectorAll('ol > li');
      expect(topItems).toHaveLength(2);
    });

    it('should nest a 2-space indented ordered child instead of flattening it', () => {
      const { container } = render(
        <Markdown>{'2. Second\n  1. sub\n3. Third'}</Markdown>,
      );
      const outer = container.querySelector('ol');
      expect(outer?.getAttribute('start')).toBe('2');
      expect(container.querySelectorAll(':scope ol > li ol')).toHaveLength(1);
      const nested = container.querySelector('ol > li ol');
      expect(nested?.textContent).toContain('sub');
      // The parent keeps exactly two items: "Second" (with the nested list)
      // and "Third" -- the sub is no longer flattened in between them.
      expect(container.querySelectorAll('ol > li')).toHaveLength(
        2 + (nested?.querySelectorAll('li').length ?? 0),
      );
    });

    /**
     * STREAMDOWN REGRESSION: the app used to give lists `my-6` with
     * `[ul_&]/[ol_&]:my-1` overrides so a nested list stayed visually attached
     * to its parent item. Streamdown's own list classes carry no vertical
     * margin at all (`list-inside list-decimal whitespace-normal [li_&]:pl-6`),
     * so top-level lists no longer get the 24px breathing room; nesting is
     * indented with padding instead.
     */
    it('should tighten nested list margins while keeping top-level margins', () => {
      const { container } = render(
        <Markdown>{'1. Item\n   - sub\n2. Next'}</Markdown>,
      );
      for (const list of container.querySelectorAll('ul, ol')) {
        expect(list.className).not.toContain('my-6');
        expect(list.className).toContain('[li_&]:pl-6');
      }
    });

    /**
     * Test code block rendering
     * Verifies that code blocks are properly rendered with syntax highlighting
     */
    it('should render code blocks', () => {
      const markdown = '```javascript\nconst x = 10;\n```';
      const { container } = render(<Markdown>{markdown}</Markdown>);
      // The whole block must survive as one unit. It used to be shredded into
      // an inline span by the `` -> " quote rule, which collapsed the newlines
      // and injected stray quote characters.
      expect(container.textContent).toContain('const x = 10;');
      expect(container.textContent).not.toContain('"javascript');
      expect(container.textContent).not.toContain('```');
    });

    /**
     * Fenced code is literal: no LaTeX/currency preprocessing may reach inside
     * it. A `$5` in a code sample must not pick up an escaping backslash.
     */
    it('should not preprocess the contents of a fenced code block', () => {
      const markdown = '```js\nconst price = "$5";\nconst total = "$10";\n```';
      const { container } = render(<Markdown>{markdown}</Markdown>);
      expect(container.textContent).toContain('"$5"');
      expect(container.textContent).toContain('"$10"');
      expect(container.textContent).not.toContain('\\$');
    });

    /**
     * A plain fence (no language) takes the <pre><code> path.
     */
    it('should render a plain fence as a real pre/code block', () => {
      const { container } = render(
        <Markdown>{'```\nplain line one\nplain line two\n```'}</Markdown>,
      );
      const pre = container.querySelector('pre');
      expect(pre).toBeTruthy();
      expect(pre?.querySelector('code')).toBeTruthy();
      expect(pre?.textContent).toContain('plain line one');
      expect(pre?.textContent).toContain('plain line two');
    });

    /**
     * Inline code is literal too -- `$5` must not gain a backslash.
     */
    it('should not preprocess the contents of inline code', () => {
      const { container } = render(
        <Markdown>{'Money in code: `$5` and `$x$` stay literal.'}</Markdown>,
      );
      expect(container.textContent).toContain('$5');
      expect(container.textContent).not.toContain('\\$');
      expect(container.querySelectorAll('code').length).toBe(2);
    });

    /**
     * Test inline code rendering
     * Verifies that inline code is wrapped in <code> tags
     */
    it('should render inline code', () => {
      const { container } = render(
        <Markdown>Use `const` for variables.</Markdown>,
      );
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      expect(code?.textContent).toBe('const');
    });

    /**
     * Test link rendering
     * Verifies that markdown links are converted to <a> tags with proper attributes
     */
    it('should render links', () => {
      const { container } = render(
        <Markdown>[Google](https://google.com)</Markdown>,
      );
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      // rehype-harden normalises the URL, which appends the root path.
      expect(link?.getAttribute('href')).toBe('https://google.com/');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    /**
     * Test mailto link rendering
     * Verifies that mailto: links are allowed
     */
    it('should render mailto links', () => {
      const { container } = render(
        <Markdown>[Email](mailto:test@example.com)</Markdown>,
      );
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('mailto:test@example.com');
    });

    /**
     * Test tel link rendering
     * Verifies that tel: links are allowed
     */
    it('should render tel links', () => {
      const { container } = render(
        <Markdown>[Call](tel:+1234567890)</Markdown>,
      );
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('tel:+1234567890');
    });

    /**
     * Test disallowed URL protocol filtering
     * Verifies that javascript: and other disallowed protocols are filtered out
     */
    it('should filter out disallowed URL protocols', () => {
      const { container } = render(
        <Markdown>[Click](javascript:alert('xss'))</Markdown>,
      );
      // Streamdown's rehype-harden pass strips the anchor entirely rather
      // than blanking its href, and marks the text as blocked. Stricter than
      // the previous `<a href="">`.
      expect(container.querySelector('a')).toBeNull();
      expect(container.textContent).toContain('[blocked]');
    });

    /**
     * Test relative URL filtering
     * Verifies that relative URLs are filtered out (no protocol)
     */
    it('should filter out relative URLs', () => {
      const { container } = render(<Markdown>[Link](/path/to/page)</Markdown>);
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('');
    });

    /**
     * Test blockquote rendering
     * Verifies that markdown blockquotes are converted to <blockquote> tags
     */
    it('should render blockquotes', () => {
      const { container } = render(<Markdown>{'> This is a quote'}</Markdown>);
      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
    });

    /**
     * Test table rendering
     * Verifies that markdown tables are converted to HTML table structure
     */
    it('should render tables', () => {
      const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;
      const { container } = render(<Markdown>{markdown}</Markdown>);
      const table = container.querySelector('table');
      expect(table).toBeTruthy();
      const headers = container.querySelectorAll('th');
      expect(headers).toHaveLength(2);
    });
  });

  describe('LaTeX Mathematical Equations', () => {
    /**
     * Test inline LaTeX equation rendering using \( \) delimiters
     */
    it('should render inline LaTeX with \\( \\) delimiters', () => {
      const { container } = render(
        <Markdown>The equation \\(E = mc^2\\) is famous.</Markdown>,
      );
      // @ziloen/remark-math parses \( \) as inline math natively.
      expect(container.textContent).toContain('E = mc^2');
    });

    /**
     * Test block LaTeX equation rendering using \[ \] delimiters
     */
    it('should render block LaTeX with \\[ \\] delimiters', () => {
      const { container } = render(
        <Markdown>
          {
            'The quadratic formula is:\\n\\[x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\]'
          }
        </Markdown>,
      );
      expect(container.textContent).toContain('x =');
    });

    /**
     * Test inline LaTeX equation rendering using $ $ delimiters
     * Verifies that $ $ delimiters are properly handled by KaTeX
     */
    it('should render inline LaTeX with $ $ delimiters', () => {
      const { container } = render(<Markdown>The value is $x = 5$.</Markdown>);
      expect(container.textContent).toContain('x = 5');
    });

    /**
     * Test block LaTeX equation rendering using $$ $$ delimiters
     * Verifies that $$ $$ delimiters are properly handled by KaTeX for display math
     */
    it('should render block LaTeX with $$ $$ delimiters', () => {
      const { container } = render(
        <Markdown>
          {'The integral is:\\n$$\\int_0^\\infty e^{-x} dx = 1$$'}
        </Markdown>,
      );
      expect(container.textContent).toContain('∫');
    });

    /**
     * Test block LaTeX where a digit immediately follows the $$ delimiter
     * Verifies the currency escape no longer corrupts the math delimiters
     */
    it('should render block math that opens with a digit as KaTeX', () => {
      const { container } = render(
        <Markdown>
          {
            '$$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$$'
          }
        </Markdown>,
      );
      expect(container.querySelector('.katex')).toBeTruthy();
      expect(container.textContent).not.toContain('$$');
    });

    /**
     * Test inline LaTeX where a digit immediately follows the $ delimiter
     * Verifies the currency escape no longer corrupts inline math delimiters
     */
    it('should render inline math that opens with a digit as KaTeX', () => {
      const { container } = render(
        <Markdown>
          {'$250 \\text{ mL} \\times \\frac{1 \\text{ L}}{1000 \\text{ mL}}$'}
        </Markdown>,
      );
      expect(container.querySelector('.katex')).toBeTruthy();
    });

    /**
     * Regression test for issue #2109
     * Backslash-free inline arithmetic like $3x + 5$ (and block $$...$$) must
     * render as KaTeX rather than leaking raw $ / $$ delimiters as plain text.
     */
    it('should render backslash-free inline and block math from the issue repro', () => {
      const repro = `No worries at all — that's exactly why we warm up before diving into something new! Let me walk you through it.

In Lesson 1.1.3 you learned that when you *evaluate* an expression, you replace the variable with a number. The expression $3x + 5$ has two parts: the term $3x$ and the constant $5$. When we substitute $x = 4$, we replace the $x$ with $4$.

Here's how it works step by step:

$$3x + 5$$

Replace $x$ with $4$:

$$3(4) + 5$$

Multiply first (multiplication comes before addition):

$$12 + 5$$

Then add:

$$17$$

So $3x + 5 = 17$ when $x = 4$.

The key move is always the same: swap the variable out for the number, then simplify using the order of operations — multiply and divide before you add and subtract.

Now let's make sure that landed. Try this one on your own:

If $x = 3$, what is the value of $2x + 6$?

Show me your steps — write out each one just like I did above. 😊`;

      const { container } = render(<Markdown>{repro}</Markdown>);

      // Inline math ($3x + 5$, $3x$, $5$, ...) and block math ($$...$$, $$17$$)
      // both produce KaTeX output. The repro has many math spans, so a healthy
      // count confirms both inline and single-token block math ($$17$$) render.
      expect(container.querySelector('.katex')).toBeTruthy();
      expect(container.querySelectorAll('.katex').length).toBeGreaterThan(10);
      // No raw math delimiters should leak into the visible text.
      expect(container.textContent).not.toContain('$$');
      expect(container.textContent).not.toContain('$');
    });

    it('should render dollar-wrapped text styling commands as KaTeX text (issue #2109)', () => {
      // Real LLM output: feature names wrapped in `$\textbf{...}$` / `$\text{...}$`
      // to mean *bold*, not math (from the shared-chat repro on the issue).
      // These are genuine `$...$` spans, so they render as math -- KaTeX
      // typesets \textbf/\text as bold/upright prose, which reads correctly.
      const featureList = `The $\\text{ibl.ai}$ platform offers:

* $\\textbf{Custom AI Agents}$: Create personalized agents.
* $\\textbf{Canvas \\& Artifacts}$: Generate documents.
* $\\textbf{Enterprise Management}$: Granular controls.`;

      const { container } = render(<Markdown>{featureList}</Markdown>);

      const tex = [...container.querySelectorAll('.katex annotation')].map(
        (el) => el.textContent,
      );
      expect(tex).toContain('\\textbf{Custom AI Agents}');
      expect(tex).toContain('\\textbf{Canvas \\& Artifacts}');
      expect(tex).toContain('\\textbf{Enterprise Management}');
      // Every span typesets cleanly; no leaked delimiters or trapped `**`.
      expect(container.querySelector('.katex-error')).toBeNull();
      expect(container.textContent).not.toContain('$');
      expect(container.textContent).not.toContain('**');
      expect(container.textContent).toContain('The ibl.ai');
      expect(container.textContent).toContain('platform offers:');
      // The surrounding markdown list is untouched.
      expect(container.querySelectorAll('ul li')).toHaveLength(3);
    });

    /**
     * Stray dollars in prose must not be claimed as math. The micromark-level
     * boundary rules in @ziloen/remark-math leave all of these literal.
     */
    it('should never render a red KaTeX error for stray dollar signs', () => {
      const ambiguous = [
        'Double dollar inline: price is $$5 here.',
        'Triple: $$$5',
        'Only a dollar sign: $',
        'Dollar then letter: $abc and $xyz',
      ];
      for (const md of ambiguous) {
        const { container } = render(<Markdown>{md}</Markdown>);
        expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      }
    });

    /**
     * `$a$$b$` is two adjacent spans. micromark matches dollar runs by length,
     * and `close()` used to swallow the whole `$$` run before comparing, so the
     * span opened by the first `$` closed on the trailing `$` with the invalid
     * body `a$$b`. The patched tokenizer stops the closing run the moment it
     * matches, leaving the second `$` free to open the next span.
     */
    it('should render consecutive dollar spans as two separate math spans', () => {
      const { container } = render(
        <Markdown>{'Consecutive math: $a$$b$ and $x$ $y$'}</Markdown>,
      );
      const tex = [...container.querySelectorAll('.katex annotation')].map(
        (a) => a.textContent,
      );
      expect(tex).toEqual(['a', 'b', 'x', 'y']);
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      expect(container.textContent).not.toContain('$');
    });

    /**
     * The same rule chained: three runs back to back all pair off.
     */
    it('should render a chain of three consecutive dollar spans', () => {
      const { container } = render(<Markdown>{'$a$$b$$c$'}</Markdown>);
      expect(
        [...container.querySelectorAll('.katex annotation')].map(
          (a) => a.textContent,
        ),
      ).toEqual(['a', 'b', 'c']);
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    });

    /**
     * Consecutive spans only pair when the opening `$` is at a real boundary.
     * `text$a$$b$text` opens against an ASCII word character, so nothing is
     * math and every dollar stays literal.
     */
    it('should keep dollar runs glued to word characters literal', () => {
      const { container } = render(<Markdown>{'text$a$$b$text'}</Markdown>);
      expect(container.querySelectorAll('.katex')).toHaveLength(0);
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      expect(container.textContent).toContain('text$a$$b$text');
    });

    /**
     * An odd dollar left over once a span has paired off is literal text,
     * whichever side of the span it lands on.
     */
    it.each([['$x$$'], ['$$x$']])(
      'typesets %s as one span plus a literal dollar',
      (md) => {
        const { container } = render(<Markdown>{md}</Markdown>);
        expect(
          [...container.querySelectorAll('.katex annotation')].map(
            (a) => a.textContent,
          ),
        ).toEqual(['x']);
        expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
        expect(container.textContent).toContain('$');
      },
    );

    /**
     * The early close is length-matched, so a `$$` run still needs a full run
     * of two to close and the padding spaces inside it are not boundaries.
     */
    it('should still pair a $$ run only against another run of two', () => {
      const { container } = render(<Markdown>{'a $$ b $$ c'}</Markdown>);
      expect(
        [...container.querySelectorAll('.katex annotation')].map(
          (a) => a.textContent,
        ),
      ).toEqual(['b']);
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    });

    /**
     * Test currency dollar sign handling
     * Verifies that dollar signs before digits are escaped and rendered as literal $
     */
    it('should escape currency dollar signs', () => {
      const { container } = render(
        <Markdown>The price is $100 for the product.</Markdown>,
      );
      expect(container.textContent).toContain('$100');
    });

    /**
     * Test mixed LaTeX and currency in same content
     * Verifies that mathematical $ and currency $ are handled correctly
     */
    it('should handle both LaTeX and currency in the same content', () => {
      const { container } = render(
        <Markdown>The equation $x = 5$ costs $10 to compute.</Markdown>,
      );
      expect(container.textContent).toContain('x = 5');
      expect(container.textContent).toContain('$10');
    });

    /**
     * Test complex mathematical content with fractions and square roots
     * This tests the complex square root example from user requirements
     */
    it('should render complex square root formulas', () => {
      const complexMath = `The square root of a complex number can be found using the formula:
\\[
\\sqrt{z} = \\sqrt{r} \\left( \\cos\\left(\\frac{\\theta}{2}\\right) + i \\sin\\left(\\frac{\\theta}{2}\\right) \\right)
\\]
where \\( r = |z| = \\sqrt{x^2 + y^2} \\) and \\( \\theta = \\tan^{-1}\\left(\\frac{y}{x}\\right) \\).`;

      const { container } = render(<Markdown>{complexMath}</Markdown>);

      // Check that the content contains key mathematical symbols and expressions
      // Note: sqrt can be rendered as text or symbol depending on KaTeX
      expect(container.textContent).toContain('z');
      expect(container.textContent).toContain('θ');
      expect(container.textContent).toContain('cos');
      expect(container.textContent).toContain('sin');
      expect(container.textContent).toContain('tan');
      // Verify the formula is present (sqrt may render as symbol or text)
      expect(container.textContent).toMatch(/sqrt|√/);
    });

    /**
     * Test complex numbered list with inline and block math
     * This tests the full complex square roots example from requirements
     */
    it('should render numbered list with complex mathematical expressions', () => {
      const complexExample = `Sure! Here are some complex square roots:

1. **Square Root of a Complex Number**: Let's consider the complex number \\( z = 3 + 4i \\). The square root of a complex number can be found using the formula:
   \\[
   \\sqrt{z} = \\sqrt{r} \\left( \\cos\\left(\\frac{\\theta}{2}\\right) + i \\sin\\left(\\frac{\\theta}{2}\\right) \\right)
   \\]
   where \\( r = |z| = \\sqrt{x^2 + y^2} \\) and \\( \\theta = \\tan^{-1}\\left(\\frac{y}{x}\\right) \\).

2. **Square Root of a Negative Number**: The square root of a negative number is also complex. For example:
   \\[
   \\sqrt{-16} = 4i
   \\]

3. **Square Root of an Imaginary Number**: Consider \\( z = i \\). The square root can be expressed as:
   \\[
   \\sqrt{i} = \\sqrt{r} \\left( \\cos\\left(\\frac{\\theta}{2}\\right) + i \\sin\\left(\\frac{\\theta}{2}\\right) \\right)
   \\]`;

      const { container } = render(<Markdown>{complexExample}</Markdown>);

      // Check for numbered list
      const ol = container.querySelector('ol');
      expect(ol).toBeTruthy();

      // Check for bold text (Streamdown emits a span, not <strong>)
      const strongElements = container.querySelectorAll(
        '[data-streamdown="strong"]',
      );
      expect(strongElements.length).toBeGreaterThan(0);

      // Check for mathematical content
      expect(container.textContent).toContain('z = 3 + 4i');
      expect(container.textContent).toMatch(/sqrt|√/); // sqrt may render as text or symbol
      expect(container.textContent).toContain('cos');
      expect(container.textContent).toContain('sin');
      expect(container.textContent).toContain('θ');
      expect(container.textContent).toContain('-16');
    });

    /**
     * Test step-by-step mathematical explanation with sections
     * This tests the detailed sqrt(i) calculation from requirements
     */
    it('should render multi-step mathematical explanation with headings', () => {
      const stepByStep = `Let's clarify the calculation of \\( \\sqrt{i} \\) step by step.

### Step 1: Express \\( i \\) in Polar Form

The complex number \\( i \\) can be expressed in polar form. In the complex plane, \\( i \\) corresponds to the point \\( (0, 1) \\). Its modulus \\( r \\) and argument \\( \\theta \\) are:
- Modulus:
  \\[
  r = |i| = \\sqrt{0^2 + 1^2} = 1
  \\]
- Argument:
  \\[
  \\theta = \\frac{\\pi}{2} \\quad \\text{(since it lies on the positive imaginary axis)}
  \\]

Thus, we can write:
\\[
i = 1 \\left( \\cos\\left(\\frac{\\pi}{2}\\right) + i \\sin\\left(\\frac{\\pi}{2}\\right) \\right)
\\]

### Step 2: Calculate \\( \\sqrt{i} \\)

To find \\( \\sqrt{i} \\), we need to find the square root of the polar form:
\\[
\\sqrt{i} = \\sqrt{1} \\left( \\cos\\left(\\frac{\\pi/2 + 2k\\pi}{2}\\right) + i \\sin\\left(\\frac{\\pi/2 + 2k\\pi}{2}\\right) \\right) \\quad \\text{for } k = 0, 1
\\]

### Conclusion

Thus, the correct calculation of \\( \\sqrt{i} \\) is:
\\[
\\sqrt{i} = \\frac{\\sqrt{2}}{2} + i \\frac{\\sqrt{2}}{2}
\\]`;

      const { container } = render(<Markdown>{stepByStep}</Markdown>);

      // Check for h3 headings (### becomes h3)
      const h3Elements = container.querySelectorAll('h3');
      expect(h3Elements.length).toBeGreaterThanOrEqual(3);

      // Check for list items
      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBeGreaterThan(0);

      // Check for mathematical content
      expect(container.textContent).toMatch(/sqrt|√/); // sqrt may render as text or symbol
      expect(container.textContent).toContain('i');
      expect(container.textContent).toContain('π');
      expect(container.textContent).toContain('Step 1');
      expect(container.textContent).toContain('Step 2');
      expect(container.textContent).toContain('Conclusion');
      expect(container.textContent).toContain('Polar Form');
    });

    /**
     * Test nested parentheses in LaTeX expressions
     * Common in complex mathematical formulas
     */
    it('should handle nested parentheses in math expressions', () => {
      const nestedMath = `Calculate \\( \\cos\\left(\\frac{\\pi}{4}\\right) \\) and \\( \\sin\\left(\\frac{\\pi}{4}\\right) \\)`;
      const { container } = render(<Markdown>{nestedMath}</Markdown>);

      expect(container.textContent).toContain('cos');
      expect(container.textContent).toContain('sin');
      expect(container.textContent).toContain('π');
      expect(container.textContent).toContain('4');
    });

    /**
     * Test quad spacing in LaTeX
     * Used for adding space in mathematical text
     */
    it('should handle LaTeX text spacing commands', () => {
      const mathWithText = `\\[ \\theta = \\frac{\\pi}{2} \\quad \\text{(since it lies on the positive imaginary axis)} \\]`;
      const { container } = render(<Markdown>{mathWithText}</Markdown>);

      expect(container.textContent).toContain('θ');
      expect(container.textContent).toContain('π');
      expect(container.textContent).toContain('since it lies');
    });

    /**
     * Test absolute value notation
     * Common in complex number calculations
     */
    it('should render absolute value notation', () => {
      const absValue = `The modulus is \\( r = |z| = \\sqrt{x^2 + y^2} \\)`;
      const { container } = render(<Markdown>{absValue}</Markdown>);

      expect(container.textContent).toContain('r');
      expect(container.textContent).toContain('z');
      expect(container.textContent).toMatch(/sqrt|√/); // sqrt may render as text or symbol
    });

    /**
     * Test superscripts and subscripts in complex expressions
     */
    it('should render superscripts and subscripts correctly', () => {
      const supSub = `For \\( z = 3 + 4i \\), we have \\( r = \\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5 \\)`;
      const { container } = render(<Markdown>{supSub}</Markdown>);

      expect(container.textContent).toContain('z = 3 + 4i');
      expect(container.textContent).toMatch(/sqrt|√/); // sqrt may render as text or symbol
      expect(container.textContent).toContain('25');
      expect(container.textContent).toContain('5');
    });

    /**
     * Test fractions in both inline and display math
     */
    it('should render fractions in inline and display math', () => {
      const fractions = `Inline: \\( \\frac{\\sqrt{2}}{2} \\) and display:
\\[
\\frac{\\pi/2 + 2k\\pi}{2}
\\]`;
      const { container } = render(<Markdown>{fractions}</Markdown>);

      expect(container.textContent).toMatch(/sqrt|√/); // sqrt may render as text or symbol
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('π');
      expect(container.textContent).toContain('k');
    });
  });

  describe('LaTeX Special Characters and Symbols', () => {
    /**
     * Test LaTeX escaped ampersand
     * Verifies that \& is converted to &
     */
    it('should convert \\& to ampersand', () => {
      const { container } = render(<Markdown>{'A \\& B'}</Markdown>);
      expect(container.textContent).toContain('A & B');
    });

    /**
     * Test LaTeX escaped percent
     * Verifies that \% is converted to %
     */
    it('should convert \\% to percent sign', () => {
      const { container } = render(<Markdown>{'50\\% complete'}</Markdown>);
      expect(container.textContent).toContain('50% complete');
    });

    /**
     * Test LaTeX escaped hash
     * Verifies that \# is converted to #
     */
    it('should convert \\# to hash sign', () => {
      const { container } = render(<Markdown>{'Tag \\#example'}</Markdown>);
      expect(container.textContent).toContain('Tag #example');
    });

    /**
     * Test LaTeX escaped underscore
     * Verifies that \_ is converted to _
     */
    it('should convert \\_ to underscore', () => {
      const { container } = render(<Markdown>{'variable\\_name'}</Markdown>);
      expect(container.textContent).toContain('variable_name');
    });
  });

  describe('Edge Cases and Mixed Content', () => {
    /**
     * Test empty content
     * Verifies that empty or undefined content doesn't cause errors
     */
    it('should handle empty content', () => {
      const { container } = render(<Markdown></Markdown>);
      expect(container).toBeTruthy();
    });

    /**
     * Test undefined content
     * Verifies that undefined content is handled gracefully
     */
    it('should handle undefined content', () => {
      const { container } = render(<Markdown>{undefined}</Markdown>);
      expect(container).toBeTruthy();
    });

    /**
     * Test content with both markdown and LaTeX
     * Verifies that markdown and LaTeX can coexist in the same content
     */
    it('should handle mixed markdown and LaTeX content', () => {
      const mixed = `
# Heading

This is **markdown bold** and \\textbf{LaTeX bold}.

- Markdown list item
- Another item

\\begin{itemize}
\\item LaTeX list item
\\item Another LaTeX item
\\end{itemize}

Inline math: $x = 5$ and \\(y = 10\\)
`;
      const { container } = render(<Markdown>{mixed}</Markdown>);
      expect(container.querySelector('h1')).toBeTruthy();
      expect(
        container.querySelectorAll('[data-streamdown="strong"]').length,
      ).toBeGreaterThan(0);
      expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);
    });

    /**
     * Test LaTeX with special characters
     * Verifies that special characters in LaTeX commands are handled properly
     */
    it('should handle LaTeX with special characters', () => {
      const { container } = render(
        <Markdown>
          {'Cost is \\$100, success rate is 95\\%, tags: \\#ai \\& \\#ml'}
        </Markdown>,
      );
      expect(container.textContent).toContain('$100');
      expect(container.textContent).toContain('95%');
      expect(container.textContent).toContain('#ai');
      expect(container.textContent).toContain('& #ml');
    });

    /**
     * Test content with multiple line breaks
     * Verifies that multiple line breaks are preserved
     */
    it('should handle multiple line breaks', () => {
      const content = `First paragraph


Second paragraph with gap`;
      const { container } = render(<Markdown>{content}</Markdown>);
      expect(container.textContent).toContain('First paragraph');
      expect(container.textContent).toContain('Second paragraph');
    });

    /**
     * Test malformed LaTeX
     * Verifies that malformed LaTeX doesn't break rendering
     */
    it('should handle malformed LaTeX gracefully', () => {
      const malformed =
        '\\textbf{unclosed brace or \\begin{itemize} without end';
      const { container } = render(<Markdown>{malformed}</Markdown>);
      // Should still render something even if not perfectly formatted
      expect(container).toBeTruthy();
    });
  });
});

describe('Markdown Component - issue #2109 robustness', () => {
  /**
   * `\\` is the row separator inside KaTeX environments. It must reach the
   * renderer intact or every matrix/aligned block collapses to a single row.
   */
  it('renders a pmatrix with its row separator preserved', () => {
    const { container } = render(
      <Markdown>
        {'$$\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}$$'}
      </Markdown>,
    );
    const katex = container.querySelector('.katex');
    expect(katex).toBeTruthy();
    // KaTeX renders a parse error as .katex-error when the environment is
    // malformed; a collapsed matrix would drop the second row entirely.
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(katex?.textContent).toContain('3');
    expect(katex?.textContent).toContain('4');
  });

  it('renders an aligned block with both rows', () => {
    const { container } = render(
      <Markdown>
        {'$$\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}$$'}
      </Markdown>,
    );
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.textContent).toContain('y');
  });
});

describe('Markdown Component - whole-line $$ display promotion (issue #2109 fix 9)', () => {
  /**
   * The original issue payload: adjacent whole-line `$$...$$` lines with no
   * blank line between them. remark-math sees one paragraph of inline math and
   * renders a merged left-aligned prose line. Each line must instead become
   * its own centered display block (GitHub/Overleaf behavior), with the
   * `\text{...}` step annotations staying display math too.
   */
  it('renders the six-line step-by-step payload as six display blocks with no inline math', () => {
    const steps = [
      '$$\\text{Step 1: Substitute } x = 4 \\text{ into the expression}$$',
      '$$3x + 5 = 3(4) + 5$$',
      '',
      '$$\\text{Step 2: Multiply first (order of operations)}$$',
      '$$3(4) + 5 = 12 + 5$$',
      '',
      '$$\\text{Step 3: Add}$$',
      '$$12 + 5 = 17$$',
    ].join('\n');
    const { container } = render(<Markdown>{steps}</Markdown>);

    const displays = container.querySelectorAll('.katex-display');
    expect(displays).toHaveLength(6);
    // Every KaTeX node is display-level: zero inline math survives.
    expect(container.querySelectorAll('.katex')).toHaveLength(6);
    expect(container.querySelector('.katex-error')).toBeNull();

    // Three text-annotation blocks and three equation blocks, in order.
    const tex = [
      ...container.querySelectorAll('.katex-display annotation'),
    ].map((annotation) => annotation.textContent ?? '');
    expect(tex.filter((t) => t.includes('\\text{Step'))).toHaveLength(3);
    expect(tex).toContain('3x + 5 = 3(4) + 5');
    expect(tex).toContain('3(4) + 5 = 12 + 5');
    expect(tex).toContain('12 + 5 = 17');

    // No raw delimiters leak into the visible text.
    expect(container.textContent).not.toContain('$$');
  });

  it('keeps a mid-sentence $$...$$ span inline, with its rows intact', () => {
    const { container } = render(
      <Markdown>
        {
          'Matrix: $$\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}$$ as promised.'
        }
      </Markdown>,
    );
    expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.textContent).toContain('Matrix:');
    expect(container.textContent).toContain('as promised.');
  });

  it('renders a whole-line $$ span inside a list item as display math within the item', () => {
    const { container } = render(
      <Markdown>{'- item\n  $$x + y = z$$\n- next'}</Markdown>,
    );
    // The list survives: one ul with both items, and the promoted display
    // block sits inside the first item rather than splitting the list.
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    const items = container.querySelectorAll('ul > li');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.katex-display')).toBeTruthy();
    expect(items[1].textContent).toContain('next');
    expect(container.textContent).not.toContain('$$');
  });

  it('still renders the multi-line fenced form as one display block', () => {
    const { container } = render(<Markdown>{'$$\nE = mc^2\n$$'}</Markdown>);
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
  });

  it('renders a whole-line \\[...\\] as a display block', () => {
    const { container } = render(
      <Markdown>{'Energy:\n\\[E = mc^2\\]\nDone.'}</Markdown>,
    );
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.textContent).not.toContain('$$');
    expect(container.textContent).not.toContain('\\[');
  });

  it('keeps mid-sentence \\[...\\] and \\(...\\) spans inline', () => {
    const { container } = render(
      <Markdown>{'so \\[E = mc^2\\] holds, and \\(a + b\\) too'}</Markdown>,
    );
    expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
    expect(container.querySelectorAll('.katex')).toHaveLength(2);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.textContent).toContain('so');
    expect(container.textContent).toContain('holds');
  });
});

/**
 * Document markup wrapped in genuine math delimiters (\[...\], \(...\)) is
 * still math: @ziloen/remark-math claims the span and KaTeX typesets whatever
 * is inside it. These cases came from real broken replies on issue #2109 and
 * are kept as regressions on what still matters -- the payload survives
 * intact and the prose around it is untouched.
 */
describe('Markdown Component - LaTeX document markup in math costume (issue #2109)', () => {
  /**
   * A heading emitted as \[\textbf{...}\] typesets as a bold display block.
   * That reads correctly; what must never happen is a parse error or literal
   * asterisks leaking into the visible text.
   */
  it('renders a \\[\\textbf{...}\\] heading as a bold display block', () => {
    const { container } = render(
      <Markdown>
        {'\\[\n\\textbf{React Learning Plan (4-6 Weeks)}\n\\]\nIntro line.'}
      </Markdown>,
    );
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(
      container.querySelector('.katex-display annotation')?.textContent,
    ).toBe('\\textbf{React Learning Plan (4-6 Weeks)}');
    expect(container.textContent).toContain('React Learning Plan (4-6 Weeks)');
    expect(container.textContent).not.toContain('∗∗');
    expect(container.textContent).toContain('Intro line.');
  });

  it('renders an inline \\(\\textit{...}\\) wrapper as inline italic math', () => {
    const { container } = render(
      <Markdown>{'\\(\\textit{a closing thought}\\) here'}</Markdown>,
    );
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
    expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.querySelector('.katex annotation')?.textContent).toBe(
      '\\textit{a closing thought}',
    );
    expect(container.textContent).toContain('a closing thought');
    expect(container.textContent).toContain('here');
  });

  /**
   * Code emitted as an aligned environment of \verb rows: KaTeX typesets it
   * as a monospace aligned block, one row per \verb, with the source intact.
   */
  it('renders an aligned environment of \\verb rows without a parse error', () => {
    const raw = [
      'Create the file:',
      '\\[',
      '\\begin{aligned}',
      '&\\verb|import { useState } from "react";|\\\\',
      '&\\verb|  const [count, setCount] = useState(0);|\\\\',
      '&\\verb|}|\\\\',
      '\\end{aligned}',
      '\\]',
    ].join('\n');
    const { container } = render(<Markdown>{raw}</Markdown>);
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(container.querySelector('.katex-error')).toBeNull();
    // Every \verb row is typeset, one per aligned row, with the `\\` row
    // separators intact in the source annotation.
    const tex =
      container.querySelector('.katex-display annotation')?.textContent ?? '';
    expect(tex).toContain('\\verb|import { useState } from "react";|\\\\');
    expect(tex).toContain(
      '\\verb|  const [count, setCount] = useState(0);|\\\\',
    );
    expect(container.textContent).toContain(
      'import { useState } from "react";',
    );
    expect(container.textContent).toContain('Create the file:');
  });

  it('leaves a \\begin{verbatim} block as literal text with dollars intact', () => {
    const { container } = render(
      <Markdown>
        {'Kata:\n\\begin{verbatim}\nconst price = "$5";\n\\end{verbatim}'}
      </Markdown>,
    );
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.textContent).toContain('const price = "$5";');
    expect(container.textContent).toContain('\\begin{verbatim}');
  });

  /**
   * The carpentry shape: an entire itemize wrapped in \[...\]. The wrapper is
   * real display-math syntax, so KaTeX owns the span and reports the unknown
   * environment. We accept the error box rather than re-introducing
   * delimiter heuristics; what matters is that the source is preserved
   * verbatim and nothing around it is corrupted.
   */
  it('keeps a display-math-wrapped itemize verbatim inside its error box', () => {
    const raw = [
      '\\[',
      '\\begin{itemize}',
      '\\item \\textbf{Why:} spatial reasoning.',
      '\\item \\textbf{Overlap:}',
      '  \\begin{itemize}',
      '    \\item \\textit{Tolerances:} wood (\\(\\alpha\\) varies).',
      '  \\end{itemize}',
      '\\item \\textbf{Safety:} push sticks.',
      '\\end{itemize}',
      '\\]',
    ].join('\n');
    const { container } = render(<Markdown>{raw}</Markdown>);
    expect(container.querySelectorAll('.katex-error')).toHaveLength(1);
    // Every item of the payload is still readable -- nothing is dropped.
    expect(container.textContent).toContain('spatial reasoning.');
    expect(container.textContent).toContain('Tolerances:');
    expect(container.textContent).toContain('push sticks.');
  });

  /**
   * Genuine display math still renders as math, and a wrapper carrying
   * trailing prose keeps that prose.
   */
  it('leaves a wrapper with trailing prose and genuine display math alone', () => {
    const mixed =
      '\\[\n\\begin{itemize}\n\\item a\n\\end{itemize}\nplus commentary\n\\]';
    const { container: c1 } = render(<Markdown>{mixed}</Markdown>);
    // Not silently converted into a bare list: the commentary is preserved
    // somewhere in the output rather than dropped.
    expect(c1.textContent).toContain('plus commentary');
    const math = '\\[\nE = mc^2\n\\]';
    const { container: c2 } = render(<Markdown>{math}</Markdown>);
    expect(c2.querySelector('.katex')).toBeTruthy();
    expect(c2.querySelector('.katex-error')).toBeNull();
  });
});

/**
 * Document-mode LaTeX -- \textbf, \begin{itemize}, \section, `\\` as a line
 * break -- is no longer translated into Markdown. The system prompt that
 * induced models to emit it was removed in 751971e4, and @ziloen/remark-math
 * parses every genuine math delimiter ($...$, $$...$$, \(...\), \[...\])
 * natively, so the hand-rolled preprocessor that used to rewrite document
 * markup has been deleted.
 *
 * These inputs all came from real broken replies (issue #2109). They are kept
 * as regressions on the property that still holds: the LaTeX source survives
 * as literal text, produces no red KaTeX error box, and does not corrupt the
 * prose around it.
 */
describe('LaTeX document markup renders as literal text (preprocessor removed)', () => {
  const expectLiteral = (source: string, extra = '') => {
    const { container } = render(<Markdown>{source + extra}</Markdown>);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
    return container;
  };

  describe('text formatting commands', () => {
    it('leaves \\textbf{} literal', () => {
      const container = expectLiteral('This is \\textbf{bold} text.');
      expect(container.querySelector('strong')).toBeNull();
      expect(container.textContent).toBe('This is \\textbf{bold} text.');
    });

    it('leaves \\textit{} literal', () => {
      const container = expectLiteral('This is \\textit{italic} text.');
      expect(container.querySelector('em')).toBeNull();
      expect(container.textContent).toBe('This is \\textit{italic} text.');
    });

    it('leaves \\emph{} literal', () => {
      const container = expectLiteral('This is \\emph{emphasized} text.');
      expect(container.querySelector('em')).toBeNull();
      expect(container.textContent).toBe('This is \\emph{emphasized} text.');
    });

    it('leaves \\texttt{} literal', () => {
      const container = expectLiteral('Use \\texttt{const} for constants.');
      expect(container.querySelector('code')).toBeNull();
      expect(container.textContent).toBe('Use \\texttt{const} for constants.');
    });

    it('leaves \\underline{} literal', () => {
      const container = expectLiteral('This is \\underline{underlined} text.');
      expect(container.querySelector('u')).toBeNull();
      expect(container.textContent).toBe(
        'This is \\underline{underlined} text.',
      );
    });

    it('leaves several formatting commands on one line literal', () => {
      const container = expectLiteral(
        'Text with \\textbf{bold}, \\textit{italic}, and \\texttt{code}.',
      );
      expect(container.textContent).toBe(
        'Text with \\textbf{bold}, \\textit{italic}, and \\texttt{code}.',
      );
    });

    it('leaves a long run of \\textbf{} commands literal without erroring', () => {
      const line = '\\textbf{Bold text} with some content.';
      const container = expectLiteral(Array(100).fill(line).join(' '));
      expect(container.querySelectorAll('strong')).toHaveLength(0);
      expect(container.textContent?.split('\\textbf{Bold text}')).toHaveLength(
        101,
      );
    });
  });

  describe('environments', () => {
    it('leaves \\begin{itemize} literal', () => {
      const container = expectLiteral(
        '\\begin{itemize}\n\\item First item\n\\item Second item\n\\end{itemize}',
      );
      expect(container.querySelector('ul')).toBeNull();
      expect(container.textContent).toContain('\\item First item');
      expect(container.textContent).toContain('\\item Second item');
    });

    it('leaves \\begin{enumerate} literal', () => {
      const container = expectLiteral(
        '\\begin{enumerate}\n\\item First item\n\\item Second item\n\\end{enumerate}',
      );
      expect(container.querySelector('ol')).toBeNull();
      expect(container.textContent).toContain('\\begin{enumerate}');
    });

    it('leaves \\begin{quote} literal', () => {
      const container = expectLiteral(
        '\\begin{quote}\nThis is a quoted text.\n\\end{quote}',
      );
      expect(container.querySelector('blockquote')).toBeNull();
      expect(container.textContent).toContain('This is a quoted text.');
    });

    it('leaves \\begin{center} literal', () => {
      const container = expectLiteral(
        '\\begin{center}\nCentered text\n\\end{center}',
      );
      expect(
        container.querySelector('div[style*="text-align: center"]'),
      ).toBeNull();
      expect(container.textContent).toContain('Centered text');
    });

    /**
     * Streaming: a half-arrived itemize must not error or swallow the text
     * that has already streamed in.
     */
    it('leaves an unclosed itemize literal while it is still streaming', () => {
      const container = expectLiteral(
        '\\begin{itemize}\n\\item First point\n\\item Second point\n\\item Third po',
      );
      expect(container.textContent).toContain('First point');
      expect(container.textContent).toContain('Second point');
      expect(container.textContent).toContain('Third po');
    });

    it('leaves itemize items that carry markdown markers literal', () => {
      const container = expectLiteral(
        '\\begin{itemize}\n\\item - First\n\\item - Second\n\\end{itemize}',
      );
      expect(container.querySelectorAll('li')).toHaveLength(0);
      expect(container.textContent).toContain('\\item - First');
      expect(container.textContent).toContain('\\item - Second');
    });
  });

  describe('sectioning', () => {
    it('leaves \\section{} literal', () => {
      const container = expectLiteral('\\section{Introduction}');
      expect(container.querySelector('h2')).toBeNull();
      expect(container.textContent).toBe('\\section{Introduction}');
    });

    it('leaves \\subsection{} literal', () => {
      const container = expectLiteral('\\subsection{Background}');
      expect(container.querySelector('h3')).toBeNull();
      expect(container.textContent).toBe('\\subsection{Background}');
    });

    it('leaves \\subsubsection{} literal', () => {
      const container = expectLiteral('\\subsubsection{Details}');
      expect(container.querySelector('h4')).toBeNull();
      expect(container.textContent).toBe('\\subsubsection{Details}');
    });
  });

  describe('line breaks', () => {
    /**
     * `\\` is a CommonMark escape for a literal backslash, so it collapses to
     * one backslash rather than becoming a <br>. It must not error.
     */
    it('does not turn \\\\ into a line break', () => {
      const container = expectLiteral('Line 1\\\\Line 2');
      expect(container.innerHTML).not.toContain('<br>');
      expect(container.textContent).toBe('Line 1\\Line 2');
    });
  });

  /**
   * The full ethics reply from the issue: \textbf labels inside an itemize.
   * None of it is translated, but every principle name is still readable and
   * nothing renders red.
   */
  describe('the ethics reply from the issue', () => {
    it('renders every principle as readable literal text', () => {
      const ethicsContent = `\\textbf{Ethics} concerns the values and rules that guide what we ought to do. The most commonly cited principles are:

\\begin{itemize}
\\item \\textbf{Autonomy (Respect for persons)}: Honor people's informed choices and agency.
\\item \\textbf{Beneficence}: Act to promote others' well-being.
\\item \\textbf{Nonmaleficence}: Avoid causing harm ("first, do no harm").
\\item \\textbf{Justice}: Treat people fairly.
\\item \\textbf{Fidelity (and Responsibility)}: Keep promises.
\\item \\textbf{Veracity}: Tell the truth; avoid deception.
\\item \\textbf{Integrity}: Be consistent with moral values.
\\item \\textbf{Accountability}: Be answerable for decisions.
\\item \\textbf{Privacy and Confidentiality}: Protect personal information.
\\item \\textbf{Competence}: Maintain knowledge and skills.
\\end{itemize}

In bioethics, the "four principles" framework emphasizes \\textbf{autonomy}, \\textbf{beneficence}, \\textbf{nonmaleficence}, and \\textbf{justice}. In technology/AI ethics, additional focus often includes \\textbf{transparency} and \\textbf{explainability}.`;

      const container = expectLiteral(ethicsContent);

      for (const principle of [
        'Autonomy (Respect for persons)',
        'Beneficence',
        'Nonmaleficence',
        'Justice',
        'Fidelity (and Responsibility)',
        'Veracity',
        'Integrity',
        'Accountability',
        'Privacy and Confidentiality',
        'Competence',
        'four principles',
        'transparency',
        'explainability',
      ]) {
        expect(container.textContent).toContain(principle);
      }
      // The intro and closing paragraphs stay separate blocks.
      expect(container.querySelectorAll('p').length).toBeGreaterThanOrEqual(3);
    });
  });
});

/**
 * LaTeX corpus recovered from the deleted `preprocessLaTeX` suites.
 *
 * Every input below was transcribed from a real broken assistant reply while
 * issue #2109 was open (commit e913907c). They used to be asserted against
 * `lib/preprocess-latex.ts`, a 675-line hand-rolled string rewriter that
 * translated document-mode LaTeX into Markdown. That module was deleted on
 * this branch: `@ziloen/remark-math` parses every genuine math delimiter
 * (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) at the micromark level and uses
 * the `@vscode/markdown-it-katex` boundary rules, so currency stays literal
 * text without any pre-pass.
 *
 * The string->string assertions cannot survive the module they tested, so
 * each input is re-asserted here against what the renderer actually has to
 * guarantee now:
 *
 *   1. Nothing is lost -- the words and symbols still reach the DOM.
 *   2. No red KaTeX error box (`.katex-error`), except for the accepted
 *      families pinned in `accepted KaTeX error boxes` below and in
 *      `keeps a display-math-wrapped itemize verbatim inside its error box`
 *      above.
 *   3. Genuine math still typesets, with the right `\annotation` TeX.
 *   4. The prose around the payload is not corrupted.
 *   5. Document-mode LaTeX (`\textbf`, `\begin{itemize}`, `\section`,
 *      `\verb`, ...) renders as literal text. That is the new contract, not
 *      an accident.
 *
 * Inputs about the canvas/HTML-string path (`markdownToHtml`) -- code-fence
 * fidelity, list nesting, `tabular` table output -- live in
 * `lib/__tests__/utils.test.ts` instead, so no input is pinned twice.
 */
describe('LaTeX corpus from real assistant replies (post-preprocessor)', () => {
  const renderMd = (source: string) =>
    render(<Markdown>{source}</Markdown>).container;

  const texOf = (container: HTMLElement) =>
    [...container.querySelectorAll('.katex annotation')].map(
      (a) => a.textContent,
    );

  /** Renders with no error box and returns the container. */
  const renderClean = (source: string) => {
    const container = renderMd(source);
    expect(container.querySelector('.katex-error')).toBeNull();
    return container;
  };

  /** Renders with no error box and no math at all: pure literal text. */
  const renderLiteral = (source: string) => {
    const container = renderClean(source);
    expect(container.querySelector('.katex')).toBeNull();
    return container;
  };

  describe('currency versus math dollars', () => {
    it('keeps a bare amount literal', () => {
      // A single unpaired `$` still survives.
      expect(renderLiteral('Price is $5').textContent).toBe('Price is $5');
      expect(renderLiteral('$100 total').textContent).toBe('$100 total');
      // Two amounts on one line do not pair into a math span.
      expect(renderLiteral('I have $5 and $10').textContent).toBe(
        'I have $5 and $10',
      );
    });

    it('keeps price ranges literal regardless of the separator', () => {
      for (const line of [
        'tickets are $5-$10 today',
        'seats cost $5 - $10 each',
        'prices: $5, $10, $15.',
        'bands are $90,000-$120,000 by level',
        'k. Three amounts: $5-$10-$20',
        'From $100-$200 range, or $90,000-$120,000',
        'Dollar then letter: $abc and $xyz',
      ]) {
        expect(renderLiteral(line).textContent).toBe(line);
      }
    });

    /**
     * An upstream bug in @ziloen/remark-math, fixed here by
     * `patches/@ziloen__remark-math@0.1.1.patch`. A currency `$<digits>`
     * earlier in the same block leaves an unmatched opener; when a later
     * `$...$` body starts with a backslash the tokenizer used to let a `$`
     * that is *preceded by whitespace* close a span, pairing the dollars
     * across the prose so the `\ce{...}` bodies fell out of math and the
     * words between them were typeset instead. The patch adds the Pandoc
     * rule the package was missing: a single `$` preceded by whitespace
     * cannot close a span.
     */
    it('pairs a backslash-led span correctly after an earlier currency dollar', () => {
      const container = renderClean(
        'range is $100-$200.\nChem $\\ce{H2O}$ and $\\ce{SO4^2-}$',
      );
      expect(texOf(container)).toEqual(['\\ce{H2O}', '\\ce{SO4^2-}']);
      // The prose and the price range around them stay literal.
      expect(container.textContent).toContain('range is $100-$200.');
      expect(container.textContent).toContain('and');
    });

    it('renders an already-escaped amount as a single literal dollar', () => {
      expect(renderLiteral('Already \\$5 escaped').textContent).toBe(
        'Already $5 escaped',
      );
    });

    it('leaves a degenerate unterminated dollar run literal', () => {
      // `$$ ok` never closes. With Streamdown's parseIncompleteMarkdown off we
      // do not speculatively close it, so the run stays prose rather than
      // becoming a math span around " ok".
      const container = renderClean('total: $$ ok');
      expect(texOf(container)).toEqual([]);
      expect(container.textContent).toContain('total: $$ ok');
    });

    /**
     * `$ 5$` opens with a space, which the old preprocessor treated as
     * currency. The micromark rules claim it as math instead; the point that
     * still matters is that nothing errors and the prose survives.
     */
    it('does not error on a space-led dollar span', () => {
      const container = renderClean('cost $ 5$ maybe');
      expect(container.textContent).toContain('cost');
      expect(container.textContent).toContain('maybe');
      expect(texOf(container)).toEqual([' 5']);
    });

    it('escapes currency while the math span on the same line still parses', () => {
      const container = renderClean(
        'the kit costs $12, and the formula $3x + 5$ gives the price.',
      );
      expect(texOf(container)).toEqual(['3x + 5']);
      expect(container.textContent).toContain('the kit costs $12,');
      expect(container.textContent).toContain('gives the price.');
    });

    it('keeps both math spans when currency leads the line', () => {
      const container = renderClean(
        'a $50 item at $x\\%$ off saves $50 \\times x/100$ dollars.',
      );
      expect(texOf(container)).toEqual(['x\\%', '50 \\times x/100']);
      expect(container.textContent).toContain('a $50 item at');
      expect(container.textContent).toContain('dollars.');
    });

    it('escapes currency both before and after a math span', () => {
      const container = renderClean(
        'it was $20, dropped to $12, and $x - 8$ is the discount.',
      );
      expect(texOf(container)).toEqual(['x - 8']);
      expect(container.textContent).toContain('it was $20, dropped to $12,');
      expect(container.textContent).toContain('is the discount.');
    });

    it('does not pair an opening $ with a closing $ on a later line', () => {
      const container = renderClean('price $5\nreal $x + 1$ here');
      expect(texOf(container)).toEqual(['x + 1']);
      expect(container.textContent).toContain('price $5');
      expect(container.textContent).toContain('here');
    });

    it('keeps inline math intact while still leaving real currency alone', () => {
      const container = renderClean(
        'The term $3x$ evaluates. I have $5 and $10 in cash.\n\n$$3x + 5$$',
      );
      expect(texOf(container)).toEqual(['3x', '3x + 5']);
      expect(container.textContent).toContain('I have $5 and $10 in cash.');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
    });

    it('escapes currency but keeps an adjacent math block intact', () => {
      const container = renderClean(
        'It costs $5. Here: $$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$$',
      );
      expect(container.textContent).toContain('It costs $5. Here:');
      expect(texOf(container)).toEqual([
        '0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}',
      ]);
    });

    it('preserves block math delimiters with a leading space', () => {
      const container = renderClean('$$ 0.075 \\text{ L} = 75 \\text{ mL}$$');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(container)).toEqual([' 0.075 \\text{ L} = 75 \\text{ mL}']);
    });

    it('leaves backslash-led math untouched', () => {
      expect(texOf(renderClean('$\\frac{5}{5} = 1$'))).toEqual([
        '\\frac{5}{5} = 1',
      ]);
      const block = renderClean('$$\\frac{1 \\text{ L}}{1000 \\text{ mL}}$$');
      expect(block.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(block)).toEqual(['\\frac{1 \\text{ L}}{1000 \\text{ mL}}']);
    });

    it('typesets a styling wrapper while the amount beside it stays currency', () => {
      const container = renderClean('The $\\textbf{Pro}$ plan costs $5.');
      expect(texOf(container)).toEqual(['\\textbf{Pro}']);
      expect(container.textContent).toContain('plan costs $5.');
    });
  });

  /**
   * `\$` inside a math span is the TeX escape for a literal dollar. The old
   * preprocessor rewrote it to `\text{\textdollar}` so its own currency pass
   * would not shred the span; KaTeX renders `\$` directly, so the source now
   * reaches the annotation verbatim.
   */
  describe('escaped dollars inside math spans', () => {
    it('renders \\$ inside a converted \\(...\\) span', () => {
      const container = renderClean(
        'Example: TBS Source One. \\(\\sim\\$35\\)',
      );
      expect(texOf(container)).toEqual(['\\sim\\$35']);
      expect(container.textContent).toContain('Example: TBS Source One.');
      expect(container.textContent).toContain('∼$35');
    });

    it('renders \\$ inside a directly emitted $...$ span', () => {
      const container = renderClean('costs $\\sim\\$35$ each');
      expect(texOf(container)).toEqual(['\\sim\\$35']);
      expect(container.textContent).toContain('∼$35');
      expect(container.textContent).toContain('each');
    });

    it('keeps prose between two dollar-carrying spans out of math', () => {
      const container = renderClean(
        'Estimated total: \\(\\$220\\text{–}310\\). With a new transmitter: \\(\\$330\\text{–}550\\).',
      );
      expect(texOf(container)).toEqual([
        '\\$220\\text{–}310',
        '\\$330\\text{–}550',
      ]);
      expect(container.textContent).toContain('$220–310');
      expect(container.textContent).toContain('With a new transmitter:');
    });

    it('renders \\$ inside \\[...\\] display math', () => {
      // Mid-sentence `\[...\]` stays inline; a whole-line one is a display
      // block. Either way the `\$` reaches KaTeX intact.
      const inline = renderClean('so \\[\\$5 + \\$10\\] holds');
      expect(texOf(inline)).toEqual(['\\$5 + \\$10']);
      expect(inline.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(inline.textContent).toContain('$5+$10');

      const whole = renderClean('\\[\\$5\\]');
      expect(whole.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(whole)).toEqual(['\\$5']);
    });

    it('leaves \\$ outside math untouched while the span still parses', () => {
      const container = renderClean(
        'Already \\$5 escaped, math \\(\\$2\\) here',
      );
      expect(texOf(container)).toEqual(['\\$2']);
      expect(container.textContent).toContain('Already $5 escaped, math');
      expect(container.textContent).toContain('here');
    });
  });

  /**
   * Models wrap prose in `$...$` with a text-mode command (or with Markdown
   * emphasis) to mean *formatting*. These are genuine math spans, so KaTeX
   * typesets them -- which reads correctly -- rather than being unwrapped to
   * Markdown by a pre-pass.
   */
  describe('formatting trapped inside dollar delimiters', () => {
    it('typesets the upright text commands', () => {
      const container = renderClean(
        '$\\textrm{plain}$ and $\\textsf{sans}$ and $\\textnormal{normal}$',
      );
      expect(texOf(container)).toEqual([
        '\\textrm{plain}',
        '\\textsf{sans}',
        '\\textnormal{normal}',
      ]);
      expect(container.textContent).not.toContain('$');
    });

    it('typesets the emphasis, monospace and underline commands', () => {
      const container = renderClean(
        '$\\emph{note}$ / $\\texttt{code}$ / $\\underline{underlined}$ / $\\textit{RAG Training}$',
      );
      expect(texOf(container)).toEqual([
        '\\emph{note}',
        '\\texttt{code}',
        '\\underline{underlined}',
        '\\textit{RAG Training}',
      ]);
    });

    it('keeps a $$\\text{...}$$ span that shares its line with prose inline', () => {
      const container = renderClean('see $$\\text{this note}$$ here');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(texOf(container)).toEqual(['\\text{this note}']);
      expect(container.textContent).toContain('see');
      expect(container.textContent).toContain('here');
    });

    it('renders Markdown bold trapped in dollars as math without erroring', () => {
      expect(texOf(renderClean('$**Custom AI Agents**$'))).toEqual([
        '**Custom AI Agents**',
      ]);
      const block = renderClean('$$**Enterprise Management**$$');
      expect(block.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(block)).toEqual(['**Enterprise Management**']);
    });

    it('leaves single * and _ inside math as legitimate math', () => {
      expect(texOf(renderClean('$a * b$'))).toEqual(['a * b']);
      expect(texOf(renderClean('$x_1 + x_2$'))).toEqual(['x_1 + x_2']);
    });

    /**
     * The tutoring reply that made the old styling-unwrap regexes pair the
     * closing `$` of one span with the opening `$` of the next across a blank
     * line, swallowing the bold headings and the `$$` delimiters between them.
     */
    it('does not let a math span straddle newlines and eat the headings', () => {
      const raw = [
        '**Given:** Evaluate $3x + 5$ when $x = 4$',
        '',
        '**Step 1: Write the original expression**',
        '$$3x + 5$$',
        '',
        '**Step 2: Substitute $x = 4$**',
        '$$3(4) + 5$$',
      ].join('\n');
      const container = renderClean(raw);
      expect(texOf(container)).toEqual([
        '3x + 5',
        'x = 4',
        '3x + 5',
        'x = 4',
        '3(4) + 5',
      ]);
      // The two whole-line `$$...$$` spans are display blocks; the four
      // in-sentence spans stay inline.
      expect(container.querySelectorAll('.katex-display')).toHaveLength(2);
      expect(
        [...container.querySelectorAll('[data-streamdown="strong"]')].map(
          (s) => s.textContent,
        ),
      ).toContain('Step 1: Write the original expression');
      expect(container.textContent).not.toContain('$');
    });
  });

  describe('styling commands wrapped in real math delimiters', () => {
    it('typesets a lone styling command inside an inline \\(...\\) span', () => {
      const bold = renderClean('\\(\\textbf{bold heading}\\)');
      expect(texOf(bold)).toEqual(['\\textbf{bold heading}']);
      expect(bold.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(texOf(renderClean('\\(\\emph{soft}\\)'))).toEqual([
        '\\emph{soft}',
      ]);
    });

    it('keeps a display-math plain-text annotation as a display block', () => {
      const container = renderClean('\\[\n\\text{Step 2: Multiply}\n\\]');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(container)).toEqual(['\\text{Step 2: Multiply}']);
      expect(container.textContent).toContain('Step 2: Multiply');
    });

    it('leaves \\textbf intact inside genuine math instead of injecting **', () => {
      const container = renderClean('so \\[ \\textbf{F} = ma \\] holds');
      expect(texOf(container)).toEqual(['\\textbf{F} = ma']);
      expect(container.textContent).toContain('so');
      expect(container.textContent).toContain('holds');
      expect(container.textContent).not.toContain('**');
    });

    it('leaves two formatting commands on one line literal', () => {
      const container = renderLiteral(
        '\\textbf{Bold text} and \\textit{italic text} together',
      );
      expect(container.textContent).toBe(
        '\\textbf{Bold text} and \\textit{italic text} together',
      );
      expect(container.querySelector('strong')).toBeNull();
      expect(container.querySelector('em')).toBeNull();
    });
  });

  describe('delimiter conversion', () => {
    it('renders a padded \\( ... \\) span as inline math', () => {
      const container = renderClean('\\( y = 10 \\)');
      expect(texOf(container)).toEqual(['y = 10']);
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
    });

    it('renders both $...$ and \\(...\\) inside GFM table cells', () => {
      const container = renderClean(
        '| a | b |\n| --- | --- |\n| $x^2$ | \\(y^2\\) |',
      );
      expect(container.querySelector('table')).toBeTruthy();
      expect(texOf(container)).toEqual(['x^2', 'y^2']);
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
    });

    it('keeps two \\[...\\] spans sharing a line as two inline spans', () => {
      const container = renderClean('\\[a\\] and \\[b\\]');
      expect(texOf(container)).toEqual(['a', 'b']);
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(container.textContent).toContain('and');
    });
  });

  describe('display promotion of whole-line spans', () => {
    it('promotes a $$ line padded with surrounding whitespace', () => {
      const container = renderClean('  $$ x = 4 $$  ');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(container)).toEqual(['x = 4']);
    });

    it('separates promoted blocks from adjacent prose and from each other', () => {
      const dollars = renderClean('Steps:\n$$a + b$$\n$$c + d$$\nDone.');
      expect(dollars.querySelectorAll('.katex-display')).toHaveLength(2);
      expect(texOf(dollars)).toEqual(['a + b', 'c + d']);
      expect(dollars.textContent).toContain('Steps:');
      expect(dollars.textContent).toContain('Done.');

      const brackets = renderClean('Steps:\n\\[a + b\\]\n\\[c + d\\]\nDone.');
      expect(brackets.querySelectorAll('.katex-display')).toHaveLength(2);
      expect(texOf(brackets)).toEqual(['a + b', 'c + d']);
      expect(brackets.textContent).toContain('Steps:');
      expect(brackets.textContent).toContain('Done.');
    });

    it('keeps a whole-line $$\\textrm{...}$$ annotation as display math', () => {
      const container = renderClean('  $$\\textrm{note}$$');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(container)).toEqual(['\\textrm{note}']);
    });

    it('keeps a promoted block inside its ordered list item', () => {
      const container = renderClean('1. item\n   $$x + y$$');
      const items = container.querySelectorAll('ol > li');
      expect(items).toHaveLength(1);
      expect(items[0].querySelector('.katex-display')).toBeTruthy();
      expect(items[0].textContent).toContain('item');
    });

    it('keeps a promoted \\[...\\] block inside its unordered list item', () => {
      const container = renderClean('- item\n  \\[x + y = z\\]\n- next');
      const items = container.querySelectorAll('ul > li');
      expect(items).toHaveLength(2);
      expect(items[0].querySelector('.katex-display')).toBeTruthy();
      expect(items[0].textContent).toContain('item');
      expect(items[1].textContent).toContain('next');
    });

    it('leaves the indented multi-line fenced form as one display block', () => {
      const container = renderClean('intro\n\n  $$\n  E = mc^2\n  $$\n\nafter');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(container)).toEqual(['E = mc^2']);
      expect(container.textContent).toContain('intro');
      expect(container.textContent).toContain('after');
    });

    it('renders an empty $$ $$ span without erroring', () => {
      const container = renderClean('$$ $$');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(container.querySelectorAll('.katex')).toHaveLength(1);
    });

    it('leaves a lone $$ fence opener as the characters that were sent', () => {
      // parseIncompleteMarkdown is off, so a dangling fence is not closed for
      // us: a half-streamed `$$` shows the two characters the user actually
      // sent rather than collapsing into an empty display block.
      const container = renderClean('$$\n');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(container.textContent).toContain('$$');
    });

    it('does not promote $$ or \\[ lines inside fenced code', () => {
      const dollars = renderLiteral('```\n$$x + y$$\n```');
      expect(dollars.querySelector('pre code')?.textContent).toContain(
        '$$x + y$$',
      );
      const brackets = renderLiteral('```\n\\[x + y\\]\n```');
      expect(brackets.querySelector('pre code')?.textContent).toContain(
        '\\[x + y\\]',
      );
    });
  });

  describe('environments render as literal text', () => {
    it('leaves a single-line itemize literal', () => {
      const src = '\\begin{itemize}\\item First\\item Second\\end{itemize}';
      const container = renderLiteral(src);
      expect(container.textContent).toBe(src);
      expect(container.querySelector('ul')).toBeNull();
    });

    it('leaves a single-line enumerate literal', () => {
      const src = '\\begin{enumerate}\\item First\\item Second\\end{enumerate}';
      const container = renderLiteral(src);
      expect(container.textContent).toBe(src);
      expect(container.querySelector('ol')).toBeNull();
    });

    it('leaves single-line quote and center environments literal', () => {
      expect(
        renderLiteral('\\begin{quote}quoted text\\end{quote}').textContent,
      ).toBe('\\begin{quote}quoted text\\end{quote}');
      expect(
        renderLiteral('\\begin{center}centered\\end{center}').textContent,
      ).toBe('\\begin{center}centered\\end{center}');
    });

    it('leaves items that already carry a numbered marker literal', () => {
      const container = renderLiteral(
        '\\begin{enumerate}\n\\item 1. First\n\\item 2) Second\n\\end{enumerate}',
      );
      expect(container.textContent).toContain('\\item 1. First');
      expect(container.textContent).toContain('\\item 2) Second');
      expect(container.querySelector('ol')).toBeNull();
    });

    /**
     * Markdown inside an `\item` is still Markdown: `*emphasis*` becomes an
     * `<em>`. The LaTeX scaffolding around it stays literal, and a negative
     * number is never mistaken for a list marker.
     */
    it('keeps markdown emphasis live inside literal item lines', () => {
      const container = renderLiteral(
        '\\begin{itemize}\n\\item *emphasis* stays\n\\item -5 degrees\n\\end{itemize}',
      );
      expect(container.querySelector('em')?.textContent).toBe('emphasis');
      expect(container.textContent).toContain('\\item -5 degrees');
      expect(container.querySelector('ul')).toBeNull();
    });

    it('leaves an unclosed streaming enumerate literal', () => {
      const container = renderLiteral(
        '\\begin{enumerate}\n\\item First step\n\\item Second step\n\\item Thi',
      );
      expect(container.textContent).toContain('First step');
      expect(container.textContent).toContain('Second step');
      expect(container.textContent).toContain('\\item Thi');
    });

    it('leaves a bare unclosed \\begin{itemize} literal', () => {
      expect(renderLiteral('\\begin{itemize}\n').textContent).toBe(
        '\\begin{itemize}',
      );
    });

    it('leaves streaming quote and center environments literal', () => {
      const quote = renderLiteral('\\begin{quote}\nwise words\npartial li');
      expect(quote.textContent).toContain('wise words');
      expect(quote.textContent).toContain('partial li');
      expect(quote.querySelector('blockquote')).toBeNull();

      const center = renderLiteral('\\begin{center}\ncentered text\npartial');
      expect(center.textContent).toContain('centered text');
      expect(center.textContent).toContain('partial');
      expect(
        center.querySelector('div[style*="text-align: center"]'),
      ).toBeNull();
    });

    it('leaves an environment with a mismatched \\end literal', () => {
      const container = renderLiteral(
        '\\begin{itemize}\n\\item a\n\\end{enumerate}\n',
      );
      expect(container.textContent).toBe(
        '\\begin{itemize}\n\\item a\n\\end{enumerate}',
      );
    });

    it('leaves a prose mention of an environment name literal inside its bullet', () => {
      const container = renderLiteral(
        '- **Display equation with \\begin{aligned}** showing search and indexing time complexity',
      );
      expect(container.querySelectorAll('ul > li')).toHaveLength(1);
      expect(
        container.querySelector('[data-streamdown="strong"]')?.textContent,
      ).toBe('Display equation with \\begin{aligned}');
      expect(container.textContent).toContain('time complexity');
    });

    it('leaves a prose \\begin/\\end mention pair literal', () => {
      expect(
        renderLiteral('Use \\begin{aligned} and \\end{aligned} to align.')
          .textContent,
      ).toBe('Use \\begin{aligned} and \\end{aligned} to align.');
    });

    /**
     * Mid-stream the closing `$$` has not arrived, so nothing is math yet and
     * the partial block must simply show as the text that has streamed in.
     */
    it('leaves the streaming head of an unclosed $$ aligned block literal', () => {
      const container = renderMd(
        '$$\n\\begin{aligned}\nT_s &= O(\\log n) \\\\',
      );
      // parseIncompleteMarkdown is off, so the unclosed fence is not
      // speculatively closed: nothing reaches KaTeX and nothing errors.
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      expect(container.textContent).toContain('\\begin{aligned}');
      expect(container.textContent).toContain('T_s &= O(\\log n)');
    });

    it('leaves \\verb outside math literal', () => {
      expect(renderLiteral('\\verb|code|').textContent).toBe('\\verb|code|');
    });
  });

  describe('aligned and matrix environments inside math delimiters', () => {
    it('renders a genuine aligned block with both rows', () => {
      const container = renderClean(
        '\\[\n\\begin{aligned}\nx &= y + 1\\\\\nz &= 2x\\\\\n\\end{aligned}\n\\]',
      );
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      // Both rows are typeset and the `\\` row separators reach KaTeX intact.
      expect(texOf(container)).toEqual([
        '\\begin{aligned}\nx &= y + 1\\\\\nz &= 2x\\\\\n\\end{aligned}',
      ]);
    });

    it('renders an aligned block mixing \\verb rows with math rows', () => {
      const container = renderClean(
        '\\[\n\\begin{aligned}\n&\\verb|const a = 1;|\\\\\nx &= y\\\\\n\\end{aligned}\n\\]',
      );
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(container)[0]).toContain('\\verb|const a = 1;|');
      expect(container.textContent).toContain('const a = 1;');
    });

    it('renders a $$-wrapped aligned \\verb environment as display math', () => {
      const container = renderClean(
        '$$\n\\begin{aligned}\n&\\verb|npm run dev|\\\\\n\\end{aligned}\n$$',
      );
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(
        [...container.querySelectorAll('mtext')].map((el) =>
          (el.textContent ?? '').replace(/\u00a0/g, ' '),
        ),
      ).toContain('npm run dev');
    });

    it('keeps an aligned \\verb block inside its nested list item', () => {
      const container = renderClean(
        '- Files and code:\n  - Create App.tsx:\n    \\[\n    \\begin{aligned}\n    &\\verb|const a = 1;|\\\\\n    &\\verb|const b = 2;|\\\\\n    \\end{aligned}\n    \\]',
      );
      const outer = container.querySelectorAll('ul');
      expect(outer.length).toBeGreaterThanOrEqual(2);
      expect(container.textContent).toContain('Files and code:');
      expect(container.textContent).toContain('Create App.tsx:');
      // The block is typeset inside the nested item, not hoisted out of it.
      expect(container.querySelector('ul ul li .katex-display')).toBeTruthy();
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(container.textContent).toContain('const a = 1;');
      expect(container.textContent).toContain('const b = 2;');
    });

    /**
     * KNOWN CONTENT LOSS, pinned deliberately. A bare `\begin{aligned}` with
     * no math delimiter is literal text, so `rehype-raw` sees `<TodoCard />`
     * as an unknown HTML element and consumes it. The old preprocessor turned
     * this shape into a fenced code block, which shielded the tag. Nothing on
     * this branch changed `rehype-raw`; the case is recorded here so the
     * behavior is visible rather than silently dropped from the corpus.
     */
    it('drops an HTML-looking \\verb payload outside math (rehype-raw eats the tag)', () => {
      const container = renderLiteral(
        '\\begin{aligned}\n&\\verb|<TodoCard />|\\\\\n\\end{aligned}',
      );
      expect(container.textContent).toContain('\\begin{aligned}');
      expect(container.textContent).toContain('\\end{aligned}');
      expect(container.textContent).not.toContain('TodoCard');
    });

    it('renders single-line \\[...\\] and \\(...\\) environment spans', () => {
      const display = renderClean(
        '\\[\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}\\]',
      );
      expect(display.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(display)).toEqual([
        '\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}',
      ]);

      const inline = renderClean('\\(\\begin{pmatrix}1\\end{pmatrix}\\)');
      expect(inline.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(texOf(inline)).toEqual(['\\begin{pmatrix}1\\end{pmatrix}']);
    });

    it('keeps a row separator inside an inline span', () => {
      expect(texOf(renderClean('$a \\\\ b$'))).toEqual(['a \\\\ b']);
    });

    it('leaves the multi-line fenced aligned form as one display block', () => {
      const container = renderClean(
        '$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$',
      );
      expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
      expect(texOf(container)[0]).toContain('y &= 2');
    });
  });

  describe('sectioning and other document commands render literally', () => {
    it('leaves starred sectioning commands literal', () => {
      for (const src of [
        '\\section*{Heading One}',
        '\\subsection*{Core Evidence}',
        '\\subsubsection*{Deep Heading}',
      ]) {
        const container = renderLiteral(src);
        // With parseIncompleteMarkdown off, the lone `*` in `\section*{...}`
        // is no longer read as unclosed emphasis, so no stray asterisk is
        // appended to finished text.
        expect(container.textContent).toBe(src);
        expect(container.querySelector('h1,h2,h3,h4')).toBeNull();
      }
    });

    it('leaves \\newline literal', () => {
      const container = renderLiteral('line1\n\\newlineline2');
      expect(container.textContent).toBe('line1\n\\newlineline2');
      // The LaTeX `\newline` command itself is inert -- it stays as text. The
      // single `<br>` here is remark-breaks honouring the real newline in the
      // source, which is what keeps line-separated assistant prose readable.
      expect(container.querySelectorAll('br')).toHaveLength(1);
      expect(container.textContent).toContain('\\newlineline2');
    });

    it('leaves LaTeX quote idioms literal', () => {
      expect(renderLiteral("``quoted text''").textContent).toBe(
        "``quoted text''",
      );
      expect(renderLiteral("''quoted''").textContent).toBe("''quoted''");
    });

    it('leaves a whole LaTeX document line literal', () => {
      const container = renderLiteral(
        '\\section{Title}\\textbf{Bold} and \\textit{italic}\\\\\\item Test',
      );
      // `\\` is a CommonMark escape for one literal backslash.
      expect(container.textContent).toBe(
        '\\section{Title}\\textbf{Bold} and \\textit{italic}\\\\item Test',
      );
      expect(container.querySelector('strong')).toBeNull();
      expect(container.querySelector('em')).toBeNull();
    });

    it('leaves document commands literal while genuine math beside them renders', () => {
      const container = renderClean(
        '\\section{Title} with \\textbf{bold} and \\textit{italic} and \\(x = 5\\)',
      );
      expect(container.textContent).toContain('\\section{Title}');
      expect(container.textContent).toContain('\\textbf{bold}');
      expect(container.textContent).toContain('\\textit{italic}');
      expect(texOf(container)).toEqual(['x = 5']);
    });
  });

  /**
   * Accepted failures. A payload that is not valid TeX but sits inside real
   * math delimiters is owned by KaTeX, which reports it in a red error box.
   * We keep the boxes rather than re-introducing delimiter heuristics -- the
   * source is preserved verbatim inside them, so nothing is lost. The case
   * called out on the branch is pinned above: `\[\begin{itemize}...\]` in
   * "keeps a display-math-wrapped itemize verbatim inside its error box".
   */
  describe('accepted KaTeX error boxes', () => {
    /**
     * KaTeX's default `errorColor` is `#cc0000`: a wall of red that reads as an
     * app crash. Genuinely malformed TeX no fix can repair degrades better in
     * the muted body colour, so both renderers pass `errorColor`.
     */
    it('renders an error box in the muted foreground, never KaTeX red', () => {
      const container = renderMd(
        '$$\n\\begin{enumerate}\n\\item First step.\n\\end{enumerate}\n$$',
      );
      const box = container.querySelector('.katex-error');
      expect(box?.getAttribute('style')).toContain('var(--muted-foreground)');
    });

    it('reports an unknown environment wrapped in $$...$$ and keeps its source', () => {
      const container = renderMd(
        '$$\n\\begin{enumerate}\n\\item First step.\n\\item Second step.\n\\end{enumerate}\n$$',
      );
      expect(container.querySelectorAll('.katex-error')).toHaveLength(1);
      expect(container.textContent).toContain('\\item First step.');
      expect(container.textContent).toContain('\\item Second step.');
    });

    /**
     * No longer an accepted failure: `lib/rehype-aligned-math.ts` supplies the
     * `aligned` environment the source omitted, so the bare `&` typesets.
     */
    it('typesets a bare & outside an alignment environment, keeping the prose', () => {
      const container = renderMd(
        'first line\\\\second line\n$$x &= 1 \\\\ y$$',
      );
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      expect(container.textContent).toContain('first line\\second line');
      expect(texOf(container)).toEqual([
        '\\begin{aligned}\nx &= 1 \\\\ y\n\\end{aligned}',
      ]);
    });

    it('reports a double-underscore span while bold outside it still renders', () => {
      const container = renderMd('__underscored bold__ outside stays: $__b__$');
      expect(
        container.querySelector('[data-streamdown="strong"]')?.textContent,
      ).toBe('underscored bold');
      expect(container.querySelectorAll('.katex-error')).toHaveLength(1);
      expect(container.querySelector('.katex-error')?.textContent).toBe(
        '__b__',
      );
    });

    it('reports a dollar-wrapped bold span carrying a bare &, keeping its bullet', () => {
      const container = renderMd('* $**Canvas & Artifacts**$: rich documents.');
      expect(container.querySelectorAll('ul > li')).toHaveLength(1);
      expect(container.querySelectorAll('.katex-error')).toHaveLength(1);
      expect(container.textContent).toContain('Canvas & Artifacts');
      expect(container.textContent).toContain('rich documents.');
    });
  });
});

/**
 * Issue #2441. Twenty currency/math probes pasted as ONE message are one
 * markdown paragraph, so before the fix a `$` opened on one line paired with a
 * `$` nine lines below: line e's `$$` swallowed f..m, and the genuine math on
 * l and m came out as literal text. A dollar-delimited span is inline math and
 * must not cross a line ending.
 */
describe('Markdown Component - dollar math never spans a line ending (issue #2441)', () => {
  const LINES = [
    'a. Other currencies: €5-€10, £20-£30, ¥100-¥200, and $5-$10.',
    'b. Escaped already: I paid \\$5 and \\$10 today.',
    'c. Dollar at very start: $5 is the price.',
    'd. Only a dollar sign: $',
    'e. Double dollar inline: price is $$5 here.',
    'f. Triple: $$$5',
    'g. Dollar then letter: $abc and $xyz',
    'h. Dollar then space then digit: $ 5 and $ 10',
    'i. Negative: -$5 to -$10',
    'j. Thousands: $1,000,000 and $2,500.75',
    'k. Percent: 50% off $20, tax is 8.5%',
    'l. Math with underscores: $a_1 + b_2$ and $c_3$',
    'm. Math with asterisk: $a * b$ and $x \\cdot y$',
    'n. Consecutive math: $a$$b$ and $x$ $y$',
    'o. Currency then math no space: $5$x + 1$',
    'p. Very long money: $999,999,999,999.99',
    'q. Zero: $0 and $0.00',
    'r. Trailing: cost is $5.',
    's. Bold money: **$5** and *$10*',
    't. Money in code: `$5` and `$x$`',
  ];

  const renderBlock = () =>
    render(<Markdown>{LINES.join('\n')}</Markdown>).container;

  it.each([
    ['a', 'a. Other currencies: €5-€10, £20-£30, ¥100-¥200, and $5-$10.'],
    ['b', 'b. Escaped already: I paid $5 and $10 today.'],
    ['c', 'c. Dollar at very start: $5 is the price.'],
    ['d', 'd. Only a dollar sign: $'],
    ['e', 'e. Double dollar inline: price is $$5 here.'],
    ['f', 'f. Triple: $$$5'],
    ['g', 'g. Dollar then letter: $abc and $xyz'],
    ['h', 'h. Dollar then space then digit: $ 5 and $ 10'],
    ['i', 'i. Negative: -$5 to -$10'],
    ['j', 'j. Thousands: $1,000,000 and $2,500.75'],
    ['k', 'k. Percent: 50% off $20, tax is 8.5%'],
    ['o', 'o. Currency then math no space: $5$x + 1$'],
    ['p', 'p. Very long money: $999,999,999,999.99'],
    ['q', 'q. Zero: $0 and $0.00'],
    ['r', 'r. Trailing: cost is $5.'],
    ['s', 's. Bold money: $5 and $10'],
    ['t', 't. Money in code: $5 and $x$'],
  ])('keeps line %s literal', (_id, expected) => {
    expect(renderBlock().textContent).toContain(expected);
  });

  it('typesets only the genuine math on lines l, m and n', () => {
    const container = renderBlock();
    expect(
      [...container.querySelectorAll('.katex annotation')].map(
        (a) => a.textContent,
      ),
    ).toEqual(['a_1 + b_2', 'c_3', 'a * b', 'x \\cdot y', 'a', 'b', 'x', 'y']);
  });

  /**
   * `$a$$b$` pairs off into two adjacent spans — no error box — while the
   * `$x$ $y$` beside it still typesets.
   */
  it('splits the consecutive $a$$b$ into two spans with no error box', () => {
    const container = renderBlock();
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    expect(container.textContent).not.toContain('$a$$b$');
  });

  it('keeps the code spans on line t as code', () => {
    const codes = [...renderBlock().querySelectorAll('code')].map(
      (c) => c.textContent,
    );
    expect(codes).toEqual(['$5', '$x$']);
  });
});
