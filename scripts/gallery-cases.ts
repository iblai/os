export type GCase = { id: string; label: string; md: string; note?: string };
export type GGroup = { group: string; blurb: string; cases: GCase[] };

export const GALLERY: GGroup[] = [
  {
    group: 'Currency vs math',
    blurb:
      'Prices must stay literal; genuine $…$ math must still render. The historical failure was a price opening a math span and eating the prose after it.',
    cases: [
      {
        id: 'a',
        label: 'Other currencies',
        md: 'Other currencies: €5-€10, £20-£30, ¥100-¥200, and $5-$10.',
      },
      {
        id: 'b',
        label: 'Escaped already',
        md: 'Escaped already: I paid \\$5 and \\$10 today.',
      },
      {
        id: 'c',
        label: 'Dollar at very start',
        md: 'Dollar at very start: $5 is the price.',
      },
      { id: 'd', label: 'Only a dollar sign', md: 'Only a dollar sign: $' },
      {
        id: 'e',
        label: 'Double dollar inline',
        md: 'Double dollar inline: price is $$5 here.',
      },
      { id: 'f', label: 'Triple', md: 'Triple: $$$5' },
      {
        id: 'g',
        label: 'Dollar then letter',
        md: 'Dollar then letter: $abc and $xyz',
      },
      {
        id: 'h',
        label: 'Dollar space digit',
        md: 'Dollar then space then digit: $ 5 and $ 10',
      },
      { id: 'i', label: 'Negative', md: 'Negative: -$5 to -$10' },
      {
        id: 'j',
        label: 'Thousands',
        md: 'Thousands: $1,000,000 and $2,500.75',
      },
      { id: 'k', label: 'Percent', md: 'Percent: 50% off $20, tax is 8.5%' },
      {
        id: 'l',
        label: 'Math with underscores',
        md: 'Math with underscores: $a_1 + b_2$ and $c_3$',
      },
      {
        id: 'm',
        label: 'Math with asterisk',
        md: 'Math with asterisk: $a * b$ and $x \\cdot y$',
      },
      {
        id: 'n',
        label: 'Consecutive math',
        md: 'Consecutive math: $a$$b$ and $x$ $y$',
        note: 'The closing run stops as soon as it matches the opening one, so $a$$b$ pairs off into two adjacent spans; the neighbours still typeset.',
      },
      {
        id: 'o',
        label: 'Currency then math no space',
        md: 'Currency then math no space: $5$x + 1$',
      },
      {
        id: 'p',
        label: 'Very long money',
        md: 'Very long money: $999,999,999,999.99',
      },
      { id: 'q', label: 'Zero', md: 'Zero: $0 and $0.00' },
      { id: 'r', label: 'Trailing', md: 'Trailing: cost is $5.' },
      { id: 's', label: 'Bold money', md: 'Bold money: **$5** and *$10*' },
      { id: 't', label: 'Money in code', md: 'Money in code: `$5` and `$x$`' },
      {
        id: 'u',
        label: 'Price beside chemistry',
        md: 'range is $100-$200.\nChem $\\ce{H2O}$ and $\\ce{SO4^2-}$',
        note: 'The bug that swallowed prose — fixed by the @ziloen patch.',
      },
      {
        id: 'v',
        label: 'Price + inline math',
        md: 'The kit costs $12, and the formula $3x + 5$ evaluates cleanly.',
      },
    ],
  },
  {
    group: 'Delimiters',
    blurb:
      'Assistants emit \\( \\) and \\[ \\] as often as dollars. Streamdown\u2019s own math plugin supports neither, which is why the tokenizer was swapped.',
    cases: [
      {
        id: 'd1',
        label: 'Bracket inline',
        md: 'Let \\(a^2+b^2=c^2\\) hold for a right triangle.',
      },
      {
        id: 'd2',
        label: 'Bracket display',
        md: 'Energy:\n\\[E = mc^2\\]\nDone.',
      },
      {
        id: 'd3',
        label: 'Dollar inline + display',
        md: 'Inline $x^2$ and display $$y = mx + b$$ together.',
      },
      { id: 'd4', label: 'Fenced display', md: '$$\n3x + 5 = 3(4) + 5\n$$' },
      {
        id: 'd5',
        label: 'Mid-sentence brackets',
        md: 'Mid-sentence \\[x+y\\] stays inline, and \\(z\\) too.',
      },
      {
        id: 'd6',
        label: 'Two display spans',
        md: 'Steps:\n$$a + b$$\n$$c + d$$\nDone.',
      },
    ],
  },
  {
    group: 'Math structure',
    blurb:
      'Row separators and alignment markers must survive. Bare & with no environment is malformed LaTeX that assistants emit constantly.',
    cases: [
      {
        id: 'm1',
        label: 'pmatrix',
        md: '$$\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}$$',
      },
      {
        id: 'm2',
        label: 'aligned (explicit)',
        md: '$$\n\\begin{aligned}\na &= b + c \\\\\nd &= e + f\n\\end{aligned}\n$$',
      },
      {
        id: 'm3',
        label: 'BARE & — no environment',
        md: '$$\na &= b + c \\\\\nd &= e + f\n$$',
        note: 'Auto-wrapped in \\begin{aligned} by lib/rehype-aligned-math.ts. Was a red error box.',
      },
      {
        id: 'm4',
        label: 'cases',
        md: '$$\\begin{cases} a & x>0 \\\\ b & x<0 \\end{cases}$$',
      },
      {
        id: 'm5',
        label: 'Units + frac',
        md: '$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$',
      },
      {
        id: 'm6',
        label: 'Summation',
        md: 'Sum: $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$',
      },
    ],
  },
  {
    group: 'Chemistry (mhchem)',
    blurb: 'katex/contrib/mhchem is imported on both paths.',
    cases: [
      {
        id: 'c1',
        label: 'Molecules',
        md: 'Water is $\\ce{H2O}$ and the ion $\\ce{SO4^2-}$.',
      },
      { id: 'c2', label: 'Units', md: 'Energy $\\pu{123 kJ}$ released.' },
      { id: 'c3', label: 'Reaction', md: '$$\\ce{CO2 + C -> 2CO}$$' },
    ],
  },
  {
    group: 'Code blocks',
    blurb:
      'App chrome: dark, language label left, single Copy button right, Prism tomorrow theme, lazy-loaded. The chrome is decided on `pre`, which only ever wraps a fenced block, so a fence with no language gets it too — the header simply carries no label. No language is exempt: a ```latex fence takes the same chrome as any other.',
    cases: [
      {
        id: 'k1',
        label: 'bash with $ vars',
        md: '```bash\necho $5\nexport PRICE=$100\necho $HOME\n```',
      },
      {
        id: 'k2',
        label: 'TypeScript',
        md: '```ts\nconst price = "$5"; // 10% off\nfunction f(a: number) { return a * 2; }\n```',
      },
      {
        id: 'k3',
        label: 'No language',
        md: '```\nplain fenced text\n- not a list\n```',
      },
      {
        id: 'k7',
        label: 'latex fence',
        md: '```latex\n\\begin{itemize}\n    \\item First item\n\\end{itemize}\n```',
        note: 'A fence is the one place \\begin{itemize} is deliberately literal: it stays code, never becomes a list, and takes the same chrome as every other fence with "latex" as its label.',
      },
      {
        id: 'k6',
        label: 'Every fence variant side by side',
        md: 'Declared language:\n\n```bash\nnpm run dev\n```\n\nlatex:\n\n```latex\n\\frac{1}{2}\n```\n\nNo language:\n\n```\nnpm run dev\n```\n\nRecovered from `\\begin{verbatim}`:\n\n\\begin{verbatim}\nconst price = "$5";\n\\end{verbatim}\n\nRecovered from `\\verb` rows:\n\n\\begin{aligned}\n&\\verb|let a = 1;|\\\\\n&\\verb|let b = 2;|\\\\\n\\end{aligned}\n\nAnd inline `npm run dev`, which keeps its inline styling.',
        note: 'Parity check: the four block forms take the same chrome and the same Copy button; only the first claims a language label, and the inline span takes neither.',
      },
      {
        id: 'k4',
        label: 'Inline code',
        md: 'Use `npm run dev` and `$5` inline.',
      },
      {
        id: 'k5',
        label: 'latex fence (bypass)',
        md: '```latex\n\\frac{a}{b}\n```',
      },
    ],
  },
  {
    group: 'Lists & tables',
    blurb:
      'Two-space nested lists are what assistants emit; CommonMark needs three. normalize-list-indentation.ts is the last preprocessor and exists for this.',
    cases: [
      {
        id: 'l1',
        label: '2-space bullet under ordered',
        md: '1. Item\n  - sub bullet\n2. Next',
      },
      {
        id: 'l2',
        label: '2-space ordered child',
        md: '2. Second\n  1. sub ordered\n3. Third',
      },
      { id: 'l3', label: 'Deep nesting', md: '- alpha\n  - beta\n    - gamma' },
      {
        id: 'l4',
        label: 'Table with money + math',
        md: '| Item | Price | Formula |\n| --- | --- | --- |\n| Widget | $5 | $x^2$ |\n| Gadget | $10 | \\(y^2\\) |',
      },
    ],
  },
  {
    group: 'Safety',
    blurb:
      'Streamdown runs rehype-sanitize + rehype-harden. The old pipeline ran rehype-raw with no sanitizer.',
    cases: [
      { id: 's1', label: 'script tag', md: '<script>alert(1)</script> after' },
      {
        id: 's2',
        label: 'img onerror',
        md: '<img src=x onerror="alert(1)"> after',
      },
      {
        id: 's3',
        label: 'javascript: link',
        md: '[click](javascript:alert(1)) and [ok](https://example.com)',
      },
      {
        id: 's4',
        label: 'u / div style',
        md: '<u>underlined</u> and <div style="text-align:center">centered</div>',
        note: 'REGRESSION vs old build: <u> and style are stripped by the sanitizer.',
      },
    ],
  },
  {
    group: 'Streaming',
    blurb:
      'parseIncompleteMarkdown is OFF: half-arrived delimiters stay literal until they close, instead of being speculatively closed into wrong output.',
    cases: [
      { id: 'x1', label: 'Unclosed $$', md: 'Partial $$x^2' },
      { id: 'x2', label: 'Lone $$', md: '$$\n' },
      {
        id: 'x3',
        label: 'Unclosed aligned head',
        md: '$$\n\\begin{aligned}\nT_s &= O(\\log n) \\\\',
      },
      {
        id: 'x5',
        label: 'Unclosed itemize',
        md: '\\begin{itemize}\n\\item Half arrived',
        note: 'Mid-stream: completed lines convert as they land, so the opener is gone; the half-written last line stays literal until its newline arrives.',
      },
    ],
  },
  {
    group: 'Document-mode LaTeX (restored)',
    blurb:
      'The old prompt told models to emit these; 751971e4 removed it, but legacy mentors still produce them. lib/remark-latex-islands.ts finds each complete environment in the raw source, rebuilds it as the markdown it means and re-parses the item bodies with the message\u2019s own parser, and lib/rehype-verb-code.ts unwraps code that was dressed up as aligned maths. Compatibility code — see the sunset note in both files.',
    cases: [
      {
        id: 'm1',
        label: 'Tutorial with \\verb code blocks',
        md: '## Building a Counter\n\nHere is the component:\n\n\\[\n\\begin{aligned}\n&\\verb|import { useState } from "react";|\\\\\n&\\verb||\\\\\n&\\verb|export function Counter() {|\\\\\n&\\verb|  const [n, setN] = useState(0);|\\\\\n&\\verb|  return <div style={{ gap: 8 }}>|\\\\\n&\\verb|    <button onClick={() => setN(n + 1)}>+</button>|\\\\\n&\\verb|    <TodoCard />|\\\\\n&\\verb|  </div>;|\\\\\n&\\verb|}|\\\\\n\\end{aligned}\n\\]\n\nDrop `<TodoCard />` in wherever you like.',
        note: 'The live report. KaTeX used to typeset this centred and serif; it is a code fence now, byte-intact.',
      },
      {
        id: 'm2',
        label: 'itemize',
        md: '\\begin{itemize}\n\\item First point\n\\item Second point\n\\end{itemize}',
      },
      {
        id: 'm3',
        label: 'nested itemize',
        md: '\\begin{itemize}\n\\item Outer\n\\begin{itemize}\n\\item Inner A\n\\item Inner B\n\\end{itemize}\n\\item Last\n\\end{itemize}',
      },
      {
        id: 'm4',
        label: 'enumerate',
        md: '\\begin{enumerate}\n\\item One\n\\item Two\n\\end{enumerate}',
      },
      {
        id: 'm5',
        label: 'verbatim',
        md: '\\begin{verbatim}\nconst price = "$5";\n\\end{verbatim}',
      },
      {
        id: 'm6',
        label: 'textbf / textit',
        md: 'This is \\textbf{important} and \\textit{slanted} text.',
      },
      {
        id: 'm7',
        label: 'section / subsection',
        md: '\\section{Overview}\nSome prose here.\n\n\\subsection{Detail}\nMore prose.',
      },
      {
        id: 'm8',
        label: 'quote',
        md: '\\begin{quote}\nA line.\n\\end{quote}',
      },
      {
        id: 'm10',
        label: 'The flat, nested and mixed lists from the report',
        md: 'Here is a flat list:\n\n\\begin{itemize}\n\\item First point\n\\item Second point with math $x = 4$\n\\item Third point costs $5\n\\end{itemize}\n\nHere is a nested list:\n\n\\begin{itemize}\n\\item Outer one\n  \\begin{itemize}\n  \\item Inner A\n  \\item Inner B\n  \\end{itemize}\n\\item Outer two\n\\end{itemize}\n\nHere is a mixed nested list:\n\n\\begin{enumerate}\n\\item Step one\n  \\begin{itemize}\n  \\item sub-bullet a\n  \\item sub-bullet b\n  \\end{itemize}\n\\item Step two\n\\end{enumerate}',
        note: 'The live report. The $x = 4$ in item two used to cost all three environments their conversion: it split the paragraph, so \\begin and \\end landed in different mdast nodes and the island was never seen.',
      },
      {
        id: 'm11',
        label: 'Items carrying code, bold, bracket math and a link',
        md: '\\begin{itemize}\n\\item Run `npm run dev`\n\\item A **bold** claim\n\\item Solve \\(y = 2\\)\n\\item See [the docs](https://example.dev)\n\\item A body that runs on\n  to a second line\n\\end{itemize}\nProse right after, with no blank line.',
        note: 'Item bodies are re-parsed with the message\u2019s own parser, so inline markdown behaves exactly as it does anywhere else.',
      },
      {
        id: 'm12',
        label: 'Text styling wrapped in math delimiters',
        md: 'The $\\text{ibl.ai}$ platform offers:\n\n* $\\textbf{Custom AI Agents}$: configurable LLMs and tools.\n* $\\textbf{Canvas \\& Artifacts}$: rich documents and code.\n\nGenuine math still works: $0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$, and $5 stays literal.',
        note: 'A span whose whole body is one text command is the model reaching for bold and finding the wrong syntax; a span that merely contains \\text is real maths and stays maths.',
      },
      {
        id: 'g6',
        label: 'display-wrapped itemize',
        md: '\\[\\begin{itemize}\\item Why\\end{itemize}\\]',
        note: 'A list is never maths, so the delimiters are the model reaching for the wrong syntax; left to KaTeX this was a red "No such environment".',
      },
      {
        id: 'm13',
        label: 'Streaming itemize, mid-token',
        md: 'Intro:\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\item Third po',
        note: 'A reply arrives token by token; the completed items convert as they land and only the half-written line stays literal.',
      },
      {
        id: 'm14',
        label: 'Markdown bold trapped in dollars',
        md: '$**Custom AI Agents**$ and $$__Enterprise__$$, beside real maths $a * b$ and $x_1$.',
        note: 'A DOUBLED marker owning the whole span is the same mistake as $\\textbf{}$; a single * or _ is ordinary maths and stays.',
      },
      {
        id: 'm15',
        label: 'Styling vs annotation in display delimiters',
        md: '\\[\\textbf{React Learning Plan}\\]\n\nStep-by-step:\n\n$$\\text{Step 2: Multiply first}$$\n\n$$3(4) + 5 = 12 + 5$$',
        note: 'A styling command in display delimiters is a faked heading and unwraps; a plain-text one is a centred annotation and stays maths.',
      },
      {
        id: 'm16',
        label: 'texttt / underline / verb in prose',
        md: 'Use \\texttt{const}, read \\underline{carefully}, then run \\verb|npm test|.',
        note: 'The prose styling commands the old preprocessor converted. \\underline maps to <em>: the sanitizer drops <u>.',
      },
      {
        id: 'm9',
        label: 'unwrapped aligned \\verb block',
        md: '\\begin{aligned}\n&\\verb|let a = 1;|\\\\\n&\\verb|let b = 2;|\\\\\n\\end{aligned}',
        note: 'Same idiom without the \\[...\\] wrapper, so it never becomes a math node; the remark pass catches it instead.',
      },
    ],
  },
  {
    group: 'Document-mode LaTeX (accepted loss)',
    blurb:
      'Measured as worse converted than left literal, so the island bridge deliberately skips them: array and center lose their meaning and tabular would need a header row guessed for it. \\& and \\% are left to CommonMark, whose backslash escapes already resolve them.',
    cases: [
      {
        id: 'g7',
        label: 'center',
        md: '\\begin{center}\nCentred thing\n\\end{center}',
      },
      {
        id: 'g8',
        label: 'array',
        md: '\\begin{array}{cc} a & b \\end{array}',
      },
      {
        id: 'g9',
        label: 'escaped & and %',
        md: 'Cost \\& tax \\%',
      },
      {
        id: 'g4',
        label: 'tabular',
        md: '\\begin{tabular}{|c|c|}\\hline Name & Age \\\\ \\hline Bob & 42 \\\\ \\hline\\end{tabular}',
      },
    ],
  },
  {
    group: 'Real reported failures',
    blurb:
      'Reconstructed from actual customer reports and live assistant output.',
    cases: [
      {
        id: 'r1',
        label: 'Trivium — algebra walkthrough',
        md: 'We start with:\n\n$$ax^2 + bx + c = 0$$\n\nTo move the constant $c$ to the other side, we do the opposite of adding $c$ — we **subtract** $c$ from both sides:\n\n$$ax^2 + bx + c - c = 0 - c$$ The $c - c$ on the left cancels, leaving:\n\n$$ax^2 + bx = -c$$\n\nThat\u2019s Step 1.\n\n**Step 2:** We want the coefficient of $x^2$ to be 1 so we can complete the square. Right now it\u2019s $a$.',
        note: 'Customer-reported. Was a wall of red on the production build.',
      },
      {
        id: 'r2',
        label: 'Reaction Energetics',
        md: 'Done! I\u2019ve created a study note titled **Reaction Energetics** with all the required elements:\n\n✓ Exact sentence: "A reagent costs $12 and the range is $100-$200."\n✓ Inline math: \\(E = mc^2\\)\n✓ Display equation: \\[\\Delta G = \\Delta H - T\\Delta S\\]\n✓ Chemistry notation: $\\ce{H2O}$ and $\\ce{SO4^2-}$\n✓ Two-item numbered list under "Steps in Thermodynamic Analysis"\n\nThe file has been saved to your workspace as `Reaction_Energetics_Study_Note.md`.',
        note: 'Live output that previously swallowed the prose into one math span.',
      },
      {
        id: 'r3',
        label: 'Costing reply',
        md: 'Here\u2019s the breakdown:\n\n1. **Setup cost** — roughly $2,500 up front\n  - Hardware: $1,800\n  - Licensing: $700\n2. **Running cost** — about $95/month\n\nThe payback period is \\(P = \\frac{C}{S - M}\\), where $C$ is capital cost.\n\n$$P = \\frac{2500}{400 - 95} \\approx 8.2 \\text{ months}$$\n\n| Option | Upfront | Monthly |\n| --- | --- | --- |\n| Basic | $2,500 | $95 |\n| Pro | $4,000 | $150 |\n\n```python\npayback = capital / (savings - maintenance)\nprint(f"${payback:.1f} months")\n```',
      },
      {
        id: 'r4',
        label: 'Twenty probes pasted as one paragraph',
        md: 'a. Other currencies: €5-€10, £20-£30, ¥100-¥200, and $5-$10.\nb. Escaped already: I paid \\$5 and \\$10 today.\nc. Dollar at very start: $5 is the price.\nd. Only a dollar sign: $\ne. Double dollar inline: price is $$5 here.\nf. Triple: $$$5\ng. Dollar then letter: $abc and $xyz\nh. Dollar then space then digit: $ 5 and $ 10\ni. Negative: -$5 to -$10\nj. Thousands: $1,000,000 and $2,500.75\nk. Percent: 50% off $20, tax is 8.5%\nl. Math with underscores: $a_1 + b_2$ and $c_3$\nm. Math with asterisk: $a * b$ and $x \\cdot y$\nn. Consecutive math: $a$$b$ and $x$ $y$\no. Currency then math no space: $5$x + 1$\np. Very long money: $999,999,999,999.99\nq. Zero: $0 and $0.00\nr. Trailing: cost is $5.\ns. Bold money: **$5** and *$10*\nt. Money in code: `$5` and `$x$`',
        note: 'Issue #2441. No blank lines, so all twenty are ONE paragraph: line e\u2019s $$ used to pair with line n\u2019s, swallowing f\u2013m.',
      },
    ],
  },
  {
    group: 'Ordinary markdown',
    blurb: 'Must be untouched by any of the above.',
    cases: [
      {
        id: 'o1',
        label: 'Headings / emphasis / quote / link',
        md: '# Heading 1\n## Heading 2\n\nSome **bold** and *italic* and `code`.\n\n> A blockquote\n\n[a link](https://example.com)',
      },
      {
        id: 'o2',
        label: 'Escapes',
        md: 'Escapes: \\# not a heading, \\_word\\_ not italics.',
      },
      {
        id: 'o3',
        label: 'Plain table',
        md: '| a | b |\n| --- | --- |\n| 1 | 2 |',
      },
    ],
  },
  {
    group: 'Legacy corpus — whole-line $$ display promotion',
    blurb:
      'The `$$…$$` line the old pass rewrote into a fenced display block so remark-math would see a block rather than inline maths. @ziloen/remark-math promotes it itself.',
    cases: [
      {
        id: 'L146',
        label:
          'expands a line consisting solely of $$...$$ into the fenced display form',
        md: '$$3x + 5 = 3(4) + 5$$',
        note: 'MATCH',
      },
      {
        id: 'L147',
        label:
          'expands a line consisting solely of $$...$$ into the fenced display form',
        md: '  $$ x = 4 $$  ',
        note: 'MATCH',
      },
      {
        id: 'L148',
        label:
          'separates promoted blocks from adjacent prose and from each other',
        md: 'Steps:\n$$a + b$$\n$$c + d$$\nDone.',
        note: 'MATCH — block spacing only',
      },
      {
        id: 'L149',
        label: 'promotes the adjacent-$$-lines payload from the issue report',
        md: '$$\\text{Step 1: Substitute } x = 4 \\text{ into the expression}$$\n$$3x + 5 = 3(4) + 5$$\n\n$$\\text{Step 2: Multiply first (order of operations)}$$\n$$3(4) + 5 = 12 + 5$$',
        note: 'MATCH — block spacing only',
      },
      {
        id: 'L150',
        label:
          'keeps a whole-line $$\\text{...}$$ annotation as display math, not prose',
        md: '$$\\text{Step 2: Multiply first (order of operations)}$$',
        note: 'MATCH',
      },
      {
        id: 'L151',
        label:
          'keeps a whole-line $$\\text{...}$$ annotation as display math, not prose',
        md: '  $$\\textrm{note}$$',
        note: 'MATCH',
      },
      {
        id: 'L154',
        label:
          'keeps a whole-line $$\\text{...}$$ annotation as display math, not prose',
        md: 'see $$\\text{this note}$$ here',
        note: 'INTENTIONAL — a display span whose body is a PLAIN-text command is a centred annotation and stays maths',
      },
      {
        id: 'L155',
        label: 'leaves the multi-line fenced form untouched',
        md: '$$\nE = mc^2\n$$',
        note: 'MATCH',
      },
      {
        id: 'L156',
        label: 'leaves the multi-line fenced form untouched',
        md: 'intro\n\n  $$\n  E = mc^2\n  $$\n\nafter',
        note: 'MATCH',
      },
      {
        id: 'L157',
        label: 'does not promote a $$...$$ span sharing its line with prose',
        md: 'Matrix: $$\\begin{pmatrix}1 & 2\\end{pmatrix}$$ as shown.',
        note: 'MATCH',
      },
      {
        id: 'L158',
        label:
          'preserves indentation so a promoted block stays inside its list item',
        md: '- item\n  $$x + y = z$$\n- next',
        note: 'INTENTIONAL — tight-list shape',
      },
      {
        id: 'L159',
        label:
          'preserves indentation so a promoted block stays inside its list item',
        md: '1. item\n   $$x + y$$',
        note: 'INTENTIONAL — tight-list shape',
      },
      {
        id: 'L160',
        label: 'leaves degenerate and empty spans alone',
        md: '$$ $$',
        note: 'MATCH',
      },
      {
        id: 'L161',
        label: 'leaves degenerate and empty spans alone',
        md: '$$\n',
        note: 'MATCH',
      },
      {
        id: 'L162',
        label: 'does not promote $$ lines inside fenced code',
        md: '```\n$$x + y$$\n```',
        note: 'MATCH',
      },
      {
        id: 'L163',
        label: 'promotes a whole-line \\[...\\] to the fenced display form',
        md: '\\[E = mc^2\\]',
        note: 'MATCH',
      },
      {
        id: 'L164',
        label: 'promotes a whole-line \\[...\\] to the fenced display form',
        md: '- item\n  \\[x + y = z\\]\n- next',
        note: 'INTENTIONAL — tight-list shape',
      },
      {
        id: 'L165',
        label: 'promotes a whole-line \\[...\\] to the fenced display form',
        md: 'Steps:\n\\[a + b\\]\n\\[c + d\\]\nDone.',
        note: 'MATCH — block spacing only',
      },
      {
        id: 'L166',
        label:
          'keeps mid-sentence \\[...\\] and inline \\(...\\) at their current shape',
        md: 'so \\[E = mc^2\\] holds',
        note: 'MATCH',
      },
      {
        id: 'L167',
        label:
          'keeps mid-sentence \\[...\\] and inline \\(...\\) at their current shape',
        md: '\\(E = mc^2\\)',
        note: 'MATCH',
      },
      {
        id: 'L168',
        label:
          'keeps mid-sentence \\[...\\] and inline \\(...\\) at their current shape',
        md: '\\[a\\] and \\[b\\]',
        note: 'MATCH',
      },
      {
        id: 'L169',
        label:
          'leaves the multi-line \\[ ... \\] form to the general conversion',
        md: '\\[\nE = mc^2\n\\]',
        note: 'MATCH',
      },
      {
        id: 'L170',
        label: 'does not promote \\[ lines inside fenced code',
        md: '```\n\\[x + y\\]\n```',
        note: 'MATCH',
      },
    ],
  },
  {
    group: 'Legacy corpus — tabular and array',
    blurb:
      'Grid environments. Measured as worse converted than left literal, so the island bridge skips them; inside `\\[…\\]` KaTeX owns the span and reports `tabular`.',
    cases: [
      {
        id: 'L171',
        label: 'converts tabular wrapped in $$...$$ to a markdown table',
        md: '$$\\begin{tabular}{cc}\\hline\nName & Age \\\\\nAlice & 30 \\\\\n\\hline\\end{tabular}$$',
        note: 'INTENTIONAL — tabular is an accepted loss',
      },
      {
        id: 'L172',
        label: 'converts standalone tabular blocks to a markdown table',
        md: '\\begin{tabular}{cc}\nA & B \\\\\nC & D\\end{tabular}',
        note: 'INTENTIONAL — tabular is an accepted loss',
      },
      {
        id: 'L173',
        label: 'converts array wrapped in \\[...\\] to a markdown table',
        md: '\\[\\begin{array}{cc}1 & 2 \\\\ 3 & 4\\end{array}\\]',
        note: 'INTENTIONAL — array typesets as real KaTeX maths instead of becoming a table',
      },
      {
        id: 'L174',
        label: 'converts array wrapped in $$...$$ to a markdown table',
        md: '$$\\begin{array}{cc}5 & 6 \\\\ 7 & 8\\end{array}$$',
        note: 'INTENTIONAL — array typesets as real KaTeX maths instead of becoming a table',
      },
      {
        id: 'L175',
        label: 'converts standalone array blocks to a markdown table',
        md: '\\begin{array}{cc}9 & 10 \\\\ 11 & 12\\end{array}',
        note: 'INTENTIONAL — array is an accepted loss',
      },
    ],
  },
  {
    group: 'Legacy corpus — preprocessLaTeX',
    blurb:
      'Every input the deleted 675-line preprocessor’s 103 unit tests fed it, rendered through the pipeline that replaced it. Each is labelled with how the new render compares to `render(preprocessLaTeX(input))`: MATCH, BETTER, INTENTIONAL (a decision this branch made) or GAP (still worse).',
    cases: [
      {
        id: 'L0',
        label: 'should escape currency dollar signs',
        md: 'Price is $5',
        note: 'MATCH',
      },
      {
        id: 'L1',
        label: 'should escape currency dollar signs',
        md: '$100 total',
        note: 'MATCH',
      },
      {
        id: 'L2',
        label: 'should not corrupt block math delimiters when digits follow $$',
        md: '$$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$$',
        note: 'MATCH',
      },
      {
        id: 'L3',
        label: 'should preserve block math delimiters with a leading space',
        md: '$$ 0.075 \\text{ L} = 75 \\text{ mL}$$',
        note: 'MATCH',
      },
      {
        id: 'L4',
        label: 'should not corrupt inline math delimiters when digits follow $',
        md: '$250 \\text{ mL} \\times \\frac{1 \\text{ L}}{1000 \\text{ mL}}$',
        note: 'MATCH',
      },
      {
        id: 'L5',
        label: 'should leave backslash-led math untouched',
        md: '$\\frac{5}{5} = 1$',
        note: 'MATCH',
      },
      {
        id: 'L6',
        label: 'should leave backslash-led math untouched',
        md: '$$\\frac{1 \\text{ L}}{1000 \\text{ mL}}$$',
        note: 'MATCH',
      },
      {
        id: 'L7',
        label: 'should escape currency but keep an adjacent math block intact',
        md: 'It costs $5. Here: $$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$$',
        note: 'MATCH',
      },
      {
        id: 'L8',
        label: 'should treat backslash-free dollar spans as currency',
        md: 'I have $5 and $10',
        note: 'MATCH',
      },
      {
        id: 'L9',
        label:
          'should preserve backslash-free inline arithmetic math (issue #2109)',
        md: '$3x + 5$',
        note: 'MATCH',
      },
      {
        id: 'L10',
        label:
          'should preserve backslash-free inline arithmetic math (issue #2109)',
        md: '$5$',
        note: 'MATCH',
      },
      {
        id: 'L11',
        label:
          'should preserve backslash-free inline arithmetic math (issue #2109)',
        md: '$3(4) + 5$',
        note: 'MATCH',
      },
      {
        id: 'L12',
        label:
          'should preserve backslash-free inline arithmetic math (issue #2109)',
        md: '$2x + 6$',
        note: 'MATCH',
      },
      {
        id: 'L13',
        label:
          'should preserve backslash-free inline arithmetic math (issue #2109)',
        md: '$3x$',
        note: 'MATCH',
      },
      {
        id: 'L14',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\textbf{Custom AI Agents}$',
        note: 'MATCH',
      },
      {
        id: 'L15',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\text{ibl.ai}$',
        note: 'MATCH',
      },
      {
        id: 'L16',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\textit{RAG Training}$',
        note: 'MATCH',
      },
      {
        id: 'L17',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\emph{note}$',
        note: 'MATCH',
      },
      {
        id: 'L18',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\texttt{code}$',
        note: 'MATCH',
      },
      {
        id: 'L19',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\underline{underlined}$',
        note: 'INTENTIONAL — \\underline maps to <em>: Streamdown’s sanitizer drops <u> outright',
      },
      {
        id: 'L20',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\textrm{plain}$',
        note: 'MATCH',
      },
      {
        id: 'L21',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\textsf{sans}$',
        note: 'MATCH',
      },
      {
        id: 'L22',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\textnormal{normal}$',
        note: 'MATCH',
      },
      {
        id: 'L23',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$$\\textbf{Enterprise Management}$$',
        note: 'MATCH',
      },
      {
        id: 'L24',
        label:
          'should unwrap dollar-wrapped text styling commands (issue #2109)',
        md: '$\\textbf{Canvas \\& Artifacts}$',
        note: 'MATCH',
      },
      {
        id: 'L25',
        label:
          'must not let a styling unwrap straddle newlines and eat structure (issue #2109 regression)',
        md: '**Given:** Evaluate $3x + 5$ when $x = 4$\n\n**Step 1: Write the original expression**\n$$3x + 5$$\n\n**Step 2: Substitute $x = 4$**\n$$3(4) + 5$$',
        note: 'MATCH — block spacing only',
      },
      {
        id: 'L26',
        label:
          'should unwrap Markdown bold trapped inside dollar delimiters (issue #2109)',
        md: '$**Custom AI Agents**$',
        note: 'MATCH',
      },
      {
        id: 'L27',
        label:
          'should unwrap Markdown bold trapped inside dollar delimiters (issue #2109)',
        md: '$$**Enterprise Management**$$',
        note: 'MATCH',
      },
      {
        id: 'L28',
        label:
          'should unwrap Markdown bold trapped inside dollar delimiters (issue #2109)',
        md: '__underscored bold__ outside stays: $__b__$',
        note: 'MATCH',
      },
      {
        id: 'L29',
        label:
          'should unwrap Markdown bold trapped inside dollar delimiters (issue #2109)',
        md: '* $**Canvas & Artifacts**$: rich documents.',
        note: 'MATCH',
      },
      {
        id: 'L30',
        label:
          'should unwrap Markdown bold trapped inside dollar delimiters (issue #2109)',
        md: '$a * b$',
        note: 'MATCH',
      },
      {
        id: 'L31',
        label:
          'should unwrap Markdown bold trapped inside dollar delimiters (issue #2109)',
        md: '$x_1 + x_2$',
        note: 'MATCH',
      },
      {
        id: 'L32',
        label:
          'should unwrap styling wrappers in a realistic feature list (issue #2109)',
        md: '* $\\textbf{Custom AI Agents}$: Create agents.\n* $\\textbf{Canvas \\& Artifacts}$: Generate documents.',
        note: 'MATCH',
      },
      {
        id: 'L33',
        label:
          'should NOT unwrap real math that merely contains a text command (issue #2109)',
        md: '$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$',
        note: 'MATCH',
      },
      {
        id: 'L34',
        label:
          'should NOT unwrap real math that merely contains a text command (issue #2109)',
        md: 'The $\\textbf{Pro}$ plan costs $5.',
        note: 'MATCH',
      },
      {
        id: 'L35',
        label:
          'should keep inline math intact while still escaping real currency',
        md: 'The term $3x$ evaluates. I have $5 and $10 in cash.\n\n$$3x + 5$$',
        note: 'MATCH',
      },
      {
        id: 'L36',
        label:
          'should not let a leading currency amount swallow a following math span',
        md: 'the kit costs $12, and the formula $3x + 5$ gives the price.',
        note: 'MATCH',
      },
      {
        id: 'L37',
        label:
          'should not let a leading currency amount swallow a following math span',
        md: 'a $50 item at $x\\%$ off saves $50 \\times x/100$ dollars.',
        note: 'BETTER — old unescaped \\% inside the span, so KaTeX read it as a comment and ate the rest; the % survives now',
      },
      {
        id: 'L38',
        label:
          'should not let a leading currency amount swallow a following math span',
        md: 'it was $20, dropped to $12, and $x - 8$ is the discount.',
        note: 'MATCH',
      },
      {
        id: 'L39',
        label: 'keeps price ranges literal regardless of the separator',
        md: 'tickets are $5-$10 today',
        note: 'MATCH',
      },
      {
        id: 'L40',
        label: 'keeps price ranges literal regardless of the separator',
        md: 'seats cost $5 - $10 each',
        note: 'MATCH',
      },
      {
        id: 'L41',
        label: 'keeps price ranges literal regardless of the separator',
        md: 'prices: $5, $10, $15.',
        note: 'MATCH',
      },
      {
        id: 'L42',
        label: 'keeps price ranges literal regardless of the separator',
        md: 'bands are $90,000-$120,000 by level',
        note: 'MATCH',
      },
      {
        id: 'L43',
        label: 'keeps price ranges literal regardless of the separator',
        md: 'k. Three amounts: $5-$10-$20',
        note: 'MATCH',
      },
      {
        id: 'L44',
        label:
          'should escape degenerate dollar runs instead of guessing at math',
        md: 'total: $$ ok',
        note: 'MATCH',
      },
      {
        id: 'L45',
        label:
          'should escape degenerate dollar runs instead of guessing at math',
        md: 'cost $ 5$ maybe',
        note: 'GAP — NOT FIXED: "$ 5$" still opens a span, so the dollars vanish; rare shape, and the boundary rule lives in the math parser',
      },
      {
        id: 'L46',
        label:
          'should escape degenerate dollar runs instead of guessing at math',
        md: '$a$$b$',
        note: 'BETTER — old escaped the whole run to literal text; the closing run now stops on match, giving two real spans',
      },
      {
        id: 'L47',
        label: 'should not pair an opening $ with a closing $ on a later line',
        md: 'price $5\nreal $x + 1$ here',
        note: 'MATCH',
      },
      {
        id: 'L48',
        label: 'should not escape already escaped dollar signs',
        md: 'Already \\$5 escaped',
        note: 'MATCH',
      },
      {
        id: 'L49',
        label:
          'rewrites \\$ inside converted \\(...\\) math so the span survives remark-math (issue #2109)',
        md: 'Example: TBS Source One. \\(\\sim\\$35\\)',
        note: 'MATCH — renders the same glyph; only the TeX annotation differs (\\$ vs \\text{\\textdollar})',
      },
      {
        id: 'L50',
        label:
          'rewrites \\$ inside a directly emitted $...$ span (issue #2109)',
        md: 'costs $\\sim\\$35$ each',
        note: 'MATCH — renders the same glyph; only the TeX annotation differs',
      },
      {
        id: 'L51',
        label:
          'keeps prose between two dollar-carrying spans out of math (issue #2109)',
        md: 'Estimated total: \\(\\$220\\text{–}310\\). With a new transmitter: \\(\\$330\\text{–}550\\).',
        note: 'MATCH — renders the same glyph; only the TeX annotation differs',
      },
      {
        id: 'L52',
        label: 'rewrites \\$ inside \\[...\\] display math (issue #2109)',
        md: 'so \\[\\$5 + \\$10\\] holds',
        note: 'MATCH — renders the same glyph; only the TeX annotation differs',
      },
      {
        id: 'L53',
        label: 'rewrites \\$ inside \\[...\\] display math (issue #2109)',
        md: '\\[\\$5\\]',
        note: 'MATCH — renders the same glyph; only the TeX annotation differs',
      },
      {
        id: 'L54',
        label:
          'leaves \\$ outside math untouched while fixing spans (issue #2109)',
        md: 'Already \\$5 escaped, math \\(\\$2\\) here',
        note: 'MATCH — renders the same glyph; only the TeX annotation differs',
      },
      {
        id: 'L55',
        label: 'should convert block LaTeX delimiters',
        md: '\\[x = 5\\]',
        note: 'MATCH',
      },
      {
        id: 'L56',
        label: 'should convert block LaTeX delimiters',
        md: '\\[ y = 10 \\]',
        note: 'MATCH',
      },
      {
        id: 'L57',
        label: 'should convert block LaTeX delimiters',
        md: 'so \\[x = 5\\] holds',
        note: 'MATCH',
      },
      {
        id: 'L58',
        label: 'should convert inline LaTeX delimiters',
        md: '\\(x = 5\\)',
        note: 'MATCH',
      },
      {
        id: 'L59',
        label: 'should convert inline LaTeX delimiters',
        md: '\\( y = 10 \\)',
        note: 'BETTER — old emitted "$ y = 10 $", which a space after the opener makes NOT math; it typesets now',
      },
      {
        id: 'L60',
        label: 'should convert textbf to markdown bold',
        md: '\\textbf{bold text}',
        note: 'MATCH',
      },
      {
        id: 'L61',
        label: 'should convert textit to markdown italic',
        md: '\\textit{italic text}',
        note: 'MATCH',
      },
      {
        id: 'L62',
        label: 'should convert emph to markdown italic',
        md: '\\emph{emphasized}',
        note: 'MATCH',
      },
      {
        id: 'L63',
        label: 'should convert texttt to code',
        md: '\\texttt{code}',
        note: 'MATCH',
      },
      {
        id: 'L64',
        label: 'should convert underline to HTML',
        md: '\\underline{underlined}',
        note: 'INTENTIONAL — \\underline maps to <em>: Streamdown’s sanitizer drops <u> outright',
      },
      {
        id: 'L65',
        label: 'should convert itemize to unordered list',
        md: '\\begin{itemize}\\item First\\item Second\\end{itemize}',
        note: 'INTENTIONAL — converted lists are tight (<li>text</li>), like every other list in a message',
      },
      {
        id: 'L66',
        label:
          'unwraps a display-math heading wrapping a lone styling command (issue #2109)',
        md: '\\[\n\\textbf{React Learning To-Do List (AI-Aware, Practical, 4–6 Weeks)}\n\\]\n\nIntro paragraph.',
        note: 'MATCH',
      },
      {
        id: 'L67',
        label:
          'unwraps an inline \\(...\\) span wrapping a lone styling command (issue #2109)',
        md: '\\(\\textbf{bold heading}\\)',
        note: 'MATCH',
      },
      {
        id: 'L68',
        label:
          'unwraps an inline \\(...\\) span wrapping a lone styling command (issue #2109)',
        md: '\\(\\emph{soft}\\)',
        note: 'MATCH',
      },
      {
        id: 'L69',
        label:
          'keeps a display-math plain-text annotation as a display block (issue #2109)',
        md: '\\[\n\\text{Step 2: Multiply}\n\\]',
        note: 'MATCH',
      },
      {
        id: 'L70',
        label:
          'leaves \\textbf intact inside genuine math instead of injecting ** (issue #2109)',
        md: 'so \\[ \\textbf{F} = ma \\] holds',
        note: 'MATCH',
      },
      {
        id: 'L71',
        label:
          'converts itemize nested inside itemize without leaking raw tokens (issue #2109)',
        md: '\\begin{itemize}\n  \\item Deliverables:\n    \\begin{itemize}\n      \\item README with tradeoffs.\n      \\item Coverage summary.\n    \\end{itemize}\n  \\item Ship it.\n\\end{itemize}',
        note: 'BETTER — old flattened the nested list into one <ul>; the nesting survives now',
      },
      {
        id: 'L72',
        label:
          'converts verbatim environments to fenced code and shields the body (issue #2109)',
        md: 'Code kata:\n\\begin{verbatim}\nconst price = "$5"; // 10% off\n\\end{verbatim}\nDone.',
        note: 'MATCH — block spacing only',
      },
      {
        id: 'L73',
        label:
          'strips a display-math wrapper around an itemize so it converts to a real list (issue #2109)',
        md: '\\[\n\\begin{itemize}\n\\item \\textbf{Why:} spatial reasoning.\n\\item \\textbf{Core skills:} layout and joinery.\n\\end{itemize}\n\\]',
        note: 'INTENTIONAL — restored as a list; the residual difference is the tight-list shape',
      },
      {
        id: 'L74',
        label:
          'strips the wrapper even when the list self-nests, keeping inline math intact (issue #2109)',
        md: '\\[\n\\begin{itemize}\n\\item \\textbf{Overlap:}\n  \\begin{itemize}\n    \\item \\textit{Tolerances:} wood (\\(\\alpha\\) varies).\n  \\end{itemize}\n\\item \\textbf{Safety:} push sticks.\n\\end{itemize}\n\\]',
        note: 'INTENTIONAL — restored as a nested list; residual difference is the tight-list shape (and old flattened it)',
      },
      {
        id: 'L75',
        label: 'strips a $$-wrapped enumerate the same way (issue #2109)',
        md: '$$\n\\begin{enumerate}\n\\item First step.\n\\item Second step.\n\\end{enumerate}\n$$',
        note: 'INTENTIONAL — restored as a list; the residual difference is the tight-list shape',
      },
      {
        id: 'L76',
        label:
          'converts \\[-wrapped aligned environments of \\verb rows to a fenced code block (issue #2109)',
        md: 'Create Counter.tsx:\n\\[\n\\begin{aligned}\n&\\verb|import { useState } from "react";|\\\\\n&\\verb|  const [count, setCount] = useState(initial);|\\\\\n&\\verb|}|\\\\\n\\end{aligned}\n\\]\nDone.',
        note: 'MATCH — block spacing only',
      },
      {
        id: 'L77',
        label:
          'keeps the list-item indent when an aligned \\verb block is nested in a list (issue #2109)',
        md: '- Files and code:\n  - Create App.tsx:\n    \\[\n    \\begin{aligned}\n    &\\verb|const a = 1;|\\\\\n    &\\verb|const b = 2;|\\\\\n    \\end{aligned}\n    \\]',
        note: 'INTENTIONAL — tight-list shape',
      },
      {
        id: 'L78',
        label:
          'converts bare and $$-wrapped aligned \\verb environments too (issue #2109)',
        md: '\\begin{aligned}\n&\\verb|<TodoCard />|\\\\\n\\end{aligned}',
        note: 'MATCH',
      },
      {
        id: 'L79',
        label:
          'converts bare and $$-wrapped aligned \\verb environments too (issue #2109)',
        md: '$$\n\\begin{aligned}\n&\\verb|npm run dev|\\\\\n\\end{aligned}\n$$',
        note: 'MATCH',
      },
      {
        id: 'L80',
        label: 'leaves genuine aligned math environments alone (issue #2109)',
        md: '\\[\n\\begin{aligned}\nx &= y + 1\\\\\nz &= 2x\\\\\n\\end{aligned}\n\\]',
        note: 'MATCH',
      },
      {
        id: 'L81',
        label: 'leaves genuine aligned math environments alone (issue #2109)',
        md: '\\[\n\\begin{aligned}\n&\\verb|const a = 1;|\\\\\nx &= y\\\\\n\\end{aligned}\n\\]',
        note: 'BETTER — old rewrote \\verb to backticks inside the math, so KaTeX typeset the quote marks',
      },
      {
        id: 'L82',
        label: 'should convert enumerate to ordered list',
        md: '\\begin{enumerate}\\item First\\item Second\\end{enumerate}',
        note: 'INTENTIONAL — tight-list shape',
      },
      {
        id: 'L83',
        label:
          'should strip an existing markdown marker before prepending the list marker (issue #2109)',
        md: '\\begin{itemize}\n\\item - First point\n\\item * Second point\n\\end{itemize}',
        note: 'INTENTIONAL — a markdown marker after \\item is escaped and kept visible, not stripped',
      },
      {
        id: 'L84',
        label:
          'should strip an existing markdown marker before prepending the list marker (issue #2109)',
        md: '\\begin{enumerate}\n\\item 1. First\n\\item 2) Second\n\\end{enumerate}',
        note: 'INTENTIONAL — a markdown marker after \\item is escaped and kept visible, not stripped',
      },
      {
        id: 'L85',
        label:
          'does not strip emphasis or negative numbers when cleaning item markers',
        md: '\\begin{itemize}\n\\item *emphasis* stays\n\\item -5 degrees\n\\end{itemize}',
        note: 'INTENTIONAL — tight-list shape',
      },
      {
        id: 'L86',
        label:
          'converts complete items of an unclosed itemize during streaming (issue #2109)',
        md: 'Intro:\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\item Third po',
        note: 'INTENTIONAL — streaming items restored; the residual difference is the tight-list shape',
      },
      {
        id: 'L87',
        label:
          'converts complete items of an unclosed enumerate during streaming (issue #2109)',
        md: '\\begin{enumerate}\n\\item First step\n\\item Second step\n\\item Thi',
        note: 'INTENTIONAL — streaming items restored; the residual difference is the tight-list shape',
      },
      {
        id: 'L88',
        label:
          'drops a bare unclosed \\begin{itemize} once its line is complete',
        md: '\\begin{itemize}\n',
        note: 'MATCH',
      },
      {
        id: 'L89',
        label:
          'drops a bare unclosed \\begin{itemize} once its line is complete',
        md: '\\begin{itemize}',
        note: 'MATCH',
      },
      {
        id: 'L90',
        label: 'converts an unclosed itemize whose tail ends on a newline',
        md: '\\begin{itemize}\n\\item First point\n\\item Second point\n',
        note: 'INTENTIONAL — streaming items restored; the residual difference is the tight-list shape',
      },
      {
        id: 'L91',
        label:
          'converts the available lines of an unclosed quote and center during streaming',
        md: '\\begin{quote}\nwise words\npartial li',
        note: 'INTENTIONAL — streaming quote restored; the trailing partial line is its own paragraph now',
      },
      {
        id: 'L92',
        label:
          'converts the available lines of an unclosed quote and center during streaming',
        md: '\\begin{quote}\n',
        note: 'MATCH',
      },
      {
        id: 'L93',
        label:
          'converts the available lines of an unclosed quote and center during streaming',
        md: '\\begin{quote}',
        note: 'MATCH',
      },
      {
        id: 'L94',
        label:
          'converts the available lines of an unclosed quote and center during streaming',
        md: '\\begin{center}',
        note: 'MATCH',
      },
      {
        id: 'L95',
        label:
          'converts the available lines of an unclosed quote and center during streaming',
        md: '\\begin{center}\ncentered text\npartial',
        note: 'INTENTIONAL — center is an accepted loss: it has no markdown meaning to convert to',
      },
      {
        id: 'L96',
        label:
          'converts the available lines of an unclosed quote and center during streaming',
        md: '\\begin{center}\n',
        note: 'INTENTIONAL — center is an accepted loss',
      },
      {
        id: 'L97',
        label:
          'still converts a completed environment exactly as before streaming support',
        md: 'Intro:\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\end{itemize}\nOutro.',
        note: 'INTENTIONAL — tight-list shape',
      },
      {
        id: 'L98',
        label:
          'leaves an unclosed environment raw when a mismatched \\end is present',
        md: '\\begin{itemize}\n\\item a\n\\end{enumerate}\n',
        note: 'MATCH',
      },
      {
        id: 'L99',
        label:
          'wraps a prose mention of \\begin{aligned} in inline code (issue #2109)',
        md: '- **Display equation with \\begin{aligned}** showing search and indexing time complexity',
        note: 'GAP — NOT FIXED: a prose mention of \\begin{aligned} is no longer set in monospace; the text itself is intact',
      },
      {
        id: 'L100',
        label: 'wraps a prose \\begin/\\end mention pair in inline code',
        md: 'Use \\begin{aligned} and \\end{aligned} to align.',
        note: 'GAP — NOT FIXED: prose \\begin/\\end mentions lose only their monospace',
      },
      {
        id: 'L101',
        label: 'wraps a prose \\begin/\\end mention pair in inline code',
        md: '\\begin{aligned}\\end{aligned}',
        note: 'GAP — NOT FIXED: prose \\begin/\\end mentions lose only their monospace',
      },
      {
        id: 'L102',
        label:
          'renders the streaming head of an unclosed $$ aligned block as inline code',
        md: '$$\n\\begin{aligned}\nT_s &= O(\\log n) \\\\',
        note: 'GAP — NOT FIXED: the streaming head of an unclosed $$ block keeps its trailing backslash',
      },
      {
        id: 'L103',
        label: 'never touches \\begin/\\end inside masked math (issue #2109)',
        md: '$$\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}$$',
        note: 'MATCH',
      },
      {
        id: 'L104',
        label: 'never touches \\begin/\\end inside masked math (issue #2109)',
        md: '$$\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}$$',
        note: 'MATCH',
      },
      {
        id: 'L105',
        label: 'never touches \\begin/\\end inside masked math (issue #2109)',
        md: '$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$',
        note: 'MATCH',
      },
      {
        id: 'L106',
        label: 'never touches \\begin/\\end inside masked math (issue #2109)',
        md: '\\[\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}\\]',
        note: 'MATCH',
      },
      {
        id: 'L107',
        label: 'never touches \\begin/\\end inside masked math (issue #2109)',
        md: '\\(\\begin{pmatrix}1\\end{pmatrix}\\)',
        note: 'MATCH',
      },
      {
        id: 'L108',
        label: 'should convert quote to blockquote',
        md: '\\begin{quote}quoted text\\end{quote}',
        note: 'MATCH',
      },
      {
        id: 'L109',
        label: 'should convert center to centered div',
        md: '\\begin{center}centered\\end{center}',
        note: 'INTENTIONAL — center is an accepted loss',
      },
      {
        id: 'L110',
        label: 'should convert section to markdown heading',
        md: '\\section{Title}',
        note: 'MATCH',
      },
      {
        id: 'L111',
        label: 'should convert starred section to markdown heading',
        md: '\\section*{Heading One}',
        note: 'MATCH',
      },
      {
        id: 'L112',
        label: 'should convert subsection to markdown heading',
        md: '\\subsection{Subtitle}',
        note: 'MATCH',
      },
      {
        id: 'L113',
        label: 'should convert starred subsection to markdown heading',
        md: '\\subsection*{Core Evidence}',
        note: 'MATCH',
      },
      {
        id: 'L114',
        label: 'should convert subsubsection to markdown heading',
        md: '\\subsubsection{Sub-subtitle}',
        note: 'MATCH',
      },
      {
        id: 'L115',
        label: 'should convert starred subsubsection to markdown heading',
        md: '\\subsubsection*{Deep Heading}',
        note: 'MATCH',
      },
      {
        id: 'L116',
        label: 'should convert line breaks',
        md: 'line1\\\\line2',
        note: 'GAP — NOT FIXED: "\\\\" is CommonMark’s escape for one literal backslash and the parsed text node cannot tell the two apart',
      },
      {
        id: 'L117',
        label: 'should convert line breaks',
        md: 'line1\n\\newlineline2',
        note: 'GAP — NOT FIXED: \\newline is not converted to a hard break',
      },
      {
        id: 'L121',
        label: 'must not rewrite \\\\ row separators inside math (issue #2109)',
        md: '$a \\\\ b$',
        note: 'MATCH',
      },
      {
        id: 'L122',
        label: 'must not rewrite \\\\ row separators inside math (issue #2109)',
        md: 'first line\\\\second line\n$$x &= 1 \\\\ y$$',
        note: 'GAP — NOT FIXED: prose "\\\\" is not converted to a hard break',
      },
      {
        id: 'L123',
        label: 'should convert verb to code',
        md: '\\verb|code|',
        note: 'MATCH',
      },
      {
        id: 'L124',
        label: 'should convert LaTeX quotes',
        md: "``quoted text''",
        note: 'GAP — NOT FIXED: the ``...’’ quote idiom stays literal; rewriting ’’ in prose would hit real apostrophe pairs',
      },
      {
        id: 'L125',
        label: 'should convert LaTeX quotes',
        md: "''quoted''",
        note: 'GAP — NOT FIXED: the ’’...’’ quote idiom stays literal',
      },
      {
        id: 'L126',
        label: 'should leave an unclosed streaming fence alone',
        md: '```python\n# streaming\nprice = "$5"',
        note: 'MATCH',
      },
      {
        id: 'L127',
        label: 'should leave an unclosed streaming fence alone',
        md: 'Intro text\n```python\n# streaming\nprice = "$5"',
        note: 'MATCH',
      },
      {
        id: 'L128',
        label: 'should leave a double-backtick code span alone',
        md: '``quoted``',
        note: 'MATCH',
      },
      {
        id: 'L129',
        label: 'should leave a double-backtick code span alone',
        md: '```js\nconst x = 10;\n```',
        note: 'MATCH',
      },
      {
        id: 'L130',
        label:
          'should unescape only the LaTeX escapes CommonMark cannot render',
        md: '\\&',
        note: 'MATCH',
      },
      {
        id: 'L131',
        label:
          'should unescape only the LaTeX escapes CommonMark cannot render',
        md: '\\%',
        note: 'MATCH',
      },
      {
        id: 'L132',
        label:
          'should unescape only the LaTeX escapes CommonMark cannot render',
        md: '\\#',
        note: 'MATCH',
      },
      {
        id: 'L133',
        label:
          'should unescape only the LaTeX escapes CommonMark cannot render',
        md: '\\_',
        note: 'MATCH',
      },
      {
        id: 'L134',
        label:
          'should unescape only the LaTeX escapes CommonMark cannot render',
        md: '\\# escaped hash',
        note: 'MATCH',
      },
      {
        id: 'L135',
        label:
          'should unescape only the LaTeX escapes CommonMark cannot render',
        md: '\\_word\\_',
        note: 'MATCH',
      },
      {
        id: 'L136',
        label: 'should handle complex LaTeX document',
        md: '\\section{Title}\\textbf{Bold} and \\textit{italic}\\\\\\item Test',
        note: 'GAP — NOT FIXED: the "\\\\" inside it is not converted to a hard break; the \\section and styling commands are',
      },
      {
        id: 'L137',
        label: 'should convert tabular to markdown table',
        md: '\\begin{tabular}{|c|c|c|}\\hline Name & Age & City \\\\\\hline Alice & 30 & NYC \\\\\\hline\\end{tabular}',
        note: 'INTENTIONAL — tabular is an accepted loss: markdown cannot express an alignment grid without guessing a header row',
      },
      {
        id: 'L138',
        label: 'should convert tabular without hline',
        md: '\\begin{tabular}{ccc}Header1 & Header2 & Header3 \\\\Row1 & Row2 & Row3\\end{tabular}',
        note: 'INTENTIONAL — tabular is an accepted loss',
      },
      {
        id: 'L139',
        label: 'should convert array to markdown table',
        md: '\\begin{array}{cc}A & B \\\\C & D\\end{array}',
        note: 'INTENTIONAL — array is an accepted loss',
      },
      {
        id: 'L140',
        label: 'should handle empty tabular gracefully',
        md: '\\begin{tabular}{|c|}\\end{tabular}',
        note: 'INTENTIONAL — tabular is an accepted loss',
      },
      {
        id: 'L141',
        label: 'should handle tabular with only hlines',
        md: '\\begin{tabular}{|c|}\\hline\\hline\\end{tabular}',
        note: 'INTENTIONAL — tabular is an accepted loss',
      },
      {
        id: 'L142',
        label: 'should convert tabular inside \\[...\\] math delimiters',
        md: '\\[\\begin{tabular}{lcc}A & B & C \\\\D & E & F\\end{tabular}\\]',
        note: 'MATCH — tabular is rebuilt as a real markdown table, the column spec supplying the alignment',
      },
      {
        id: 'L143',
        label: 'should convert \\text{} to plain text in tables',
        md: '\\[\\begin{tabular}{lc}\\text{Disease} & \\text{Count} \\\\\\text{Yes} & 42\\end{tabular}\\]',
        note: 'MATCH — \\text{} cells unwrap to their words',
      },
      {
        id: 'L144',
        label: 'should convert {,} thousands separator in tables',
        md: '\\[\\begin{tabular}{lr}\\text{Cases} & 12{,}500 \\\\\\text{Total} & 100{,}000\\end{tabular}\\]',
        note: "MATCH — {,} reads as LaTeX's thousands separator",
      },
      {
        id: 'L145',
        label: 'should handle real-world epidemiology table',
        md: '\\[\n\\begin{tabular}{lccc}\n\\hline\n & \\text{Disease} & \\text{No Disease} & \\text{Total} \\\\\n\\hline\n\\text{Exposed} & 42 & 158 & 200 \\\\\n\\text{Unexposed} & 18 & 182 & 200 \\\\\n\\hline\n\\end{tabular}\n\\]',
        note: 'MATCH — \\hline rules dropped, first row the header, empty leading cell kept',
      },
    ],
  },
  {
    group: 'Agent Taha — real production messages',
    blurb:
      "The messages from the user's Agent Taha mentor (118 assistant replies, 77 sessions) that rendered wrong before issue #2441. A blank line inside an environment tore it in two; a paragraph of prose in \\[...\\] had every space dropped by KaTeX.",
    cases: [
      {
        id: 'T1',
        label: 'Agent Taha #116 — F1 weekend structure',
        md: '\\[\n\\textbf{F1 weekend session structure and typical timings (local circuit time)}\n\\]\n\n\\[\n\\begin{itemize}\n  \\item \\textbf{Standard Grand Prix weekend}\n    \\begin{itemize}\n      \\item \\textbf{Free Practice 1 (FP1):} 60 minutes\n      \\item \\textbf{Free Practice 2 (FP2):} 60 minutes\n      \\item \\textbf{Free Practice 3 (FP3):} 60 minutes\n      \\item \\textbf{Qualifying:} \\approx 60 minutes total\n        \\begin{itemize}\n          \\item Q1: 18 minutes, bottom 5 eliminated (20 → 15)\n          \\item Q2: 15 minutes, bottom 5 eliminated (15 → 10)\n          \\item Q3: 12 minutes, top‑10 shootout for pole\n        \\end{itemize}\n      \\item \\textbf{Race (Grand Prix):} \\approx 305 km (except Monaco \\approx 260 km)\n        \\begin{itemize}\n          \\item Typical duration: 1h 30m–2h\n          \\item Maximum green‑flag race time: 2h (overall event window cap: 3h)\n        \\end{itemize}\n    \\end{itemize}\n\n  \\item \\textbf{Sprint weekend format} (at selected events)\n    \\begin{itemize}\n      \\item \\textbf{Friday:} FP1 (60m), Sprint Qualifying (shorter, multi‑segment session)\n        \\begin{itemize}\n          \\item Typical segments: SQ1 \\approx 12m, SQ2 \\approx 10m, SQ3 \\approx 8m\n        \\end{itemize}\n      \\item \\textbf{Saturday:} Sprint race \\approx 100 km (about 30–45 minutes), then Grand Prix Qualifying (Q1/Q2/Q3 as above)\n      \\item \\textbf{Sunday:} Grand Prix race (as above)\n    \\end{itemize}\n\\end{itemize}\n\\]\n\n\\[\n\\textbf{Timing conventions}\n\\]\n\\[\n\\begin{itemize}\n  \\item Session start times are set in the circuit’s local timezone and vary by event.\n  \\item Many European GPs start the race around 15:00 local; night races (e.g., Singapore, Las Vegas) run after sunset.\n  \\item Red flags, Safety Cars, and weather can extend or delay sessions within the FIA time limits.\n\\end{itemize}\n\\]\n\nIf you tell me the specific Grand Prix you care about (e.g., Miami, Spain), I can list the exact session start times converted to your timezone and set up reminder prompts.',
      },
      {
        id: 'T2',
        label: 'Agent Taha #117 — prose inside \\[...\\]',
        md: '\\[\n\\textbf{Short answer:} I can’t use a web tool in this chat, but around mid-June the next F1 race is typically the Spanish Grand Prix (Barcelona), usually on the weekend nearest June 20–21. For the exact 2026 session times, I recommend checking the official F1 calendar.\n\\]\n\nWould you like me to draft a quick summary with typical session timings in your time zone and set up reminders?',
      },
      {
        id: 'T3',
        label: 'itemize whose items are blank-line separated',
        md: '\\[\n\\begin{itemize}\n  \\item One\n\n  \\item Two\n\\end{itemize}\n\\]',
      },
      {
        id: 'T4',
        label: 'bare itemize whose items are blank-line separated',
        md: '\\begin{itemize}\n\\item One\n\n\\item Two\n\\end{itemize}',
      },
    ],
  },
  {
    group: 'Maths commands carried out of a maths block',
    blurb:
      'An item lifted out of \\[...\\] was written where maths commands were legal. Once it is prose they mean nothing and leak as raw backslashes, so every command that came OUT of maths goes back into a math span — but only those: the same command typed in ordinary prose stays the literal text it has always been, and one KaTeX cannot render stays readable rather than becoming an error box.',
    cases: [
      {
        id: 'M1',
        label: 'Agent Taha #116 — the four \\approx sites',
        md: '\\[\n\\begin{itemize}\n  \\item \\textbf{Qualifying:} \\approx 60 minutes total\n  \\item \\textbf{Race (Grand Prix):} \\approx 305 km (except Monaco \\approx 260 km)\n  \\item Typical segments: SQ1 \\approx 12m, SQ2 \\approx 10m, SQ3 \\approx 8m\n  \\item \\textbf{Saturday:} Sprint race \\approx 100 km (about 30–45 minutes)\n\\end{itemize}\n\\]',
        note: 'The seven \\approx become ≈. Only the command is wrapped — the numbers beside it stay prose, because setting them in maths drops the spaces and italicises the units.',
      },
      {
        id: 'M2',
        label: 'Other maths commands in the same position',
        md: '\\[\n\\begin{itemize}\n  \\item Area is 3 \\times 4\n  \\item Range \\le 10 and \\ge 2\n  \\item Tolerance \\pm 5 mm\n  \\item Step A \\rightarrow Step B\n  \\item Angle \\alpha is small\n  \\item About \\frac{1}{2} of the field\n  \\item Roughly \\sim 40 laps\n  \\item Both \\alpha \\beta together\n\\end{itemize}\n\\]',
        note: 'A command takes its {…} arguments with it, so \\frac{1}{2} is a fraction rather than a lone \\frac; commands separated by nothing but spaces share one span.',
      },
      {
        id: 'M3',
        label: 'A command KaTeX does not know',
        md: '\\[\n\\begin{itemize}\n  \\item Value \\notarealcommand 12 here\n  \\item Unfinished \\frac{1 here\n\\end{itemize}\n\\]',
        note: 'KaTeX is asked whether it can typeset the span before the span is made, so an invented command degrades to the readable text it already was instead of gaining a red error box.',
      },
      {
        id: 'M4',
        label: 'The same command in ordinary prose',
        md: 'Qualifying: \\approx 60 minutes total.\n\n\\begin{itemize}\n\\item Qualifying: \\approx 60 minutes total\n\\end{itemize}',
        note: 'Neither of these was ever maths — the second is a bare itemize, not a display-wrapped one — so both stay literal, exactly as they render today.',
      },
      {
        id: 'M5',
        label: 'Code spans and \\verb inside an item',
        md: '\\[\n\\begin{itemize}\n  \\item \\verb|\\approx stays|\n  \\item `\\approx`\n\\end{itemize}\n\\]',
        note: 'Code is code: the scan never reaches inside a code span, a fence or a \\verb body.',
      },
    ],
  },
  {
    group: 'Chat-bubble typography (issue #2441)',
    blurb:
      'Streamdown prestyles every element for a document, not for the 14px chat bubble it renders in. These are the overrides the app carries back: headings that step DOWN from the body text, a real <strong>, a list item whose wide content scrolls inside the item, an image clamped and given a failure state, and inline maths brought back to the surrounding size.',
    cases: [
      {
        id: 'T1',
        label: 'Heading scale h1-h6',
        md: '# H1 heading\n\n## H2 heading\n\n### H3 heading\n\n#### H4 heading\n\n##### H5 heading\n\n###### H6 heading\n\nBody text for comparison.',
        note: 'h1 text-xl (20px) / h2 text-lg / h3 text-base / h4 text-sm, against a 14px body. Streamdown\u2019s own scale started at text-3xl (30px). h5 and h6 keep Streamdown\u2019s, which the app never overrode.',
      },
      {
        id: 'T2',
        label: 'Bold, italic and a real <strong>',
        md: 'Some **bold text**, some *italic text*, and some ***both***.',
        note: 'Streamdown renders **bold** as <span class="font-semibold">, which is neither bold to a screen reader nor a match for the bubble\u2019s [&_strong]:font-bold rule. <em> needs no override \u2014 Streamdown does not touch it.',
      },
      {
        id: 'T3',
        label: 'Long equation inside a bullet',
        md: '- A bullet whose equation is far wider than the bubble:\n\n  $$\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi} \\quad \\text{and} \\quad \\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6} \\quad \\text{and} \\quad \\prod_{k=1}^{N} \\left( 1 + \\frac{x_k}{k!} \\right)^{\\alpha_k} = \\Gamma(z)$$\n\n- A second bullet, so the markers are visible',
        note: 'The scroll container is a div INSIDE the <li>: a list item that is itself a scroll container clips its own marker.',
      },
      {
        id: 'T4',
        label: 'Inline maths against body text',
        md: 'Body text with $x^2 + y^2 = z^2$ inline, then more body text.\n\n$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$',
        note: 'KaTeX sets every formula at 1.21em. Inline maths is brought back to 1em so it matches the sentence it sits in; display maths keeps 1.21em, where the larger scale is the point.',
      },
      {
        id: 'T5',
        label: 'Broken image URL',
        md: '![Sales chart](https://example.invalid/does-not-exist.png)',
        note: 'A labelled "Image unavailable" card, not the browser\u2019s broken-image glyph. A loading image is clamped to max-h-96 so a tall one cannot push the conversation down.',
      },
    ],
  },
  {
    group: 'Prose wearing a maths costume (issue #2441)',
    blurb:
      'A display block whose every word sits inside \\text{} is a sentence, not an equation \u2014 KaTeX sets it centred, in a serif face, at display scale. The discriminator against a legitimate centred annotation is that prose is a SENTENCE: four words or more AND a terminal stop.',
    cases: [
      {
        id: 'P1',
        label: 'A greeting wrapped in \\[...\\]',
        md: '\\[\n\\text{Hi Conrad\u2014how can I help you today?}\n\\]',
        note: 'Renders as an ordinary paragraph, left-aligned, in the body face. Zero katex spans.',
      },
      {
        id: 'P2',
        label: 'Two sentences as aligned rows',
        md: '$$\n\\begin{aligned}\n&\\text{Got it, Conrad. I received: "e2e first msg 1781965048662".}\\\\\n&\\text{Would you like me to confirm delivery, save this ID, or do something else with it?}\n\\end{aligned}\n$$',
        note: 'Each aligned row becomes its own paragraph.',
      },
      {
        id: 'P3',
        label: 'Real alignment maths stays maths',
        md: '$$\\begin{aligned} a &= b + c \\\\ d &= e + f \\end{aligned}$$',
      },
      {
        id: 'P4',
        label: 'An equation that merely contains \\text{}',
        md: '$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$',
      },
      {
        id: 'P5',
        label: 'Short labels stay centred annotations',
        md: '$$\\text{Step 1: Substitute } x = 4 \\text{ into the expression}$$\n$$3x + 5 = 3(4) + 5$$\n$$\\text{Step 2: Multiply first (order of operations)}$$\n$$3(4) + 5 = 12 + 5$$\n$$\\text{Step 3: Add}$$\n$$12 + 5 = 17$$',
        note: 'Six display blocks. A label carries no terminal stop, so it stays the centred annotation a display block is meant to be.',
      },
      {
        id: 'P6',
        label: 'Doubled list markers',
        md: '\\begin{itemize}\n\\item - English uppercase letters ($A \\ldots Z$)\n\\item - Numbers ($0 \\ldots 9$)\n\\item -5 degrees\n\\end{itemize}',
        note: 'The environment already supplies the marker, so the doubled markdown one is dropped \u2014 the reader saw a bullet AND a dash. A minus that is part of the content keeps its sign.',
      },
      {
        id: 'P7',
        label: 'A LaTeX row break in prose',
        md: 'Line ending with backslashes \\\\\nnext line after hard break.\n\nPath C:\\Users\\name mid-sentence stays intact.',
        note: 'CommonMark reads LaTeX\u2019s \\\\ as an escape producing one literal backslash; the residue is dropped and the break itself comes from remark-breaks. Only a backslash immediately before a line ending, and never inside maths or code.',
      },
    ],
  },
  {
    group: 'Adversarial edge cases (issue #2441 hardening)',
    blurb:
      'Inputs found by probing both paths for KaTeX errors, TeX leaking into visible prose, dropped content and chat/canvas divergence. Everything here was broken before this pass unless the note says otherwise.',
    cases: [
      {
        id: 'E1',
        label: 'A fenced block inside an environment',
        md: '\\begin{itemize}\n\\item Run this:\n```js\nconst a = 1;\n```\n\\item Then done\n\\end{itemize}',
        note: 'A fence ends the paragraph exactly as a blank line does, and the span used to stop dead at it \u2014 leaving the reader four raw commands around content that renders fine.',
      },
      {
        id: 'E2',
        label: 'A markdown list, a heading and a rule inside a quote',
        md: '\\begin{quote}\n# Title\n\n- a\n- b\n\n---\n\n\\end{quote}',
      },
      {
        id: 'E3',
        label: 'An HTML block inside a verbatim body',
        md: '\\begin{verbatim}\n<script>alert(1)</script>\n\\end{verbatim}',
        note: 'Chat sanitises the script element away; canvas keeps its text. Both agree the block is code.',
      },
      {
        id: 'E4',
        label: 'A fenced \\end does not close the environment',
        md: '\\begin{itemize}\n\\item One\n\n```\n\\end{itemize}\n```\n\nStill typing',
        note: 'The span now scans source it did not before, so a fence the reader is being SHOWN must neither close the environment nor open one of its own.',
      },
      {
        id: 'E5',
        label: 'A list whose only content is a nested list',
        md: '\\begin{itemize}\n\\begin{itemize}\n\\item Deep\n\\end{itemize}\n\\end{itemize}',
        note: 'The outer marker has nothing to mark, so it is transparent \u2014 the model wrapped the list one level too many.',
      },
      {
        id: 'E6',
        label: 'The same, wrapped in display delimiters',
        md: '\\[\\begin{itemize}\n\\begin{itemize}\n\\item Deep\n\\end{itemize}\n\\end{itemize}\\]',
        note: 'KaTeX answered this one with a red \u201cNo such environment\u201d.',
      },
      {
        id: 'E7',
        label: 'A styling command nested inside another',
        md: 'Nested \\textbf{a \\textit{b} c} end.',
        note: 'The outer command was consumed and its whole group skipped, so the inner one reached the reader as a raw backslash.',
      },
      {
        id: 'E8',
        label: 'A row break between two matrices',
        md: '$$\\begin{pmatrix}1 & 2\\end{pmatrix} \\\\ \\begin{pmatrix}3 & 4\\end{pmatrix}$$',
        note: 'The environments bind their own &, but the \\\\ between them is unbound and KaTeX drops it silently, collapsing the rows onto one line.',
      },
      {
        id: 'E9',
        label: 'Alignment outside a balanced environment',
        md: '$$\\begin{matrix} a & b \\end{matrix} \\\\ c &= d$$',
        note: 'KaTeX reported \u201cExpected EOF, got &\u201d: a \u201cdoes it contain \\begin{\u201d test skipped the whole node.',
      },
      {
        id: 'E10',
        label: 'A tabular a model wrote standalone',
        md: '\\begin{tabular}{lcr}\\hline\n\\text{Item} & \\text{Qty} & \\text{Cost} \\\\\\hline\n\\text{Widget} & 12{,}500 & \\$5.00 \\\\\n\\text{Gadget} & 900 & \\$7.50 \\\\\\hline\n\\end{tabular}',
      },
      {
        id: 'E11',
        label: 'An environment left unclosed by the stream',
        md: '\\begin{itemize}\n\\item One\n\\item Two',
        note: 'UNFIXED, deliberate: the last line of a streaming reply is half a token, so it stays literal until its newline lands.',
      },
      {
        id: 'E12',
        label: 'A mismatched \\end',
        md: '\\begin{itemize}\n\\item One\n\\end{enumerate}',
        note: 'UNFIXED, deliberate: a broken message, not an unfinished one \u2014 nothing closes an environment on the author\u2019s behalf.',
      },
      {
        id: 'E13',
        label: 'An environment inside a table cell',
        md: '| a |\n| - |\n| \\begin{itemize}\\item x\\end{itemize} |',
        note: 'UNFIXED: a cell holds phrasing content, so there is nowhere to put a list; and \\verb|x| in a cell loses its delimiter to the column separator.',
      },
    ],
  },
];
