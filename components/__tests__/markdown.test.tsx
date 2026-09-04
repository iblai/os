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
      // Streamdown's own `strong` is a <span class="font-semibold">, which is
      // neither bold to a screen reader nor a match for the bubble's
      // `[&_strong]:font-bold`; the app overrides it back to the element.
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong?.tagName).toBe('STRONG');
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
      // Wide content (a long equation) scrolls in a wrapper INSIDE the item.
      expect(container.querySelector('li .overflow-x-auto')).not.toBeNull();
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
     * A top-level list gets `my-6` for breathing room; a nested one drops to
     * `my-1` via the `[ul_&]/[ol_&]` variants, so it stays visually attached
     * to its parent item instead of floating 24px away on each side.
     * Streamdown's own list classes carry no vertical margin at all.
     */
    it('should tighten nested list margins while keeping top-level margins', () => {
      const { container } = render(
        <Markdown>{'1. Item\n   - sub\n2. Next'}</Markdown>,
      );
      const top = container.querySelector('ol');
      expect(top?.className).toContain('my-6');
      expect(top?.className).toContain('[ul_&]:my-1');
      const nested = container.querySelector('ol li ul');
      expect(nested?.className).toContain('[ol_&]:my-1');
      // The marker has to sit OUTSIDE the item: `list-inside` puts it in the
      // content box, where the item's block wrapper pushes it onto its own line.
      for (const list of container.querySelectorAll('ul, ol')) {
        expect(list.className).not.toContain('list-inside');
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

    it('unwraps dollar-wrapped text styling commands to real markdown (issue #2109)', () => {
      // Real LLM output: feature names wrapped in `$\textbf{...}$` / `$\text{...}$`
      // to mean *bold*, not math (from the shared-chat repro on the issue).
      // KaTeX typesets them as serif math sitting inside sans-serif prose, and
      // the bold is math-bold rather than a real <strong>, so a span whose
      // whole body is one text command is unwrapped instead.
      const featureList = `The $\\text{ibl.ai}$ platform offers:

* $\\textbf{Custom AI Agents}$: Create personalized agents.
* $\\textbf{Canvas \\& Artifacts}$: Generate documents.
* $\\textbf{Enterprise Management}$: Granular controls.`;

      const { container } = render(<Markdown>{featureList}</Markdown>);

      expect(container.querySelectorAll('.katex')).toHaveLength(0);
      const bold = [...container.querySelectorAll('strong')].map(
        (el) => el.textContent,
      );
      expect(bold).toEqual([
        'Custom AI Agents',
        'Canvas & Artifacts',
        'Enterprise Management',
      ]);
      // Every span resolves cleanly; no leaked delimiters or trapped `**`.
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
      const strongElements = container.querySelectorAll('strong');
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
      expect(container.querySelectorAll('strong').length).toBeGreaterThan(0);
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
   * A heading emitted as \[\textbf{...}\] is a model faking a heading, not a
   * centred equation: KaTeX sets it serif-bold in the middle of sans-serif
   * prose. A display span whose whole body is a STYLING command unwraps to the
   * markdown it means; a plain-text one (`$$\text{Step 2}$$`) is a genuine
   * centred annotation between equations and stays maths.
   */
  it('unwraps a \\[\\textbf{...}\\] heading to real bold prose', () => {
    const { container } = render(
      <Markdown>
        {'\\[\n\\textbf{React Learning Plan (4-6 Weeks)}\n\\]\nIntro line.'}
      </Markdown>,
    );
    expect(container.querySelectorAll('.katex')).toHaveLength(0);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe(
      'React Learning Plan (4-6 Weeks)',
    );
    expect(container.textContent).not.toContain('∗∗');
    expect(container.textContent).toContain('Intro line.');
  });

  it('keeps a \\[\\text{...}\\] annotation as a display block', () => {
    const { container } = render(
      <Markdown>{'\\[\n\\text{Step 2: Multiply first}\n\\]'}</Markdown>,
    );
    expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.querySelector('strong')).toBeNull();
  });

  it('unwraps an inline \\(\\textit{...}\\) wrapper to real emphasis', () => {
    const { container } = render(
      <Markdown>{'\\(\\textit{a closing thought}\\) here'}</Markdown>,
    );
    expect(container.querySelectorAll('.katex')).toHaveLength(0);
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.querySelector('em')?.textContent).toBe(
      'a closing thought',
    );
    expect(container.textContent).toBe('a closing thought here');
  });

  /**
   * Code emitted as an aligned environment of \verb rows: KaTeX typesets it
   * as a monospace aligned block, one row per \verb, with the source intact.
   */
  it('turns an aligned environment of \\verb rows into a code fence', () => {
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
    expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
    expect(container.querySelector('.katex-error')).toBeNull();
    // Every \verb body becomes one line of a bare, monospaced code fence.
    expect(container.querySelector('pre code')?.textContent).toBe(
      [
        'import { useState } from "react";',
        '  const [count, setCount] = useState(0);',
        '}',
      ].join('\n'),
    );
    expect(container.textContent).toContain('Create the file:');
  });

  it('turns a \\begin{verbatim} block into a code fence with dollars intact', () => {
    const { container } = render(
      <Markdown>
        {'Kata:\n\\begin{verbatim}\nconst price = "$5";\n\\end{verbatim}'}
      </Markdown>,
    );
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.querySelector('pre code')?.textContent).toContain(
      'const price = "$5";',
    );
    expect(container.textContent).not.toContain('\\begin{verbatim}');
  });

  /**
   * The carpentry shape: an entire itemize wrapped in \[...\]. A list is never
   * maths, so the wrapper is the model reaching for the delimiters it had been
   * told to use; left to KaTeX it becomes a red "No such environment" box. The
   * island bridge rebuilds the list, nesting and inline maths included.
   */
  it('rebuilds a display-math-wrapped itemize as a real list', () => {
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
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    // Every item of the payload is still readable -- nothing is dropped.
    expect(container.textContent).toContain('spatial reasoning.');
    expect(container.textContent).toContain('Tolerances:');
    expect(container.textContent).toContain('push sticks.');
    // The nesting survives, and the inline math inside an item still typesets.
    expect(container.querySelectorAll('ul')).toHaveLength(2);
    expect(container.querySelectorAll('li')).toHaveLength(4);
    expect(container.querySelector('.katex annotation')?.textContent).toBe(
      '\\alpha',
    );
    expect(container.textContent).not.toContain('\\begin{itemize}');
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
describe('LaTeX document markup (preprocessor removed, island bridge added)', () => {
  const expectLiteral = (source: string, extra = '') => {
    const { container } = render(<Markdown>{source + extra}</Markdown>);
    expect(container.querySelector('.katex')).toBeNull();
    expect(container.querySelector('.katex-error')).toBeNull();
    return container;
  };

  describe('text formatting commands', () => {
    it('converts \\textbf{} to strong', () => {
      const container = expectLiteral('This is \\textbf{bold} text.');
      expect(container.querySelector('strong')?.textContent).toBe('bold');
      expect(container.textContent).toBe('This is bold text.');
    });

    it('converts \\textit{} to em', () => {
      const container = expectLiteral('This is \\textit{italic} text.');
      expect(container.querySelector('em')?.textContent).toBe('italic');
      expect(container.textContent).toBe('This is italic text.');
    });

    it('converts \\emph{} to em', () => {
      const container = expectLiteral('This is \\emph{emphasized} text.');
      expect(container.querySelector('em')?.textContent).toBe('emphasized');
      expect(container.textContent).toBe('This is emphasized text.');
    });

    it('converts \\texttt{} to inline code', () => {
      const container = expectLiteral('Use \\texttt{const} for constants.');
      expect(container.querySelector('code')?.textContent).toBe('const');
      expect(container.textContent).toBe('Use const for constants.');
    });

    it('converts \\underline{} to em', () => {
      // Streamdown's sanitizer drops <u> outright, so an underline rendered as
      // one would lose all marking; emphasis is the nearest surviving mark.
      const container = expectLiteral('This is \\underline{underlined} text.');
      expect(container.querySelector('u')).toBeNull();
      expect(container.querySelector('em')?.textContent).toBe('underlined');
      expect(container.textContent).toBe('This is underlined text.');
    });

    it('converts every handled command in one line of prose', () => {
      const container = expectLiteral(
        'Text with \\textbf{bold}, \\textit{italic}, and \\texttt{code}.',
      );
      expect(container.textContent).toBe('Text with bold, italic, and code.');
    });

    it('leaves the plain-text command family literal in prose', () => {
      // Outside maths `\\text{...}` carries no formatting, so claiming it would
      // rewrite prose that merely names the command.
      const container = expectLiteral('Write \\text{this} verbatim.');
      expect(container.textContent).toBe('Write \\text{this} verbatim.');
    });

    it('converts a long run of \\textbf{} commands without erroring', () => {
      const line = '\\textbf{Bold text} with some content.';
      const container = expectLiteral(Array(100).fill(line).join(' '));
      expect(container.querySelectorAll('strong')).toHaveLength(100);
      expect(container.textContent?.split('Bold text')).toHaveLength(101);
    });
  });

  describe('environments', () => {
    it('converts \\begin{itemize} to a list', () => {
      const container = expectLiteral(
        '\\begin{itemize}\n\\item First item\n\\item Second item\n\\end{itemize}',
      );
      expect(
        [...container.querySelectorAll('ul li')].map((li) =>
          li.textContent?.trim(),
        ),
      ).toEqual(['First item', 'Second item']);
    });

    it('converts \\begin{enumerate} to an ordered list', () => {
      const container = expectLiteral(
        '\\begin{enumerate}\n\\item First item\n\\item Second item\n\\end{enumerate}',
      );
      expect(container.querySelectorAll('ol li')).toHaveLength(2);
      expect(container.textContent).not.toContain('\\begin{enumerate}');
    });

    it('converts \\begin{quote} to a blockquote', () => {
      const container = expectLiteral(
        '\\begin{quote}\nThis is a quoted text.\n\\end{quote}',
      );
      expect(container.querySelector('blockquote')?.textContent).toContain(
        'This is a quoted text.',
      );
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

    it('converts itemize items that carry markdown markers', () => {
      // The environment supplies the marker, so the doubled markdown one is
      // dropped: the reader saw a bullet AND a dash (issue #2441).
      const container = expectLiteral(
        '\\begin{itemize}\n\\item - First\n\\item - Second\n\\end{itemize}',
      );
      const items = [...container.querySelectorAll('li')];
      expect(items).toHaveLength(2);
      expect(items.map((li) => li.textContent)).toEqual(['First', 'Second']);
      expect(container.querySelector('li ul')).toBeNull();
    });
  });

  describe('sectioning', () => {
    it('converts \\section{} to an h2', () => {
      const container = expectLiteral('\\section{Introduction}');
      expect(container.querySelector('h2')?.textContent).toBe('Introduction');
    });

    it('converts \\subsection{} to an h3', () => {
      const container = expectLiteral('\\subsection{Background}');
      expect(container.querySelector('h3')?.textContent).toBe('Background');
    });

    it('converts \\subsubsection{} to an h4', () => {
      const container = expectLiteral('\\subsubsection{Details}');
      expect(container.querySelector('h4')?.textContent).toBe('Details');
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
      // Ten principles, one list item each, with the intro and closing
      // paragraphs still separate blocks around them.
      expect(container.querySelectorAll('ul li')).toHaveLength(10);
      expect(container.querySelectorAll('p')).toHaveLength(2);
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
 *      families pinned in `accepted KaTeX error boxes` below -- an
 *      environment NOTHING implements. `tabular` used to belong there and no
 *      longer does: it is rebuilt as a markdown table.
 *   3. Genuine math still typesets, with the right `\annotation` TeX.
 *   4. The prose around the payload is not corrupted.
 *   5. Document-mode LaTeX (`\textbf`, `\begin{itemize}`, `\section`,
 *      `\verb`, ...) renders as literal text. That is the new contract, not
 *      an accident.
 *
 * Inputs about the canvas/HTML-string path (`markdownToHtml`) -- code-fence
 * fidelity, list nesting, the undelimited `tabular` block -- live in
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

    it('unwraps a styling wrapper while the amount beside it stays currency', () => {
      const container = renderClean('The $\\textbf{Pro}$ plan costs $5.');
      expect(texOf(container)).toEqual([]);
      expect(container.querySelector('strong')?.textContent).toBe('Pro');
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
    it('unwraps the upright text commands to plain prose', () => {
      const container = renderClean(
        '$\\textrm{plain}$ and $\\textsf{sans}$ and $\\textnormal{normal}$',
      );
      expect(texOf(container)).toEqual([]);
      expect(container.textContent).toBe('plain and sans and normal');
    });

    it('unwraps the emphasis, monospace and underline commands', () => {
      const container = renderClean(
        '$\\emph{note}$ / $\\texttt{code}$ / $\\underline{underlined}$ / $\\textit{RAG Training}$',
      );
      expect(texOf(container)).toEqual([]);
      // `\\underline` becomes emphasis: Streamdown's sanitizer drops <u>, so an
      // underline would otherwise lose its marking entirely.
      expect(
        [...container.querySelectorAll('em')].map((e) => e.textContent),
      ).toEqual(['note', 'underlined', 'RAG Training']);
      expect(container.querySelector('code')?.textContent).toBe('code');
    });

    it('keeps a $$\\text{...}$$ span that shares its line with prose inline', () => {
      const container = renderClean('see $$\\text{this note}$$ here');
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(texOf(container)).toEqual(['\\text{this note}']);
      expect(container.textContent).toContain('see');
      expect(container.textContent).toContain('here');
    });

    /**
     * `$**Custom AI Agents**$` is the same mistake as `$\textbf{...}$` in a
     * different dialect: the model reached for bold and wrapped it in the
     * maths delimiters it had been told to use. KaTeX renders the markers as
     * literal stars, so a doubled marker that owns the whole span unwraps to
     * the markdown it means.
     */
    it('unwraps Markdown bold trapped in dollars', () => {
      const bold = (el: HTMLElement) =>
        [...el.querySelectorAll('strong')].map((e) => e.textContent);

      const inline = renderClean('$**Custom AI Agents**$');
      expect(texOf(inline)).toEqual([]);
      expect(bold(inline)).toEqual(['Custom AI Agents']);

      const block = renderClean('$$**Enterprise Management**$$');
      expect(texOf(block)).toEqual([]);
      expect(bold(block)).toEqual(['Enterprise Management']);

      const underscored = renderClean(
        '__underscored bold__ outside stays: $__b__$',
      );
      expect(texOf(underscored)).toEqual([]);
      expect(bold(underscored)).toEqual(['underscored bold', 'b']);
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
        [...container.querySelectorAll('strong')].map((s) => s.textContent),
      ).toContain('Step 1: Write the original expression');
      expect(container.textContent).not.toContain('$');
    });
  });

  describe('styling commands wrapped in real math delimiters', () => {
    it('unwraps a lone styling command inside an inline \\(...\\) span', () => {
      const bold = renderClean('\\(\\textbf{bold heading}\\)');
      expect(texOf(bold)).toEqual([]);
      expect(bold.querySelector('strong')?.textContent).toBe('bold heading');
      expect(
        renderClean('\\(\\emph{soft}\\)').querySelector('em')?.textContent,
      ).toBe('soft');
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

    it('converts two formatting commands on one line', () => {
      const container = renderLiteral(
        '\\textbf{Bold text} and \\textit{italic text} together',
      );
      expect(container.textContent).toBe('Bold text and italic text together');
      expect(container.querySelector('strong')?.textContent).toBe('Bold text');
      expect(container.querySelector('em')?.textContent).toBe('italic text');
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

  describe('environments the island bridge converts', () => {
    it('converts a single-line itemize', () => {
      const container = renderLiteral(
        '\\begin{itemize}\\item First\\item Second\\end{itemize}',
      );
      expect(container.querySelectorAll('ul li')).toHaveLength(2);
      expect(container.textContent).not.toContain('\\item');
    });

    it('converts a single-line enumerate', () => {
      const container = renderLiteral(
        '\\begin{enumerate}\\item First\\item Second\\end{enumerate}',
      );
      expect(container.querySelectorAll('ol li')).toHaveLength(2);
    });

    it('converts a single-line quote but leaves center literal', () => {
      expect(
        renderLiteral('\\begin{quote}quoted text\\end{quote}').querySelector(
          'blockquote',
        )?.textContent,
      ).toContain('quoted text');
      expect(
        renderLiteral('\\begin{center}centered\\end{center}').textContent,
      ).toBe('\\begin{center}centered\\end{center}');
    });

    // Reclassified for issue #2441: the numbering the environment supplies is
    // the only numbering the reader should see, so the doubled markdown one is
    // dropped rather than kept visible.
    it('drops a numbered marker doubled onto the item it converts', () => {
      const container = renderLiteral(
        '\\begin{enumerate}\n\\item 1. First\n\\item 2) Second\n\\end{enumerate}',
      );
      expect(container.querySelectorAll('ol')).toHaveLength(1);
      const items = [...container.querySelectorAll('ol li')];
      expect(items.map((li) => li.textContent)).toEqual(['First', 'Second']);
    });

    /**
     * Markdown inside an `\item` is still Markdown: `*emphasis*` becomes an
     * `<em>`, and it no longer costs the environment its conversion. A
     * negative number is never mistaken for a list marker.
     */
    it('keeps markdown emphasis live inside the items it converts', () => {
      const container = renderLiteral(
        '\\begin{itemize}\n\\item *emphasis* stays\n\\item -5 degrees\n\\end{itemize}',
      );
      expect(container.querySelectorAll('ul li')).toHaveLength(2);
      expect(container.querySelector('em')?.textContent).toBe('emphasis');
      expect(container.textContent).toContain('-5 degrees');
      expect(container.textContent).not.toContain('\\item');
    });

    /**
     * A reply arrives token by token, so the opener and the finished items sit
     * on screen for as long as the model takes to write the rest. Converting
     * only the COMPLETED lines keeps the raw backslashes off screen without
     * closing an environment on the model's behalf: the last line is half a
     * token and stays literal until its newline lands.
     */
    it('converts the completed items of a streaming enumerate', () => {
      const container = renderLiteral(
        '\\begin{enumerate}\n\\item First step\n\\item Second step\n\\item Thi',
      );
      expect(
        [...container.querySelectorAll('ol li')].map((e) => e.textContent),
      ).toEqual(['First step', 'Second step']);
      expect(container.textContent).toContain('\\item Thi');
      expect(container.textContent).not.toContain('\\begin{enumerate}');
    });

    it('shows nothing for a streaming opener with no item yet', () => {
      expect(renderLiteral('\\begin{itemize}\n').textContent).toBe('');
      // Not yet a complete line: there is nothing safe to convert.
      expect(renderLiteral('\\begin{itemize}').textContent).toBe(
        '\\begin{itemize}',
      );
    });

    it('converts a streaming quote but leaves center literal', () => {
      const quote = renderLiteral('\\begin{quote}\nwise words\npartial li');
      expect(quote.querySelector('blockquote')?.textContent).toContain(
        'wise words',
      );
      expect(quote.textContent).toContain('partial li');
      expect(quote.textContent).not.toContain('\\begin{quote}');

      // `center` is an accepted loss whether or not it has closed.
      const center = renderLiteral('\\begin{center}\ncentered text\npartial');
      expect(center.textContent).toContain('\\begin{center}');
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
      expect(container.querySelector('strong')?.textContent).toBe(
        'Display equation with \\begin{aligned}',
      );
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

    it('converts \\verb outside math to inline code', () => {
      const container = renderLiteral('\\verb|code|');
      expect(container.querySelector('code')?.textContent).toBe('code');
      expect(container.textContent).toBe('code');
      // Any non-alphanumeric character is a legal \\verb delimiter.
      expect(
        renderLiteral('run \\verb+npm test+ first').querySelector('code')
          ?.textContent,
      ).toBe('npm test');
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

    it('renders a $$-wrapped aligned \\verb environment as a code fence', () => {
      const container = renderClean(
        '$$\n\\begin{aligned}\n&\\verb|npm run dev|\\\\\n\\end{aligned}\n$$',
      );
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
      expect(container.querySelector('pre code')?.textContent).toBe(
        'npm run dev',
      );
    });

    it('keeps an aligned \\verb code fence inside its nested list item', () => {
      const container = renderClean(
        '- Files and code:\n  - Create App.tsx:\n    \\[\n    \\begin{aligned}\n    &\\verb|const a = 1;|\\\\\n    &\\verb|const b = 2;|\\\\\n    \\end{aligned}\n    \\]',
      );
      const outer = container.querySelectorAll('ul');
      expect(outer.length).toBeGreaterThanOrEqual(2);
      expect(container.textContent).toContain('Files and code:');
      expect(container.textContent).toContain('Create App.tsx:');
      // The block stays inside the nested item, not hoisted out of it.
      expect(container.querySelector('ul ul li pre code')).toBeTruthy();
      expect(container.querySelectorAll('.katex-display')).toHaveLength(0);
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
    it('fences an HTML-looking \\verb payload outside math, tag intact', () => {
      const container = renderLiteral(
        '\\begin{aligned}\n&\\verb|<TodoCard />|\\\\\n\\end{aligned}',
      );
      // Detection runs against the raw source, so the `<TodoCard />` the
      // markdown parser turned into an HTML node no longer hides the island.
      expect(container.querySelector('[data-code-block]')).not.toBeNull();
      expect(container.textContent).toContain('<TodoCard />');
      expect(container.textContent).not.toContain('\\begin{aligned}');
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
    it('converts starred sectioning commands to headings', () => {
      for (const [src, tag, text] of [
        ['\\section*{Heading One}', 'h2', 'Heading One'],
        ['\\subsection*{Core Evidence}', 'h3', 'Core Evidence'],
        ['\\subsubsection*{Deep Heading}', 'h4', 'Deep Heading'],
      ]) {
        const container = renderLiteral(src);
        // With parseIncompleteMarkdown off, the lone `*` in `\section*{...}`
        // is not read as unclosed emphasis, so no stray asterisk survives.
        expect(container.querySelector(tag)?.textContent).toBe(text);
        expect(container.textContent).toBe(text);
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

    it('converts a whole LaTeX document line', () => {
      const container = renderLiteral(
        '\\section{Title}\\textbf{Bold} and \\textit{italic}\\\\\\item Test',
      );
      expect(container.querySelector('h2')?.textContent).toBe('Title');
      // `\\` is a CommonMark escape for one literal backslash, and `\item`
      // outside an environment is not handled, so both stay as they were.
      expect(container.textContent).toBe('Title\nBold and italic\\\\item Test');
    });

    it('converts the inline commands while genuine math beside them renders', () => {
      const container = renderClean(
        '\\section{Title} with \\textbf{bold} and \\textit{italic} and \\(x = 5\\)',
      );
      // The math span no longer costs the paragraph its `\section` island:
      // detection reads the raw source, not the parsed children.
      expect(container.querySelector('h2')?.textContent).toBe('Title');
      expect(container.querySelector('strong')?.textContent).toBe('bold');
      expect(container.querySelector('em')?.textContent).toBe('italic');
      expect(texOf(container)).toEqual(['x = 5']);
    });
  });

  /**
   * Accepted failures. A payload that is not valid TeX but sits inside real
   * math delimiters is owned by KaTeX, which reports it in a red error box.
   * We keep the boxes rather than re-introducing delimiter heuristics -- the
   * source is preserved verbatim inside them, so nothing is lost. What is NOT
   * accepted is a payload that was never maths in the first place: a list or a
   * styling command wrapped in display delimiters is rebuilt as the markdown
   * it means, pinned above in "rebuilds a display-math-wrapped itemize as a
   * real list".
   */
  describe('accepted KaTeX error boxes', () => {
    /**
     * KaTeX's default `errorColor` is `#cc0000`: a wall of red that reads as an
     * app crash. Genuinely malformed TeX no fix can repair degrades better in
     * the muted body colour, so both renderers pass `errorColor`.
     */
    it('renders an error box in the muted foreground, never KaTeX red', () => {
      const container = renderMd('$$\\begin{nosuchenv}A & B\\end{nosuchenv}$$');
      const box = container.querySelector('.katex-error');
      expect(box?.getAttribute('style')).toContain('var(--muted-foreground)');
    });

    /**
     * An environment neither KaTeX nor the island bridge implements degrades
     * to its VISIBLE SOURCE inside the error box rather than vanishing.
     */
    it('reports an unknown environment wrapped in $$...$$ and keeps its source', () => {
      const container = renderMd(
        '$$\n\\begin{nosuchenv}\nName & Age \\\\\nAlice & 30\n\\end{nosuchenv}\n$$',
      );
      expect(container.querySelectorAll('.katex-error')).toHaveLength(1);
      expect(container.textContent).toContain('Name & Age');
      expect(container.textContent).toContain('Alice & 30');
    });

    /**
     * `tabular` used to be one of these: KaTeX has no such environment, so a
     * display block holding one was a red error box. Markdown has a grid, so
     * the island bridge now rebuilds it -- rules dropped, `\text{}` cells
     * unwrapped, `{,}` read as LaTeX's thousands separator, first row header.
     */
    it('rebuilds a display-math-wrapped tabular as a real table', () => {
      const container = renderMd(
        '$$\n\\begin{tabular}{lr}\n\\hline\n\\text{Cases} & \\text{Count} \\\\\n\\hline\n\\text{Yes} & 12{,}500 \\\\\n\\hline\n\\end{tabular}\n$$',
      );
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      expect(container.querySelectorAll('table')).toHaveLength(1);
      expect(
        [...container.querySelectorAll('th')].map((e) => e.textContent),
      ).toEqual(['Cases', 'Count']);
      expect(
        [...container.querySelectorAll('td')].map((e) => e.textContent),
      ).toEqual(['Yes', '12,500']);
      expect(container.textContent).not.toContain('hline');
      expect(container.textContent).not.toContain('$$');
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

    it('unwraps a double-underscore span instead of erroring on it', () => {
      const container = renderMd('__underscored bold__ outside stays: $__b__$');
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      expect(
        [...container.querySelectorAll('strong')].map((e) => e.textContent),
      ).toEqual(['underscored bold', 'b']);
    });

    it('unwraps a dollar-wrapped bold span carrying a bare &, keeping its bullet', () => {
      const container = renderMd('* $**Canvas & Artifacts**$: rich documents.');
      expect(container.querySelectorAll('ul > li')).toHaveLength(1);
      expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
      expect(container.querySelector('strong')?.textContent).toBe(
        'Canvas & Artifacts',
      );
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

/**
 * Issue #2441, chat path. The message a legacy mentor actually sent: three
 * environments whose items carry maths, currency and nesting. Before the fix
 * the island bridge scanned parsed mdast children, so a single `$x = 4$` split
 * the paragraph and left `\begin` and `\end` in different text nodes -- the
 * environment was never seen and every list arrived as literal backslashes.
 * `lib/__tests__/utils.test.ts` pins the same message on the canvas path.
 */
describe('Markdown - environments whose items carry inline markdown (issue #2441)', () => {
  const MESSAGE = [
    'Here is a flat list:',
    '',
    '\\begin{itemize}',
    '\\item First point',
    '\\item Second point with math $x = 4$',
    '\\item Third point costs $5',
    '\\end{itemize}',
    '',
    'Here is a nested list:',
    '',
    '\\begin{itemize}',
    '\\item Outer one',
    '  \\begin{itemize}',
    '  \\item Inner A',
    '  \\item Inner B',
    '  \\end{itemize}',
    '\\item Outer two',
    '\\end{itemize}',
    '',
    'Here is a mixed nested list:',
    '',
    '\\begin{enumerate}',
    '\\item Step one',
    '  \\begin{itemize}',
    '  \\item sub-bullet a',
    '  \\item sub-bullet b',
    '  \\end{itemize}',
    '\\item Step two',
    '\\end{enumerate}',
  ].join('\n');

  const message = () => render(<Markdown>{MESSAGE}</Markdown>).container;

  it('renders all three environments as real lists', () => {
    const container = message();
    // Four <ul>: the flat list, the nested list and its sublist, and the
    // sublist inside the ordered list.
    expect(container.querySelectorAll('ul')).toHaveLength(4);
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(container.querySelectorAll('li')).toHaveLength(11);
    expect(container.textContent).not.toContain('\\begin{');
    expect(container.textContent).not.toContain('\\item');
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
  });

  it('keeps the maths in item two and the currency in item three', () => {
    const container = message();
    expect(
      [...container.querySelectorAll('.katex annotation')].map(
        (a) => a.textContent,
      ),
    ).toEqual(['x = 4']);
    expect(container.textContent).toContain('Third point costs $5');
  });

  it('nests each sublist inside its own item', () => {
    const container = message();
    const [, nested, mixed] = [...container.querySelectorAll('ul, ol')].filter(
      (list) => !list.closest('li'),
    );
    expect(nested.querySelectorAll(':scope > li')).toHaveLength(2);
    expect(
      nested.querySelector(':scope > li')?.querySelectorAll('ul li'),
    ).toHaveLength(2);
    expect(mixed.tagName).toBe('OL');
    expect(mixed.querySelectorAll(':scope > li')).toHaveLength(2);
    expect(
      mixed.querySelector(':scope > li')?.querySelectorAll('ul li'),
    ).toHaveLength(2);
  });

  it('converts items carrying code, bold, bracket math and links', () => {
    const { container } = render(
      <Markdown>
        {[
          '\\begin{itemize}',
          '\\item Run `npm run dev`',
          '\\item A **bold** claim',
          '\\item Solve \\(y = 2\\)',
          '\\item See [the docs](https://example.dev)',
          '\\end{itemize}',
        ].join('\n')}
      </Markdown>,
    );
    expect(container.querySelectorAll('li')).toHaveLength(4);
    expect(container.querySelector('code')?.textContent).toBe('npm run dev');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('a')?.textContent).toBe('the docs');
    expect(container.querySelector('.katex annotation')?.textContent).toBe(
      'y = 2',
    );
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
  });

  it('parses an item body that spans several source lines', () => {
    const { container } = render(
      <Markdown>
        {
          '\\begin{itemize}\n\\item A body that runs on\n  to a second line\n\\item Next\n\\end{itemize}'
        }
      </Markdown>,
    );
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelectorAll('li')[0].textContent).toContain(
      'A body that runs on',
    );
    expect(container.querySelectorAll('li')[0].textContent).toContain(
      'to a second line',
    );
  });

  it('converts two environments in one message without offset drift', () => {
    const { container } = render(
      <Markdown>
        {
          'Before.\n\n\\begin{itemize}\n\\item A $x = 1$\n\\end{itemize}\n\nBetween.\n\n\\begin{enumerate}\n\\item B `code`\n\\end{enumerate}\n\nAfter.'
        }
      </Markdown>,
    );
    expect(
      [...container.querySelectorAll('p')].map((p) => p.textContent),
    ).toEqual(['Before.', 'Between.', 'After.']);
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(container.querySelector('code')?.textContent).toBe('code');
    expect(container.textContent).not.toContain('\\begin{');
  });

  it('keeps the prose that follows an environment with no blank line', () => {
    const { container } = render(
      <Markdown>
        {'\\begin{itemize}\n\\item A\n\\end{itemize}\nProse right after.'}
      </Markdown>,
    );
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('p')?.textContent).toBe(
      'Prose right after.',
    );
  });
});

/**
 * Issue #2441, chat path. Models reach for `$\textbf{...}$` when they mean
 * bold, and KaTeX obliges with serif math-bold set into sans-serif prose. A
 * span whose whole body is one text command is unwrapped to the markdown it
 * meant; a span that merely contains `\text` is real maths and is left alone.
 */
describe('Markdown - text styling wrapped in math delimiters (issue #2441)', () => {
  const MESSAGE = [
    'The $\\text{ibl.ai}$ platform offers:',
    '',
    '* $\\textbf{Custom AI Agents}$: configurable LLMs and tools.',
    '* $\\textbf{Canvas \\& Artifacts}$: rich documents and code.',
    '',
    'Genuine math still works: $0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$, and $5 stays literal.',
  ].join('\n');

  it('unwraps the styling spans and keeps the real maths', () => {
    const { container } = render(<Markdown>{MESSAGE}</Markdown>);
    expect(container.textContent).toContain('The ibl.ai platform offers:');
    expect(
      [...container.querySelectorAll('strong')].map((el) => el.textContent),
    ).toEqual(['Custom AI Agents', 'Canvas & Artifacts']);
    expect(container.textContent).toContain('and $5 stays literal.');
    expect(
      [...container.querySelectorAll('.katex annotation')].map(
        (a) => a.textContent,
      ),
    ).toEqual([
      '0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}',
    ]);
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
  });

  it('leaves a span that merely mentions a text command as maths', () => {
    for (const source of [
      '$\\text{a} + \\text{b}$',
      '$\\textbf{x} + 1$',
      // A display block whose body is a PLAIN-text command is a centred
      // annotation between equations, so it stays maths.
      'see $$\\text{this note}$$ here',
      '$$\\text{Step 2: Multiply first}$$',
    ]) {
      const { container } = render(<Markdown>{source}</Markdown>);
      expect(container.querySelectorAll('.katex')).toHaveLength(1);
      expect(container.querySelector('strong')).toBeNull();
    }
  });

  it('unwraps a styling command wrapped in display delimiters', () => {
    for (const source of ['$$\\textbf{X}$$', 'see $$\\textbf{that}$$ here']) {
      const { container } = render(<Markdown>{source}</Markdown>);
      expect(container.querySelectorAll('.katex')).toHaveLength(0);
      expect(container.querySelector('strong')?.textContent).toBeTruthy();
    }
  });
});

/**
 * Every fenced block gets the code-block chrome, whether or not it declares a
 * language. The decision lives on the `pre` override -- `pre` only ever wraps
 * a block -- so a bare fence, and the code this app recovers from legacy
 * `\begin{verbatim}` and `\verb` LaTeX, gets the same header and copy button a
 * ```bash fence has always had, while inline code keeps its inline styling.
 */
describe('Markdown - code block chrome (issue #2441)', () => {
  const chrome = (source: string) => {
    const { container } = render(<Markdown>{source}</Markdown>);
    return {
      block: container.querySelector('[data-code-block]'),
      label: container.querySelector('[data-testid="code-block-language"]')
        ?.textContent,
      copy: container.querySelector('[data-testid="code-block-copy"]'),
      text: container.textContent ?? '',
      container,
    };
  };

  it('keeps the language label and copy button on a ```bash fence', () => {
    const { block, label, copy } = chrome('```bash\nnpm run dev\n```');
    expect(block).not.toBeNull();
    expect(label).toBe('bash');
    expect(copy).not.toBeNull();
  });

  it('gives a bare fence the chrome with no invented language', () => {
    const { block, label, copy, text } = chrome('```\nnpm run dev\n```');
    expect(block).not.toBeNull();
    expect(label).toBeUndefined();
    expect(copy).not.toBeNull();
    expect(text).toContain('npm run dev');
  });

  it('gives a verbatim environment the chrome, dollars intact', () => {
    const { block, copy, text } = chrome(
      '\\begin{verbatim}\nconst price = "$5";\n\\end{verbatim}',
    );
    expect(block).not.toBeNull();
    expect(copy).not.toBeNull();
    expect(text).toContain('const price = "$5";');
  });

  it('gives a \\verb aligned block the chrome, JSX intact', () => {
    const { block, copy, text } = chrome(
      '\\[\n\\begin{aligned}\n&\\verb|  return <div style={{ gap: 8 }}>|\\\\\n&\\verb|    <TodoCard />|\\\\\n\\end{aligned}\n\\]',
    );
    expect(block).not.toBeNull();
    expect(copy).not.toBeNull();
    expect(text).toContain('return <div style={{ gap: 8 }}>');
    expect(text).toContain('<TodoCard />');
  });

  it('leaves inline code inline', () => {
    const { block, copy, container } = chrome('run `npm run dev` now');
    expect(block).toBeNull();
    expect(copy).toBeNull();
    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelector('code')?.className).toContain('font-mono');
  });

  it('gives a ```latex fence the same chrome as every other fence', () => {
    const { block, copy, label, text } = chrome('```latex\n\\frac{1}{2}\n```');
    expect(block).not.toBeNull();
    expect(copy).not.toBeNull();
    expect(label).toBe('latex');
    expect(text).toContain('\\frac{1}{2}');
  });

  it('leaves a ```latex fence as code, never a list', () => {
    const { block, container, text } = chrome(
      '```latex\n\\begin{itemize}\n    \\item First item\n\\end{itemize}\n```',
    );
    expect(block).not.toBeNull();
    expect(container.querySelector('li')).toBeNull();
    expect(container.querySelector('.katex')).toBeNull();
    expect(text).toContain('\\begin{itemize}');
    expect(text).toContain('\\item First item');
  });
});

/**
 * Streamdown splits a message into independently parsed blocks BEFORE remark
 * runs, and a blank line ends a block. A `\[...\]` or a `\begin{env}` whose
 * body carries one -- a loose list, which is what a model writes when it
 * separates two top-level items -- was torn in two before any plugin could
 * see the pair, so the whole environment reached the reader as literal
 * backslashes. The same message has always rendered correctly through
 * markdownToHtml(), which parses it in one piece; these are the chat path
 * catching up. See lib/latex-aware-blocks.ts.
 */
describe('Markdown - environments a blank line splits (issue #2441)', () => {
  /** The rendered text KaTeX did not put there as its own TeX source. */
  const visibleText = (container: HTMLElement) => {
    const copy = container.cloneNode(true) as HTMLElement;
    copy
      .querySelectorAll('annotation, .katex-mathml')
      .forEach((n) => n.remove());
    return copy.textContent ?? '';
  };

  it('rebuilds a display-wrapped itemize whose items are blank-line separated', () => {
    const { container } = render(
      <Markdown>
        {
          '\\[\n\\begin{itemize}\n  \\item One\n\n  \\item Two\n\\end{itemize}\n\\]'
        }
      </Markdown>,
    );
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(visibleText(container)).not.toMatch(/\\(?:begin|end|item)/);
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
  });

  it('rebuilds a bare itemize whose items are blank-line separated', () => {
    const { container } = render(
      <Markdown>
        {'\\begin{itemize}\n\\item One\n\n\\item Two\n\\end{itemize}'}
      </Markdown>,
    );
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(visibleText(container)).not.toMatch(/\\(?:begin|end|item)/);
  });

  /**
   * The real reply from the "Next F1 Race Date" session: two top-level items
   * separated by a blank line, three levels of nesting, `\textbf{}` in the
   * item labels and `\approx` -- a genuine maths command -- in their bodies,
   * which has to survive the trip out of `\[...\]` as a rendered symbol.
   */
  it('rebuilds the three-deep F1 weekend reply, `\\approx` and all', () => {
    const message = [
      '\\[',
      '\\begin{itemize}',
      '  \\item \\textbf{Standard Grand Prix weekend}',
      '    \\begin{itemize}',
      '      \\item \\textbf{Qualifying:} \\approx 60 minutes total',
      '        \\begin{itemize}',
      '          \\item Q1: 18 minutes, bottom 5 eliminated (20 \u2192 15)',
      '        \\end{itemize}',
      '    \\end{itemize}',
      '',
      '  \\item \\textbf{Sprint weekend format} (at selected events)',
      '    \\begin{itemize}',
      '      \\item \\textbf{Sunday:} Grand Prix race (as above)',
      '    \\end{itemize}',
      '\\end{itemize}',
      '\\]',
    ].join('\n');
    const { container } = render(<Markdown>{message}</Markdown>);
    const text = visibleText(container);
    expect(text).not.toMatch(/\\(?:begin|end|item)/);
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    // The outer list, the two second-level lists and the third-level one.
    expect(container.querySelectorAll('ul')).toHaveLength(4);
    expect(container.querySelectorAll('li')).toHaveLength(5);
    // Both top-level items survive the blank line that used to end the block.
    expect(text).toContain('Standard Grand Prix weekend');
    expect(text).toContain('Sprint weekend format');
    expect(text).toContain('Q1: 18 minutes');
    // `\approx` came out of the display block, so it goes back into maths
    // and reaches the reader as the symbol it always meant.
    expect(text).not.toContain('\\approx');
    expect(text).toContain('\u2248 60 minutes total');
  });

  it('renders the maths commands an item body carries out of `\\[...\\]`', () => {
    const { container } = render(
      <Markdown>
        {
          '\\[\n\\begin{itemize}\n\\item 3 \\times 4 \\pm 1\n\\end{itemize}\n\\]'
        }
      </Markdown>,
    );
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    expect(visibleText(container)).toContain('3 \u00d7 4 \u00b1 1');
  });

  it('keeps a command KaTeX cannot render readable rather than an error box', () => {
    const { container } = render(
      <Markdown>
        {
          '\\[\n\\begin{itemize}\n\\item Value \\notarealcommand 12 here\n\\end{itemize}\n\\]'
        }
      </Markdown>,
    );
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    expect(visibleText(container)).toContain('Value \\notarealcommand 12 here');
  });

  // The reach is bounded in both directions: an `\end` that never arrives
  // and an `\end` for the wrong environment both leave the source exactly
  // where the streaming rules already put it -- no list is built from it.
  it('builds no list from an environment a blank line splits and never closes', () => {
    const { container } = render(
      <Markdown>{'\\begin{itemize}\n\\item One\n\nStill typing'}</Markdown>,
    );
    expect(container.querySelectorAll('ul')).toHaveLength(0);
    const text = visibleText(container);
    expect(text).toContain('\\item One');
    expect(text).toContain('Still typing');
  });

  /**
   * `\[\textbf{Short answer:} ... \]` -- a whole paragraph of prose the model
   * wrapped in display delimiters. KaTeX sets the words outside the group in
   * MATH mode, which drops every space between them, so the reader gets
   * `Ican't useawebtool` as one unbroken run. Real display maths keeps its
   * words inside `\text{}`, so a run of bare words is the discriminator.
   */
  it('rebuilds a display block that is really prose', () => {
    const { container } = render(
      <Markdown>
        {
          '\\[\n\\textbf{Short answer:} I can not use a web tool in this chat.\n\\]'
        }
      </Markdown>,
    );
    expect(container.querySelectorAll('.katex')).toHaveLength(0);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('Short answer:');
    expect(visibleText(container)).toContain(
      'I can not use a web tool in this chat.',
    );
  });

  it('leaves display maths whose words live inside \\text as maths', () => {
    const { container } = render(
      <Markdown>
        {
          '\\[\nI_{sp} = \\frac{\\text{Thrust}}{\\text{Fuel weight flow rate}}\n\\]'
        }
      </Markdown>,
    );
    expect(container.querySelector('.katex')).toBeTruthy();
    expect(container.querySelectorAll('.katex-error')).toHaveLength(0);
    expect(container.querySelector('strong')).toBeNull();
  });

  it('builds no list from an environment a blank line splits and mis-closes', () => {
    const { container } = render(
      <Markdown>{'\\begin{itemize}\n\\item One\n\n\\end{enumerate}'}</Markdown>,
    );
    expect(container.querySelectorAll('ul')).toHaveLength(0);
    const text = visibleText(container);
    expect(text).toContain('\\item One');
    expect(text).toContain('\\end{enumerate}');
  });
});

/**
 * Streamdown prestyles every element for a DOCUMENT: `h1` is `text-3xl`
 * (30px) inside a `text-sm/6` (14px) chat bubble, `strong` is a `<span>`, a
 * list item is no longer a scroll container and an image has no height limit.
 * The app carried an override for each of these before the migration and
 * still needs it. Issue #2441.
 */
describe('Markdown - typography overrides the chat bubble needs (issue #2441)', () => {
  const heading = (source: string, tag: string) =>
    render(<Markdown>{source}</Markdown>).container.querySelector(tag);

  it('steps h1-h6 DOWN from the bubble body, not up', () => {
    expect(heading('# Hello Conrad!', 'h1')?.className).toContain('text-xl');
    expect(heading('## Two', 'h2')?.className).toContain('text-lg');
    expect(heading('### Three', 'h3')?.className).toContain('text-base');
    expect(heading('#### Four', 'h4')?.className).toContain('text-sm');
    // Streamdown would give h5 `text-base` (16px), LARGER than the h4 above it.
    expect(heading('##### Five', 'h5')?.className).toContain('text-sm');
    expect(heading('###### Six', 'h6')?.className).toContain('text-sm');
  });

  it('never lets a heading keep Streamdown\u2019s document scale', () => {
    // Streamdown: h1 text-3xl, h2 text-2xl, h3 text-xl, h4 text-lg.
    for (const [source, tag, streamdown] of [
      ['# One', 'h1', 'text-3xl'],
      ['## Two', 'h2', 'text-2xl'],
      ['### Three', 'h3', 'text-xl'],
      ['#### Four', 'h4', 'text-lg'],
      ['##### Five', 'h5', 'text-base'],
    ] as const) {
      const className = heading(source, tag)?.className ?? '';
      expect(className).not.toContain(streamdown);
      expect(className).toContain('tracking-tight');
    }
  });

  it('suppresses a heading whose text has not streamed in yet', () => {
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      const hashes = '#'.repeat(Number(tag[1]));
      const { container } = render(<Markdown>{`${hashes} \n`}</Markdown>);
      expect(container.querySelector(tag)).toBeNull();
    }
  });

  it('emits a real <strong>, not Streamdown\u2019s <span>', () => {
    const { container } = render(<Markdown>{'**bold**'}</Markdown>);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('span.font-semibold')).toBeNull();
  });

  it('emits a real <em> for emphasis', () => {
    const { container } = render(<Markdown>{'*italic*'}</Markdown>);
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('opens every link in a new tab with a safe rel', () => {
    const { container } = render(
      <Markdown>{'[a link](https://example.com)'}</Markdown>,
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noreferrer');
  });

  it('gives a list item an inner scroll container, never the item itself', () => {
    const { container } = render(
      <Markdown>{'- A bullet\n- Another bullet'}</Markdown>,
    );
    for (const li of container.querySelectorAll('li')) {
      expect(li.className).not.toMatch(/overflow/);
      expect(li.className).not.toMatch(/py-1/);
      expect(li.querySelector(':scope > div.overflow-x-auto')).not.toBeNull();
    }
  });

  it('inlines only a loose item\u2019s FIRST paragraph, not its continuations', () => {
    // Streamdown's unscoped `[&>p]:inline` inlined every paragraph in a loose
    // list item, so `- one\n\n  two` rendered as a single run "onetwo". Only
    // the first paragraph should share the marker's line.
    const { container } = render(
      <Markdown>{'- one\n\n  two\n\n- three'}</Markdown>,
    );
    const wrapper = container.querySelector('li > div.overflow-x-auto');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('[&>p:first-child]:inline');
    expect(wrapper?.className).not.toMatch(/\[&>p\]:inline/);
    // the item really does hold two separate paragraphs to keep apart
    expect(wrapper?.querySelectorAll('p')).toHaveLength(2);
  });

  it('keeps a wide equation inside the item\u2019s scroll container', () => {
    const { container } = render(
      <Markdown>
        {'- Bullet\n\n  $$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$\n'}
      </Markdown>,
    );
    const wrapper = container.querySelector('li > div.overflow-x-auto');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('.katex-display')).not.toBeNull();
  });

  it('renders a table at full height with no fullscreen expander', () => {
    // Streamdown ships a fullscreen expander (a modal over the conversation)
    // and clips the table to 300px. The expander is off by product decision,
    // which would leave a long table trapped in a 300px scrollbox, so the
    // height cap is off too — matching what the pre-Streamdown renderer did.
    const rows = Array.from({ length: 40 }, (_, i) => `| r${i} | v${i} |`).join(
      '\n',
    );
    const { container } = render(
      <Markdown>{`| a | b |\n|---|---|\n${rows}`}</Markdown>,
    );

    expect(container.querySelector('table')).not.toBeNull();

    const scroller = container.querySelector<HTMLElement>(
      '[data-streamdown="table-wrapper"] div[class*="overflow-y-auto"]',
    );
    expect(scroller).not.toBeNull();
    expect(scroller?.style.maxHeight).toBe('');

    expect(
      container.querySelector('[aria-label*="ullscreen"],[title*="ullscreen"]'),
    ).toBeNull();
  });

  it('clamps an image and gives it an accessible failure state', () => {
    const { container } = render(
      <Markdown>{'![a picture](https://example.invalid/nope.png)'}</Markdown>,
    );
    const img = container.querySelector('img');
    expect(img?.className).toContain('max-h-96');
    expect(img?.className).toContain('object-contain');
    // Streamdown's own image chrome (a hover download control) is bypassed.
    expect(container.querySelector('[data-streamdown="image"]')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});

/**
 * `\[\text{...}\]` around a whole sentence is prose in a maths costume: KaTeX
 * sets it centred, in a serif face, at display scale. Two real user reports.
 * Issue #2441.
 */
describe('Markdown - display maths that is entirely \\text{} (issue #2441)', () => {
  const rendered = (source: string) => {
    const { container } = render(<Markdown>{source}</Markdown>);
    return {
      katex: container.querySelectorAll('.katex').length,
      display: container.querySelectorAll('.katex-display').length,
      paragraphs: [...container.querySelectorAll('p')].map(
        (p) => p.textContent,
      ),
      container,
    };
  };

  it('renders a one-sentence display block as a plain paragraph', () => {
    const { katex, display, paragraphs } = rendered(
      '\\[\n\\text{Hi Conrad, how can I help you today?}\n\\]',
    );
    expect(katex).toBe(0);
    expect(display).toBe(0);
    expect(paragraphs).toEqual(['Hi Conrad, how can I help you today?']);
  });

  it('renders an all-\\text{} aligned block as one paragraph per row', () => {
    const { katex, paragraphs } = rendered(
      '$$\n\\begin{aligned}\n&\\text{Got it, Conrad. I received: "e2e first msg 1781965048662".}\\\\\n&\\text{Would you like me to confirm delivery, save this ID, or do something else with it?}\n\\end{aligned}\n$$',
    );
    expect(katex).toBe(0);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain('Got it, Conrad. I received:');
    expect(paragraphs[1]).toContain('Would you like me to confirm delivery');
  });

  it('keeps real alignment maths, unit maths and a short label as maths', () => {
    expect(
      rendered('$$\\begin{aligned} a &= b + c \\\\ d &= e + f \\end{aligned}$$')
        .display,
    ).toBe(1);
    const units = rendered(
      '$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$',
    );
    expect(units.katex).toBe(1);
    expect(units.display).toBe(0);
    expect(rendered('$$\\text{Step 2}$$').display).toBe(1);
  });
});

/**
 * An assistant ends a line with LaTeX's `\\` row break; CommonMark reads it as
 * an escaped backslash and leaves the literal behind. Issue #2441.
 */
describe('Markdown - the backslash a LaTeX row break leaves (issue #2441)', () => {
  const html = (source: string) =>
    render(<Markdown>{source}</Markdown>).container.innerHTML;

  it('breaks the line without leaving a stray backslash', () => {
    const out = html(
      'Line ending with backslashes \\\\\nnext line after hard break.',
    );
    expect(out).toContain('<br>');
    expect(out).not.toContain('\\<br>');
    expect(out).toContain('Line ending with backslashes');
    expect(out).toContain('next line after hard break.');
  });

  it('keeps the row separators of a matrix and an aligned block', () => {
    const matrix = render(
      <Markdown>
        {'$$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$'}
      </Markdown>,
    ).container;
    expect(matrix.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(matrix.querySelector('.katex-error')).toBeNull();
    expect(matrix.textContent).toContain('3');

    const aligned = render(
      <Markdown>
        {'$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$'}
      </Markdown>,
    ).container;
    expect(aligned.querySelectorAll('.katex-display')).toHaveLength(1);
    expect(aligned.querySelector('.katex-error')).toBeNull();
  });

  it('keeps a trailing backslash in code and a path mid-sentence', () => {
    expect(html('```\nline one \\\nline two\n```')).toContain('line one \\');
    expect(
      render(<Markdown>{'inline `trailing \\` here'}</Markdown>).container
        .textContent,
    ).toContain('trailing \\');
    expect(
      render(<Markdown>{'Path C:\\Users\\name mid-sentence.'}</Markdown>)
        .container.textContent,
    ).toContain('C:\\Users\\name');
  });
});

describe('Markdown - overrides at their edges (issue #2441)', () => {
  it('suppresses a <strong> an empty \\textbf{} would otherwise leave behind', () => {
    // remarkLatexIslands rebuilds `\textbf{...}` as a strong node; an empty
    // group gives it no children, and Streamdown renders the bare tag.
    const { container } = render(<Markdown>{'A $\\textbf{}$ gap'}</Markdown>);
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('gap');
  });

  it('suppresses an <em> an empty \\textit{} would otherwise leave behind', () => {
    const { container } = render(<Markdown>{'A $\\textit{}$ gap'}</Markdown>);
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('gap');
  });

  it('leaves a raw <pre> that wraps no fence as a plain block', () => {
    const { container } = render(
      <Markdown>{'<pre>plain preformatted text</pre>'}</Markdown>,
    );
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.className).toContain('bg-gray-200');
    expect(container.querySelector('[data-code-block]')).toBeNull();
    expect(container.textContent).toContain('plain preformatted text');
  });
});
