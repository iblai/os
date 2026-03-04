import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Markdown from '@/components/markdown';
import { preprocessLaTeX } from '@/lib/utils';

/**
 * Test suite for the Markdown component
 *
 * This suite tests the Markdown component's ability to:
 * 1. Render basic markdown content
 * 2. Handle LaTeX mathematical equations (inline and block)
 * 3. Convert LaTeX text formatting to Markdown
 * 4. Convert LaTeX environments (itemize, enumerate, etc.) to Markdown/HTML
 * 5. Handle edge cases and complex nested structures
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
     * Verifies that **text** is converted to <strong> tags
     */
    it('should render bold text', () => {
      const { container } = render(<Markdown>This is **bold** text.</Markdown>);
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
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
     * Test code block rendering
     * Verifies that code blocks are properly rendered with syntax highlighting
     */
    it('should render code blocks', () => {
      const markdown = '```javascript\nconst x = 10;\n```';
      const { container } = render(<Markdown>{markdown}</Markdown>);
      // Check for code element
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
    });

    /**
     * Test inline code rendering
     * Verifies that inline code is wrapped in <code> tags
     */
    it('should render inline code', () => {
      const { container } = render(<Markdown>Use `const` for variables.</Markdown>);
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      expect(code?.textContent).toBe('const');
    });

    /**
     * Test link rendering
     * Verifies that markdown links are converted to <a> tags with proper attributes
     */
    it('should render links', () => {
      const { container } = render(<Markdown>[Google](https://google.com)</Markdown>);
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('https://google.com');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    /**
     * Test mailto link rendering
     * Verifies that mailto: links are allowed
     */
    it('should render mailto links', () => {
      const { container } = render(<Markdown>[Email](mailto:test@example.com)</Markdown>);
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('mailto:test@example.com');
    });

    /**
     * Test tel link rendering
     * Verifies that tel: links are allowed
     */
    it('should render tel links', () => {
      const { container } = render(<Markdown>[Call](tel:+1234567890)</Markdown>);
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('tel:+1234567890');
    });

    /**
     * Test disallowed URL protocol filtering
     * Verifies that javascript: and other disallowed protocols are filtered out
     */
    it('should filter out disallowed URL protocols', () => {
      const { container } = render(<Markdown>[Click](javascript:alert('xss'))</Markdown>);
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      // The href should be empty since javascript: is not allowed
      expect(link?.getAttribute('href')).toBe('');
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
     * Verifies that inline equations are converted to $ $ for KaTeX
     */
    it('should render inline LaTeX with \\( \\) delimiters', () => {
      const { container } = render(<Markdown>The equation \\(E = mc^2\\) is famous.</Markdown>);
      // The preprocessLaTeX function should convert \( \) to $ $
      expect(container.textContent).toContain('E = mc^2');
    });

    /**
     * Test block LaTeX equation rendering using \[ \] delimiters
     * Verifies that block equations are converted to $$ $$ for KaTeX
     */
    it('should render block LaTeX with \\[ \\] delimiters', () => {
      const { container } = render(
        <Markdown>
          {'The quadratic formula is:\\n\\[x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\]'}
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
        <Markdown>{'The integral is:\\n$$\\int_0^\\infty e^{-x} dx = 1$$'}</Markdown>,
      );
      expect(container.textContent).toContain('∫');
    });

    /**
     * Test currency dollar sign handling
     * Verifies that dollar signs before digits are escaped and rendered as literal $
     */
    it('should escape currency dollar signs', () => {
      const { container } = render(<Markdown>The price is $100 for the product.</Markdown>);
      expect(container.textContent).toContain('$100');
    });

    /**
     * Test mixed LaTeX and currency in same content
     * Verifies that mathematical $ and currency $ are handled correctly
     */
    it('should handle both LaTeX and currency in the same content', () => {
      const { container } = render(<Markdown>The equation $x = 5$ costs $10 to compute.</Markdown>);
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

      // Check for bold text
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

  describe('LaTeX Text Formatting', () => {
    /**
     * Test LaTeX bold text conversion
     * Verifies that \textbf{text} is converted to **text** (markdown bold)
     */
    it('should convert \\textbf{} to bold text', () => {
      const { container } = render(<Markdown>{'This is \\textbf{bold} text.'}</Markdown>);
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong?.textContent).toBe('bold');
    });

    /**
     * Test LaTeX italic text conversion
     * Verifies that \textit{text} is converted to *text* (markdown italic)
     */
    it('should convert \\textit{} to italic text', () => {
      const { container } = render(<Markdown>{'This is \\textit{italic} text.'}</Markdown>);
      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em?.textContent).toBe('italic');
    });

    /**
     * Test LaTeX emphasis text conversion
     * Verifies that \emph{text} is converted to *text* (markdown italic)
     */
    it('should convert \\emph{} to emphasized text', () => {
      const { container } = render(<Markdown>{'This is \\emph{emphasized} text.'}</Markdown>);
      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em?.textContent).toBe('emphasized');
    });

    /**
     * Test LaTeX monospace text conversion
     * Verifies that \texttt{text} is converted to `text` (inline code)
     */
    it('should convert \\texttt{} to monospace text', () => {
      const { container } = render(<Markdown>{'Use \\texttt{const} for constants.'}</Markdown>);
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      expect(code?.textContent).toBe('const');
    });

    /**
     * Test LaTeX underline text conversion
     * Verifies that \underline{text} is converted to <u>text</u>
     */
    it('should convert \\underline{} to underlined text', () => {
      const { container } = render(<Markdown>{'This is \\underline{underlined} text.'}</Markdown>);
      const u = container.querySelector('u');
      expect(u).toBeTruthy();
      expect(u?.textContent).toBe('underlined');
    });

    /**
     * Test multiple LaTeX formatting commands in same content
     * Verifies that multiple formatting commands work together
     */
    it('should handle multiple LaTeX formatting commands', () => {
      const { container } = render(
        <Markdown>{'Text with \\textbf{bold}, \\textit{italic}, and \\texttt{code}.'}</Markdown>,
      );
      expect(container.querySelector('strong')).toBeTruthy();
      expect(container.querySelector('em')).toBeTruthy();
      expect(container.querySelector('code')).toBeTruthy();
    });
  });

  describe('LaTeX Environments', () => {
    /**
     * Test LaTeX itemize environment conversion
     * Verifies that \begin{itemize} ... \end{itemize} is converted to markdown list
     */
    it('should convert \\begin{itemize} to unordered list', () => {
      const markdown = `
\\begin{itemize}
\\item First item
\\item Second item
\\item Third item
\\end{itemize}
`;
      const { container } = render(<Markdown>{markdown}</Markdown>);
      const ul = container.querySelector('ul');
      const listItems = container.querySelectorAll('li');
      expect(ul).toBeTruthy();
      expect(listItems.length).toBeGreaterThanOrEqual(3);
    });

    /**
     * Test LaTeX enumerate environment conversion
     * Verifies that \begin{enumerate} ... \end{enumerate} is converted to numbered list
     */
    it('should convert \\begin{enumerate} to ordered list', () => {
      const markdown = `
\\begin{enumerate}
\\item First item
\\item Second item
\\item Third item
\\end{enumerate}
`;
      const { container } = render(<Markdown>{markdown}</Markdown>);
      const ol = container.querySelector('ol');
      const listItems = container.querySelectorAll('li');
      expect(ol).toBeTruthy();
      expect(listItems.length).toBeGreaterThanOrEqual(3);
    });

    /**
     * Test LaTeX quote environment conversion
     * Verifies that \begin{quote} ... \end{quote} is converted to blockquote
     */
    it('should convert \\begin{quote} to blockquote', () => {
      const markdown = `
\\begin{quote}
This is a quoted text.
\\end{quote}
`;
      const { container } = render(<Markdown>{markdown}</Markdown>);
      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
    });

    /**
     * Test LaTeX center environment conversion
     * Verifies that \begin{center} ... \end{center} is converted to centered div
     */
    it('should convert \\begin{center} to centered text', () => {
      const markdown = `
\\begin{center}
Centered text
\\end{center}
`;
      const { container } = render(<Markdown>{markdown}</Markdown>);
      const div = container.querySelector('div[style*="text-align: center"]');
      expect(div).toBeTruthy();
    });
  });

  describe('LaTeX Sectioning', () => {
    /**
     * Test LaTeX section conversion
     * Verifies that \section{text} is converted to ## text (heading 2)
     */
    it('should convert \\section{} to heading 2', () => {
      const { container } = render(<Markdown>{'\\section{Introduction}'}</Markdown>);
      const h2 = container.querySelector('h2');
      expect(h2).toBeTruthy();
      expect(h2?.textContent).toBe('Introduction');
    });

    /**
     * Test LaTeX subsection conversion
     * Verifies that \subsection{text} is converted to ### text (heading 3)
     */
    it('should convert \\subsection{} to heading 3', () => {
      const { container } = render(<Markdown>{'\\subsection{Background}'}</Markdown>);
      const h3 = container.querySelector('h3');
      expect(h3).toBeTruthy();
      expect(h3?.textContent).toBe('Background');
    });

    /**
     * Test LaTeX subsubsection conversion
     * Verifies that \subsubsection{text} is converted to #### text (heading 4)
     */
    it('should convert \\subsubsection{} to heading 4', () => {
      const { container } = render(<Markdown>{'\\subsubsection{Details}'}</Markdown>);
      const h4 = container.querySelector('h4');
      expect(h4).toBeTruthy();
      expect(h4?.textContent).toBe('Details');
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

    /**
     * Test LaTeX line breaks
     * Verifies that \\ is converted to line break
     */
    it('should convert \\\\ to line breaks', () => {
      const { container } = render(<Markdown>{'Line 1\\\\Line 2'}</Markdown>);
      expect(container.innerHTML).toContain('<br>');
    });
  });

  describe('Complex LaTeX Content - Ethics Example', () => {
    /**
     * Test comprehensive ethics use case from requirements
     * This tests the specific content provided by the user with LaTeX formatting,
     * itemize environment, and textbf commands
     */
    it('should render the ethics example correctly', () => {
      const ethicsContent = `\\textbf{Ethics} concerns the values and rules that guide what we ought to do. The most commonly cited principles are:

\\begin{itemize}
\\item \\textbf{Autonomy (Respect for persons)}: Honor people's informed choices and agency. Example: obtain informed consent before a procedure.
\\item \\textbf{Beneficence}: Act to promote others' well-being. Example: design safety features that reduce user risk.
\\item \\textbf{Nonmaleficence}: Avoid causing harm ("first, do no harm"). Example: test a product to prevent foreseeable injuries or biases.
\\item \\textbf{Justice}: Treat people fairly; distribute benefits and burdens equitably. Example: allocate scarce resources using transparent, consistent criteria.
\\item \\textbf{Fidelity (and Responsibility)}: Keep promises, be dependable, uphold professional duties. Example: meet obligations to clients or patients.
\\item \\textbf{Veracity}: Tell the truth; avoid deception. Example: disclose conflicts of interest.
\\item \\textbf{Integrity}: Be consistent with moral values; do not manipulate data or cut corners.
\\item \\textbf{Accountability}: Be answerable for decisions and their impacts; invite oversight.
\\item \\textbf{Privacy and Confidentiality}: Protect personal information and respect boundaries.
\\item \\textbf{Competence}: Maintain knowledge and skills to perform duties safely and effectively.
\\end{itemize}

In bioethics, the "four principles" framework emphasizes: \\textbf{autonomy}, \\textbf{beneficence}, \\textbf{nonmaleficence}, and \\textbf{justice}. In technology/AI ethics, additional focus often includes \\textbf{transparency}, \\textbf{explainability}, \\textbf{safety}, and \\textbf{human oversight}.`;

      const { container } = render(<Markdown>{ethicsContent}</Markdown>);

      // Check that the main title "Ethics" is bold
      const strongElements = container.querySelectorAll('strong');
      expect(strongElements.length).toBeGreaterThan(0);
      expect(container.textContent).toContain('Ethics');

      // Check that the list is rendered
      const ul = container.querySelector('ul');
      expect(ul).toBeTruthy();

      const listItems = container.querySelectorAll('li');
      expect(listItems.length).toBeGreaterThanOrEqual(10);

      // Check for specific principle names in bold
      expect(container.textContent).toContain('Autonomy (Respect for persons)');
      expect(container.textContent).toContain('Beneficence');
      expect(container.textContent).toContain('Nonmaleficence');
      expect(container.textContent).toContain('Justice');
      expect(container.textContent).toContain('Fidelity (and Responsibility)');
      expect(container.textContent).toContain('Veracity');
      expect(container.textContent).toContain('Integrity');
      expect(container.textContent).toContain('Accountability');
      expect(container.textContent).toContain('Privacy and Confidentiality');
      expect(container.textContent).toContain('Competence');

      // Check that the closing paragraph is present
      expect(container.textContent).toContain('four principles');
      expect(container.textContent).toContain('transparency');
      expect(container.textContent).toContain('explainability');
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
     * Test nested LaTeX formatting
     * Note: Simple regex-based approach doesn't handle deeply nested braces perfectly,
     * but handles common cases. For complex nesting, recommend sequential formatting.
     */
    it('should handle LaTeX formatting with multiple commands', () => {
      const { container } = render(
        <Markdown>{'\\textbf{Bold text} and \\textit{italic text} together'}</Markdown>,
      );
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong?.textContent).toBe('Bold text');
      expect(container.querySelector('em')).toBeTruthy();
    });

    /**
     * Test LaTeX with special characters
     * Verifies that special characters in LaTeX commands are handled properly
     */
    it('should handle LaTeX with special characters', () => {
      const { container } = render(
        <Markdown>{'Cost is \\$100, success rate is 95\\%, tags: \\#ai \\& \\#ml'}</Markdown>,
      );
      expect(container.textContent).toContain('$100');
      expect(container.textContent).toContain('95%');
      expect(container.textContent).toContain('#ai');
      expect(container.textContent).toContain('& #ml');
    });

    /**
     * Test very long content
     * Verifies that the component can handle large amounts of content
     */
    it('should handle very long content', () => {
      const longContent = Array(100).fill('\\textbf{Bold text} with some content.').join(' ');
      const { container } = render(<Markdown>{longContent}</Markdown>);
      expect(container.querySelectorAll('strong').length).toBe(100);
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
      const malformed = '\\textbf{unclosed brace or \\begin{itemize} without end';
      const { container } = render(<Markdown>{malformed}</Markdown>);
      // Should still render something even if not perfectly formatted
      expect(container).toBeTruthy();
    });
  });
});

/**
 * Test suite for the preprocessLaTeX utility function
 *
 * These tests focus on the transformation logic in isolation,
 * separate from the React component rendering
 */
describe('preprocessLaTeX Utility Function', () => {
  describe('Basic LaTeX Delimiter Conversion', () => {
    /**
     * Test inline LaTeX delimiter conversion
     * Verifies that \( \) is converted to $ $
     */
    it('should convert \\( \\) to $ $', () => {
      const input = 'Equation \\(x = 5\\) here';
      const output = preprocessLaTeX(input);
      expect(output).toBe('Equation $x = 5$ here');
    });

    /**
     * Test block LaTeX delimiter conversion
     * Verifies that \[ \] is converted to $$ $$
     */
    it('should convert \\[ \\] to $$ $$', () => {
      const input = 'Display equation\\n\\[E = mc^2\\]';
      const output = preprocessLaTeX(input);
      expect(output).toContain('$$E = mc^2$$');
    });

    /**
     * Test currency dollar sign escaping
     * Verifies that $<digit> gets backslash prepended
     */
    it('should escape currency dollar signs before digits', () => {
      const input = 'The cost is $100';
      const output = preprocessLaTeX(input);
      expect(output).toBe('The cost is \\$100');
    });

    /**
     * Test that LaTeX $ is not escaped
     * Verifies that $ in math context is preserved
     */
    it('should not escape LaTeX dollar signs', () => {
      const input = 'Equation $x = 5$ is simple';
      const output = preprocessLaTeX(input);
      expect(output).toBe('Equation $x = 5$ is simple');
    });
  });

  describe('Text Formatting Conversion', () => {
    /**
     * Test textbf conversion
     */
    it('should convert \\textbf{text} to **text**', () => {
      const input = '\\textbf{bold}';
      const output = preprocessLaTeX(input);
      expect(output).toBe('**bold**');
    });

    /**
     * Test textit conversion
     */
    it('should convert \\textit{text} to *text*', () => {
      const input = '\\textit{italic}';
      const output = preprocessLaTeX(input);
      expect(output).toBe('*italic*');
    });

    /**
     * Test emph conversion
     */
    it('should convert \\emph{text} to *text*', () => {
      const input = '\\emph{emphasized}';
      const output = preprocessLaTeX(input);
      expect(output).toBe('*emphasized*');
    });

    /**
     * Test texttt conversion
     */
    it('should convert \\texttt{text} to `text`', () => {
      const input = '\\texttt{code}';
      const output = preprocessLaTeX(input);
      expect(output).toBe('`code`');
    });

    /**
     * Test underline conversion
     */
    it('should convert \\underline{text} to <u>text</u>', () => {
      const input = '\\underline{underlined}';
      const output = preprocessLaTeX(input);
      expect(output).toBe('<u>underlined</u>');
    });
  });

  describe('Environment Conversion', () => {
    /**
     * Test itemize environment conversion
     */
    it('should convert \\begin{itemize} to markdown list', () => {
      const input = `\\begin{itemize}
\\item First
\\item Second
\\end{itemize}`;
      const output = preprocessLaTeX(input);
      expect(output).toContain('- First');
      expect(output).toContain('- Second');
    });

    /**
     * Test enumerate environment conversion
     */
    it('should convert \\begin{enumerate} to numbered list', () => {
      const input = `\\begin{enumerate}
\\item First
\\item Second
\\end{enumerate}`;
      const output = preprocessLaTeX(input);
      expect(output).toContain('1. First');
      expect(output).toContain('2. Second');
    });

    /**
     * Test quote environment conversion
     */
    it('should convert \\begin{quote} to blockquote', () => {
      const input = '\\begin{quote}Quoted text\\end{quote}';
      const output = preprocessLaTeX(input);
      expect(output).toContain('> Quoted text');
    });

    /**
     * Test center environment conversion
     */
    it('should convert \\begin{center} to centered div', () => {
      const input = '\\begin{center}Centered\\end{center}';
      const output = preprocessLaTeX(input);
      expect(output).toContain('<div style="text-align: center;">Centered</div>');
    });
  });

  describe('Sectioning Conversion', () => {
    /**
     * Test section conversion
     */
    it('should convert \\section{} to ## heading', () => {
      const input = '\\section{Title}';
      const output = preprocessLaTeX(input);
      expect(output).toContain('## Title');
    });

    /**
     * Test subsection conversion
     */
    it('should convert \\subsection{} to ### heading', () => {
      const input = '\\subsection{Subtitle}';
      const output = preprocessLaTeX(input);
      expect(output).toContain('### Subtitle');
    });

    /**
     * Test subsubsection conversion
     */
    it('should convert \\subsubsection{} to #### heading', () => {
      const input = '\\subsubsection{Details}';
      const output = preprocessLaTeX(input);
      expect(output).toContain('#### Details');
    });
  });

  describe('Special Characters Conversion', () => {
    /**
     * Test ampersand escape
     */
    it('should convert \\& to &', () => {
      const input = 'A \\& B';
      const output = preprocessLaTeX(input);
      expect(output).toBe('A & B');
    });

    /**
     * Test percent escape
     */
    it('should convert \\% to %', () => {
      const input = '50\\%';
      const output = preprocessLaTeX(input);
      expect(output).toBe('50%');
    });

    /**
     * Test hash escape
     */
    it('should convert \\# to #', () => {
      const input = '\\#tag';
      const output = preprocessLaTeX(input);
      expect(output).toBe('#tag');
    });

    /**
     * Test underscore escape
     */
    it('should convert \\_ to _', () => {
      const input = 'var\\_name';
      const output = preprocessLaTeX(input);
      expect(output).toBe('var_name');
    });

    /**
     * Test double backslash line break
     */
    it('should convert \\\\ to line break', () => {
      const input = 'Line 1\\\\Line 2';
      const output = preprocessLaTeX(input);
      expect(output).toContain('  \n');
    });

    /**
     * Test quote conversion
     */
    it('should convert LaTeX quotes to regular quotes', () => {
      const input = "``quoted text''";
      const output = preprocessLaTeX(input);
      expect(output).toBe('"quoted text"');
    });
  });

  describe('Complex Content Transformation', () => {
    /**
     * Test the full ethics example transformation
     */
    it('should correctly transform the ethics example', () => {
      const input = `\\textbf{Ethics} concerns the values and rules that guide what we ought to do. The most commonly cited principles are:

\\begin{itemize}
\\item \\textbf{Autonomy (Respect for persons)}: Honor people's informed choices and agency.
\\item \\textbf{Beneficence}: Act to promote others' well-being.
\\item \\textbf{Nonmaleficence}: Avoid causing harm ("first, do no harm").
\\end{itemize}`;

      const output = preprocessLaTeX(input);

      // Check that textbf is converted
      expect(output).toContain('**Ethics**');
      expect(output).toContain('**Autonomy (Respect for persons)**');
      expect(output).toContain('**Beneficence**');
      expect(output).toContain('**Nonmaleficence**');

      // Check that itemize is converted to list
      expect(output).toContain('- **Autonomy (Respect for persons)**:');
      expect(output).toContain('- **Beneficence**:');
      expect(output).toContain('- **Nonmaleficence**:');
    });

    /**
     * Test multiple transformations in sequence
     */
    it('should handle multiple transformations correctly', () => {
      const input = '\\section{Title} with \\textbf{bold} and \\textit{italic} and \\(x = 5\\)';
      const output = preprocessLaTeX(input);

      expect(output).toContain('## Title');
      expect(output).toContain('**bold**');
      expect(output).toContain('*italic*');
      expect(output).toContain('$x = 5$');
    });

    /**
     * Test sequential formatting (nested braces have limitations in regex approach)
     */
    it('should handle sequential formatting commands', () => {
      const input = '\\textbf{Bold} and \\textit{italic} text';
      const output = preprocessLaTeX(input);

      expect(output).toBe('**Bold** and *italic* text');
    });
  });
});
