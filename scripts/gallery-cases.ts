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
      'App chrome: dark, language label left, single Copy button right, Prism tomorrow theme, lazy-loaded. language-latex bypasses the highlighter.',
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
      { id: 'x4', label: 'Starred section', md: '\\section*{Heading One}' },
    ],
  },
  {
    group: 'Document-mode LaTeX (accepted loss)',
    blurb:
      'The old prompt told models to emit these; 751971e4 removed it. Legacy mentors still produce them. They render as literal text — readable, not repaired.',
    cases: [
      {
        id: 'g1',
        label: 'itemize',
        md: '\\begin{itemize}\n\\item First point\n\\item Second point\n\\end{itemize}',
      },
      {
        id: 'g2',
        label: 'textbf / textit',
        md: 'This is \\textbf{important} and \\textit{slanted} text.',
      },
      {
        id: 'g3',
        label: 'section',
        md: '\\section{Overview}\nSome prose here.',
      },
      {
        id: 'g4',
        label: 'tabular',
        md: '\\begin{tabular}{|c|c|}\\hline Name & Age \\\\ \\hline Bob & 42 \\\\ \\hline\\end{tabular}',
      },
      {
        id: 'g5',
        label: '$\\textbf{}$ in math',
        md: '$\\textbf{Custom AI Agents}$',
      },
      {
        id: 'g6',
        label: 'display-wrapped itemize',
        md: '\\[\\begin{itemize}\\item Why\\end{itemize}\\]',
        note: 'Errors: \\[…\\] is real display math, so KaTeX reports "No such environment".',
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
];
