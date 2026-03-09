import { describe, it, expect } from 'vitest';
import { latexToReadableText, extractReadableMath } from '../canvas-export-handlers';

describe('latexToReadableText', () => {
  // ============================================================================
  // Greek letters
  // ============================================================================
  describe('Greek letters', () => {
    it('should convert lowercase Greek letters', () => {
      expect(latexToReadableText('\\alpha')).toBe('α');
      expect(latexToReadableText('\\beta')).toBe('β');
      expect(latexToReadableText('\\gamma')).toBe('γ');
      expect(latexToReadableText('\\delta')).toBe('δ');
      expect(latexToReadableText('\\epsilon')).toBe('ε');
      expect(latexToReadableText('\\lambda')).toBe('λ');
      expect(latexToReadableText('\\mu')).toBe('μ');
      expect(latexToReadableText('\\sigma')).toBe('σ');
      expect(latexToReadableText('\\phi')).toBe('φ');
      expect(latexToReadableText('\\omega')).toBe('ω');
    });

    it('should convert uppercase Greek letters', () => {
      expect(latexToReadableText('\\Gamma')).toBe('Γ');
      expect(latexToReadableText('\\Delta')).toBe('Δ');
      expect(latexToReadableText('\\Sigma')).toBe('Σ');
      expect(latexToReadableText('\\Phi')).toBe('Φ');
      expect(latexToReadableText('\\Omega')).toBe('Ω');
    });

    it('should convert variant Greek letters', () => {
      expect(latexToReadableText('\\varepsilon')).toBe('ε');
      expect(latexToReadableText('\\varphi')).toBe('φ');
      expect(latexToReadableText('\\vartheta')).toBe('ϑ');
    });

    it('should not replace Greek letters that are part of longer words', () => {
      expect(latexToReadableText('\\alphabeta')).not.toContain('α');
    });

    it('should handle multiple Greek letters in one expression', () => {
      expect(latexToReadableText('\\alpha + \\beta = \\gamma')).toBe('α + β = γ');
    });
  });

  // ============================================================================
  // Math operators and symbols
  // ============================================================================
  describe('Math operators and symbols', () => {
    it('should convert basic operators', () => {
      expect(latexToReadableText('\\times')).toBe('×');
      expect(latexToReadableText('\\div')).toBe('÷');
      expect(latexToReadableText('\\cdot')).toBe('·');
      expect(latexToReadableText('\\pm')).toBe('±');
    });

    it('should convert comparison operators', () => {
      expect(latexToReadableText('\\leq')).toBe('≤');
      expect(latexToReadableText('\\geq')).toBe('≥');
      expect(latexToReadableText('\\neq')).toBe('≠');
      expect(latexToReadableText('\\approx')).toBe('≈');
    });

    it('should convert set operators', () => {
      expect(latexToReadableText('\\in')).toBe('∈');
      expect(latexToReadableText('\\subset')).toBe('⊂');
      expect(latexToReadableText('\\cup')).toBe('∪');
      expect(latexToReadableText('\\cap')).toBe('∩');
    });

    it('should convert arrows', () => {
      expect(latexToReadableText('\\rightarrow')).toBe('→');
      expect(latexToReadableText('\\leftarrow')).toBe('←');
      expect(latexToReadableText('\\Rightarrow')).toBe('⇒');
      expect(latexToReadableText('\\to')).toBe('→');
    });

    it('should convert calculus symbols', () => {
      expect(latexToReadableText('\\sum')).toBe('Σ');
      expect(latexToReadableText('\\prod')).toBe('Π');
      expect(latexToReadableText('\\int')).toBe('∫');
      expect(latexToReadableText('\\partial')).toBe('∂');
      expect(latexToReadableText('\\nabla')).toBe('∇');
      expect(latexToReadableText('\\infty')).toBe('∞');
    });

    it('should convert spacing commands', () => {
      expect(latexToReadableText('a\\quad b')).toBe('a b');
      expect(latexToReadableText('a\\, b')).toBe('a b');
    });

    it('should remove delimiter sizing commands', () => {
      expect(latexToReadableText('\\left(x\\right)')).toBe('(x)');
      expect(latexToReadableText('\\big(x\\big)')).toBe('(x)');
      expect(latexToReadableText('\\Bigl(x\\Bigr)')).toBe('(x)');
    });

    it('should convert dots', () => {
      expect(latexToReadableText('\\ldots')).toBe('…');
      expect(latexToReadableText('\\cdots')).toBe('⋯');
    });

    it('should convert quantifiers', () => {
      expect(latexToReadableText('\\forall')).toBe('∀');
      expect(latexToReadableText('\\exists')).toBe('∃');
    });
  });

  // ============================================================================
  // Fractions
  // ============================================================================
  describe('Fractions', () => {
    it('should convert simple fraction', () => {
      expect(latexToReadableText('\\frac{a}{b}')).toBe('(a)/(b)');
    });

    it('should convert fraction with nested content', () => {
      expect(latexToReadableText('\\frac{\\lambda^k e^{-\\lambda}}{k!}')).toBe(
        '(λ^k e^(-λ))/(k!)',
      );
    });

    it('should convert nested fractions', () => {
      expect(latexToReadableText('\\frac{\\frac{a}{b}}{c}')).toBe('((a)/(b))/(c)');
    });

    it('should convert fraction with Greek letters', () => {
      expect(latexToReadableText('\\frac{\\mu}{\\sigma}')).toBe('(μ)/(σ)');
    });

    it('should convert fraction with complex numerator and denominator', () => {
      const result = latexToReadableText('\\frac{\\Gamma(k + r)}{\\Gamma(k + 1)\\Gamma(r)}');
      expect(result).toBe('(Γ(k + r))/(Γ(k + 1)Γ(r))');
    });

    it('should handle frac without proper braces (malformed)', () => {
      const result = latexToReadableText('\\frac ab');
      // No braces means extractBraceGroup returns null, so \frac is left as prefix
      expect(result).toContain('frac');
    });

    it('should handle frac with only first argument', () => {
      const result = latexToReadableText('\\frac{a}b');
      // Second arg has no brace, so it's not matched
      expect(result).toContain('frac');
    });
  });

  // ============================================================================
  // Text commands
  // ============================================================================
  describe('Text commands', () => {
    it('should extract text from \\text', () => {
      expect(latexToReadableText('\\text{Var}')).toBe('Var');
    });

    it('should extract text from \\textbf', () => {
      expect(latexToReadableText('\\textbf{bold}')).toBe('bold');
    });

    it('should extract text from \\textit', () => {
      expect(latexToReadableText('\\textit{italic}')).toBe('italic');
    });

    it('should extract text from \\mathrm', () => {
      expect(latexToReadableText('\\mathrm{Var}')).toBe('Var');
    });

    it('should extract text from \\mathbf', () => {
      expect(latexToReadableText('\\mathbf{x}')).toBe('x');
    });

    it('should extract text from \\mathcal', () => {
      expect(latexToReadableText('\\mathcal{N}')).toBe('N');
    });
  });

  // ============================================================================
  // Decorators
  // ============================================================================
  describe('Decorators', () => {
    it('should add hat combining character', () => {
      expect(latexToReadableText('\\hat{x}')).toBe('x\u0302');
    });

    it('should add bar combining character', () => {
      expect(latexToReadableText('\\bar{x}')).toBe('x\u0304');
    });

    it('should add tilde combining character', () => {
      expect(latexToReadableText('\\tilde{x}')).toBe('x\u0303');
    });

    it('should add vec combining character', () => {
      expect(latexToReadableText('\\vec{v}')).toBe('v\u20D7');
    });

    it('should add dot combining character', () => {
      expect(latexToReadableText('\\dot{x}')).toBe('x\u0307');
    });

    it('should convert sqrt', () => {
      expect(latexToReadableText('\\sqrt{x}')).toBe('√(x)');
    });

    it('should add overline combining character', () => {
      expect(latexToReadableText('\\overline{AB}')).toBe('AB\u0304');
    });

    it('should handle nested decorator with Greek', () => {
      expect(latexToReadableText('\\hat{\\mu}')).toBe('μ\u0302');
    });
  });

  // ============================================================================
  // Superscripts and subscripts
  // ============================================================================
  describe('Superscripts and subscripts', () => {
    it('should convert superscript with braces', () => {
      expect(latexToReadableText('x^{2}')).toBe('x^(2)');
    });

    it('should convert subscript with braces', () => {
      expect(latexToReadableText('x_{i}')).toBe('x_(i)');
    });

    it('should preserve simple superscript without braces', () => {
      expect(latexToReadableText('x^2')).toBe('x^2');
    });

    it('should handle nested superscripts', () => {
      expect(latexToReadableText('e^{x^{2}}')).toBe('e^(x^(2))');
    });

    it('should handle combined sub and superscript', () => {
      expect(latexToReadableText('x_{i}^{2}')).toBe('x_(i)^(2)');
    });
  });

  // ============================================================================
  // Brace removal
  // ============================================================================
  describe('Brace removal', () => {
    it('should remove grouping braces', () => {
      expect(latexToReadableText('{a + b}')).toBe('a + b');
    });

    it('should remove nested grouping braces', () => {
      expect(latexToReadableText('{{a}}')).toBe('a');
    });
  });

  // ============================================================================
  // Unknown commands
  // ============================================================================
  describe('Unknown commands', () => {
    it('should remove backslash from unknown commands', () => {
      expect(latexToReadableText('\\unknowncmd')).toBe('unknowncmd');
    });

    it('should keep text after removing backslash', () => {
      expect(latexToReadableText('a \\newcommand b')).toBe('a newcommand b');
    });
  });

  // ============================================================================
  // Whitespace cleanup
  // ============================================================================
  describe('Whitespace cleanup', () => {
    it('should collapse multiple spaces', () => {
      expect(latexToReadableText('a    b')).toBe('a b');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(latexToReadableText('  x  ')).toBe('x');
    });
  });

  // ============================================================================
  // Complex real-world formulas
  // ============================================================================
  describe('Complex formulas', () => {
    it('should convert Poisson PMF', () => {
      const result = latexToReadableText('P(X = k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}');
      expect(result).toBe('P(X = k) = (λ^k e^(-λ))/(k!)');
    });

    it('should convert simple variance equation', () => {
      expect(latexToReadableText('\\sigma^2 = \\mu')).toBe('σ^2 = μ');
    });

    it('should convert Pearson dispersion', () => {
      const result = latexToReadableText(
        '\\hat{\\phi}_{\\text{Pearson}} = \\frac{\\sum_i (y_i - \\hat{\\mu}_i)^2}{\\hat{\\mu}_i}',
      );
      expect(result).toBe('φ̂_(Pearson) = (Σ_i (y_i - μ̂_i)^2)/(μ̂_i)');
    });

    it('should convert negative binomial formula', () => {
      const result = latexToReadableText(
        '\\frac{\\Gamma(k + r)}{\\Gamma(k + 1)\\Gamma(r)} \\left(\\frac{\\mu}{\\mu + r}\\right)^k',
      );
      expect(result).toBe('(Γ(k + r))/(Γ(k + 1)Γ(r)) ((μ)/(μ + r))^k');
    });

    it('should convert integral expression', () => {
      const result = latexToReadableText('\\int_0^\\infty e^{-x} dx');
      expect(result).toBe('∫_0^∞ e^(-x) dx');
    });

    it('should handle empty string', () => {
      expect(latexToReadableText('')).toBe('');
    });

    it('should handle plain text with no LaTeX', () => {
      expect(latexToReadableText('hello world')).toBe('hello world');
    });
  });
});

