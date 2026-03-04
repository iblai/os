import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { components } from '../markdown-components';

// Mock CopyButtonIcon component
vi.mock('@/components/copy-button-icon', () => ({
  CopyButtonIcon: ({ text }: { text: string }) => (
    <button data-testid="copy-button" data-text={text}>
      Copy
    </button>
  ),
}));

// Mock MarkdownImageComponent
vi.mock('../markdown-image-component', () => ({
  MarkdownImageComponent: ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => (
    <img data-testid="markdown-image" src={src} alt={alt} title={title} />
  ),
}));

describe('Markdown Components', () => {
  describe('h1 component', () => {
    const H1 = components.h1!;

    it('should render h1 with content', () => {
      const { container } = render(<H1 node={{} as any}>Heading 1</H1>);
      const h1 = container.querySelector('h1');
      expect(h1).toBeTruthy();
      expect(h1?.textContent).toBe('Heading 1');
    });

    it('should return null for empty content', () => {
      const { container } = render(<H1 node={{} as any}>{''}</H1>);
      const h1 = container.querySelector('h1');
      expect(h1).toBeNull();
    });

    it('should return null for whitespace-only content', () => {
      const { container } = render(<H1 node={{} as any}>{'   '}</H1>);
      const h1 = container.querySelector('h1');
      expect(h1).toBeNull();
    });

    it('should return null for undefined children', () => {
      const { container } = render(<H1 node={{} as any}>{undefined}</H1>);
      const h1 = container.querySelector('h1');
      expect(h1).toBeNull();
    });
  });

  describe('h2 component', () => {
    const H2 = components.h2!;

    it('should render h2 with content', () => {
      const { container } = render(<H2 node={{} as any}>Heading 2</H2>);
      const h2 = container.querySelector('h2');
      expect(h2).toBeTruthy();
      expect(h2?.textContent).toBe('Heading 2');
    });

    it('should return null for empty content', () => {
      const { container } = render(<H2 node={{} as any}>{''}</H2>);
      const h2 = container.querySelector('h2');
      expect(h2).toBeNull();
    });

    it('should return null for whitespace-only content', () => {
      const { container } = render(<H2 node={{} as any}>{'   '}</H2>);
      const h2 = container.querySelector('h2');
      expect(h2).toBeNull();
    });
  });

  describe('h3 component', () => {
    const H3 = components.h3!;

    it('should render h3 with content', () => {
      const { container } = render(<H3 node={{} as any}>Heading 3</H3>);
      const h3 = container.querySelector('h3');
      expect(h3).toBeTruthy();
      expect(h3?.textContent).toBe('Heading 3');
    });

    it('should return null for empty content', () => {
      const { container } = render(<H3 node={{} as any}>{''}</H3>);
      const h3 = container.querySelector('h3');
      expect(h3).toBeNull();
    });

    it('should return null for whitespace-only content', () => {
      const { container } = render(<H3 node={{} as any}>{'   '}</H3>);
      const h3 = container.querySelector('h3');
      expect(h3).toBeNull();
    });
  });

  describe('h4 component', () => {
    const H4 = components.h4!;

    it('should render h4 with content', () => {
      const { container } = render(<H4 node={{} as any}>Heading 4</H4>);
      const h4 = container.querySelector('h4');
      expect(h4).toBeTruthy();
      expect(h4?.textContent).toBe('Heading 4');
    });

    it('should return null for empty content', () => {
      const { container } = render(<H4 node={{} as any}>{''}</H4>);
      const h4 = container.querySelector('h4');
      expect(h4).toBeNull();
    });

    it('should return null for whitespace-only content', () => {
      const { container } = render(<H4 node={{} as any}>{'   '}</H4>);
      const h4 = container.querySelector('h4');
      expect(h4).toBeNull();
    });
  });

  describe('p component', () => {
    const P = components.p!;

    it('should render paragraph with content', () => {
      const { container } = render(<P node={{} as any}>Paragraph text</P>);
      const p = container.querySelector('p');
      expect(p).toBeTruthy();
      expect(p?.textContent).toBe('Paragraph text');
      expect(p?.className).toContain('leading-7');
    });
  });

  describe('strong component', () => {
    const Strong = components.strong!;

    it('should render strong with content', () => {
      const { container } = render(<Strong node={{} as any}>Bold text</Strong>);
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong?.textContent).toBe('Bold text');
    });

    it('should return null for empty content', () => {
      const { container } = render(<Strong node={{} as any}>{''}</Strong>);
      const strong = container.querySelector('strong');
      expect(strong).toBeNull();
    });

    it('should return null for whitespace-only content', () => {
      const { container } = render(<Strong node={{} as any}>{'   '}</Strong>);
      const strong = container.querySelector('strong');
      expect(strong).toBeNull();
    });
  });

  describe('em component', () => {
    const Em = components.em!;

    it('should render em with content', () => {
      const { container } = render(<Em node={{} as any}>Italic text</Em>);
      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em?.textContent).toBe('Italic text');
    });

    it('should return null for empty content', () => {
      const { container } = render(<Em node={{} as any}>{''}</Em>);
      const em = container.querySelector('em');
      expect(em).toBeNull();
    });

    it('should return null for whitespace-only content', () => {
      const { container } = render(<Em node={{} as any}>{'   '}</Em>);
      const em = container.querySelector('em');
      expect(em).toBeNull();
    });
  });

  describe('a component', () => {
    const A = components.a!;

    it('should render link with proper attributes', () => {
      const { container } = render(
        <A node={{} as any} href="https://example.com">
          Link text
        </A>,
      );
      const a = container.querySelector('a');
      expect(a).toBeTruthy();
      expect(a?.getAttribute('href')).toBe('https://example.com');
      expect(a?.getAttribute('target')).toBe('_blank');
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a?.className).toContain('text-blue-500');
    });
  });

  describe('blockquote component', () => {
    const Blockquote = components.blockquote!;

    it('should render blockquote with styling', () => {
      const { container } = render(<Blockquote node={{} as any}>Quote text</Blockquote>);
      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
      expect(blockquote?.className).toContain('border-l-2');
      expect(blockquote?.className).toContain('italic');
    });
  });

  describe('table component', () => {
    const Table = components.table!;

    it('should render table with wrapper div', () => {
      const { container } = render(
        <Table node={{} as any}>
          <tbody>
            <tr>
              <td>Cell</td>
            </tr>
          </tbody>
        </Table>,
      );
      const wrapper = container.querySelector('div.overflow-x-auto');
      expect(wrapper).toBeTruthy();
      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  describe('tr component', () => {
    const Tr = components.tr!;

    it('should render tr with styling', () => {
      const { container } = render(
        <table>
          <tbody>
            <Tr node={{} as any}>
              <td>Cell</td>
            </Tr>
          </tbody>
        </table>,
      );
      const tr = container.querySelector('tr');
      expect(tr).toBeTruthy();
      expect(tr?.className).toContain('even:bg-muted');
    });
  });

  describe('th component', () => {
    const Th = components.th!;

    it('should render th with styling', () => {
      const { container } = render(
        <table>
          <thead>
            <tr>
              <Th node={{} as any}>Header</Th>
            </tr>
          </thead>
        </table>,
      );
      const th = container.querySelector('th');
      expect(th).toBeTruthy();
      expect(th?.className).toContain('font-bold');
      expect(th?.className).toContain('border');
    });
  });

  describe('td component', () => {
    const Td = components.td!;

    it('should render td with styling', () => {
      const { container } = render(
        <table>
          <tbody>
            <tr>
              <Td node={{} as any}>Cell content</Td>
            </tr>
          </tbody>
        </table>,
      );
      const td = container.querySelector('td');
      expect(td).toBeTruthy();
      expect(td?.className).toContain('border');
      expect(td?.className).toContain('px-4');
    });
  });

  describe('ul component', () => {
    const Ul = components.ul!;

    it('should render ul with styling', () => {
      const { container } = render(
        <Ul node={{} as any}>
          <li>Item</li>
        </Ul>,
      );
      const ul = container.querySelector('ul');
      expect(ul).toBeTruthy();
      expect(ul?.className).toContain('list-disc');
    });
  });

  describe('ol component', () => {
    const Ol = components.ol!;

    it('should render ol with styling', () => {
      const { container } = render(
        <Ol node={{} as any}>
          <li>Item</li>
        </Ol>,
      );
      const ol = container.querySelector('ol');
      expect(ol).toBeTruthy();
      expect(ol?.className).toContain('list-decimal');
    });
  });

  describe('li component', () => {
    const Li = components.li!;

    it('should render li with styling', () => {
      const { container } = render(
        <ul>
          <Li node={{} as any}>List item</Li>
        </ul>,
      );
      const li = container.querySelector('li');
      expect(li).toBeTruthy();
      expect(li?.className).toContain('overflow-x-auto');
    });
  });

  describe('code component', () => {
    const Code = components.code!;

    it('should render syntax highlighted code block when language is specified', () => {
      const { container } = render(
        <Code node={{} as any} className="language-javascript">
          {'const x = 1;'}
        </Code>,
      );
      // Should have copy button
      const copyButton = container.querySelector('[data-testid="copy-button"]');
      expect(copyButton).toBeTruthy();
    });

    it('should render inline code when no language is specified', () => {
      const { container } = render(<Code node={{} as any}>{'inline code'}</Code>);
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      expect(code?.className).toContain('font-mono');
      expect(code?.textContent).toBe('inline code');
    });

    it('should render inline code for language-latex', () => {
      const { container } = render(
        <Code node={{} as any} className="language-latex">
          {'\\frac{1}{2}'}
        </Code>,
      );
      const code = container.querySelector('code');
      expect(code).toBeTruthy();
      // Should render as inline code, not syntax highlighted
      expect(code?.className).toContain('font-mono');
    });

    it('should strip trailing newline from code content', () => {
      const { container } = render(
        <Code node={{} as any} className="language-python">
          {'print("hello")\n'}
        </Code>,
      );
      const copyButton = container.querySelector('[data-testid="copy-button"]');
      expect(copyButton?.getAttribute('data-text')).toBe('print("hello")');
    });
  });

  describe('pre component', () => {
    const Pre = components.pre!;

    it('should render pre with styling', () => {
      const { container } = render(<Pre node={{} as any}>{'preformatted text'}</Pre>);
      const pre = container.querySelector('pre');
      expect(pre).toBeTruthy();
      expect(pre?.className).toContain('bg-gray-200');
      expect(pre?.className).toContain('overflow-x-auto');
    });
  });

  describe('small component', () => {
    const Small = components.small!;

    it('should render small with styling', () => {
      const { container } = render(<Small node={{} as any}>Small text</Small>);
      const small = container.querySelector('small');
      expect(small).toBeTruthy();
      expect(small?.className).toContain('text-sm');
    });
  });

  describe('img component', () => {
    const Img = components.img!;

    it('should render MarkdownImageComponent with props', () => {
      const { container } = render(
        <Img node={{} as any} src="image.jpg" alt="Alt text" title="Image title" />,
      );
      const img = container.querySelector('[data-testid="markdown-image"]');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('image.jpg');
      expect(img?.getAttribute('alt')).toBe('Alt text');
      expect(img?.getAttribute('title')).toBe('Image title');
    });
  });

  describe('textarea component', () => {
    const Textarea = components.textarea!;

    it('should render textarea with children as defaultValue', () => {
      const { container } = render(<Textarea node={{} as any}>{'Textarea content'}</Textarea>);
      const textarea = container.querySelector('textarea');
      expect(textarea).toBeTruthy();
      expect(textarea?.defaultValue).toBe('Textarea content');
      expect(textarea?.readOnly).toBe(true);
    });

    it('should handle empty children', () => {
      const { container } = render(<Textarea node={{} as any}>{''}</Textarea>);
      const textarea = container.querySelector('textarea');
      expect(textarea).toBeTruthy();
      expect(textarea?.defaultValue).toBe('');
    });

    it('should trim whitespace from content', () => {
      const { container } = render(
        <Textarea node={{} as any}>{'  content with spaces  '}</Textarea>,
      );
      const textarea = container.querySelector('textarea');
      expect(textarea?.defaultValue).toBe('content with spaces');
    });
  });
});