describe('extractReadableMath', () => {
  it('should extract and convert LaTeX from annotation element', () => {
    const element = document.createElement('span');
    element.classList.add('katex');
    const annotation = document.createElement('annotation');
    annotation.setAttribute('encoding', 'application/x-tex');
    annotation.textContent = '\\sigma^2 = \\mu';
    element.appendChild(annotation);

    expect(extractReadableMath(element)).toBe('σ^2 = μ');
  });

  it('should fall back to textContent when no annotation', () => {
    const element = document.createElement('span');
    element.textContent = 'plain text';
    expect(extractReadableMath(element)).toBe('plain text');
  });

  it('should return empty string for empty element', () => {
    const element = document.createElement('span');
    expect(extractReadableMath(element)).toBe('');
  });

  it('should handle annotation with complex LaTeX', () => {
    const element = document.createElement('span');
    element.classList.add('katex-display');
    const mathml = document.createElement('span');
    mathml.classList.add('katex-mathml');
    const annotation = document.createElement('annotation');
    annotation.setAttribute('encoding', 'application/x-tex');
    annotation.textContent = '\\frac{a}{b}';
    mathml.appendChild(annotation);
    element.appendChild(mathml);

    expect(extractReadableMath(element)).toBe('(a)/(b)');
  });

  it('should handle annotation with empty text', () => {
    const element = document.createElement('span');
    const annotation = document.createElement('annotation');
    annotation.setAttribute('encoding', 'application/x-tex');
    annotation.textContent = '';
    element.appendChild(annotation);
    // Empty textContent is falsy, falls back to element.textContent
    expect(extractReadableMath(element)).toBe('');
  });
});
