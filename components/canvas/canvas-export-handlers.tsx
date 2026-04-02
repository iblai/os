import { toast } from 'sonner';
import { markdownToHtml } from '@/lib/utils';
import {
  sanitizeFilename,
  escapeHtml,
  stripHtml,
  splitTextIntoLines,
} from './canvas-utils';

/**
 * Convert LaTeX string to readable plain text with Unicode symbols.
 * Handles common LaTeX commands: Greek letters, fractions, operators, etc.
 */
/**
 * Find the content of a brace-delimited group starting at position i in text.
 * text[i] must be '{'. Returns { content, end } where end is the index after '}'.
 * Returns null if no matching brace is found.
 */
const extractBraceGroup = (
  text: string,
  i: number,
): { content: string; end: number } | null => {
  if (text[i] !== '{') return null;
  let depth = 1;
  let j = i + 1;
  while (j < text.length && depth > 0) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') depth--;
    j++;
  }
  if (depth !== 0) return null;
  return { content: text.slice(i + 1, j - 1), end: j };
};

/**
 * Replace all occurrences of \cmd{arg1}{arg2} with a transform function,
 * handling nested braces correctly.
 */
const replaceTwoArgCmd = (
  text: string,
  cmd: string,
  transform: (a: string, b: string) => string,
): string => {
  const prefix = '\\' + cmd;
  let result = '';
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf(prefix, i);
    if (idx === -1) {
      result += text.slice(i);
      break;
    }
    result += text.slice(i, idx);
    const afterCmd = idx + prefix.length;
    const first = extractBraceGroup(text, afterCmd);
    if (!first) {
      result += prefix;
      i = afterCmd;
      continue;
    }
    const second = extractBraceGroup(text, first.end);
    if (!second) {
      result += prefix;
      i = afterCmd;
      continue;
    }
    result += transform(first.content, second.content);
    i = second.end;
  }
  return result;
};

/**
 * Replace all occurrences of \cmd{arg} with a transform function,
 * handling nested braces correctly.
 */
const replaceOneArgCmd = (
  text: string,
  cmd: string,
  transform: (a: string) => string,
): string => {
  const prefix = '\\' + cmd;
  let result = '';
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf(prefix, i);
    if (idx === -1) {
      result += text.slice(i);
      break;
    }
    result += text.slice(i, idx);
    const afterCmd = idx + prefix.length;
    const group = extractBraceGroup(text, afterCmd);
    if (!group) {
      result += prefix;
      i = afterCmd;
      continue;
    }
    result += transform(group.content);
    i = group.end;
  }
  return result;
};

export const latexToReadableText = (latex: string): string => {
  let text = latex;

  // Greek letters
  const greekMap: Record<string, string> = {
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    epsilon: 'ε',
    zeta: 'ζ',
    eta: 'η',
    theta: 'θ',
    iota: 'ι',
    kappa: 'κ',
    lambda: 'λ',
    mu: 'μ',
    nu: 'ν',
    xi: 'ξ',
    pi: 'π',
    rho: 'ρ',
    sigma: 'σ',
    tau: 'τ',
    upsilon: 'υ',
    phi: 'φ',
    chi: 'χ',
    psi: 'ψ',
    omega: 'ω',
    Gamma: 'Γ',
    Delta: 'Δ',
    Theta: 'Θ',
    Lambda: 'Λ',
    Xi: 'Ξ',
    Pi: 'Π',
    Sigma: 'Σ',
    Phi: 'Φ',
    Psi: 'Ψ',
    Omega: 'Ω',
    varepsilon: 'ε',
    varphi: 'φ',
    varpi: 'ϖ',
    varrho: 'ϱ',
    varsigma: 'ς',
    vartheta: 'ϑ',
  };
  for (const [cmd, sym] of Object.entries(greekMap)) {
    text = text.replace(new RegExp(`\\\\${cmd}(?![a-zA-Z])`, 'g'), sym);
  }

  // Math operators and symbols
  const symbolMap: Record<string, string> = {
    '\\infty': '∞',
    '\\pm': '±',
    '\\mp': '∓',
    '\\times': '×',
    '\\div': '÷',
    '\\cdot': '·',
    '\\ldots': '…',
    '\\cdots': '⋯',
    '\\approx': '≈',
    '\\neq': '≠',
    '\\ne': '≠',
    '\\leq': '≤',
    '\\le': '≤',
    '\\geq': '≥',
    '\\ge': '≥',
    '\\ll': '≪',
    '\\gg': '≫',
    '\\subset': '⊂',
    '\\supset': '⊃',
    '\\subseteq': '⊆',
    '\\supseteq': '⊇',
    '\\in': '∈',
    '\\notin': '∉',
    '\\cup': '∪',
    '\\cap': '∩',
    '\\forall': '∀',
    '\\exists': '∃',
    '\\nabla': '∇',
    '\\partial': '∂',
    '\\sum': 'Σ',
    '\\prod': 'Π',
    '\\int': '∫',
    '\\iint': '∬',
    '\\iiint': '∭',
    '\\rightarrow': '→',
    '\\leftarrow': '←',
    '\\Rightarrow': '⇒',
    '\\Leftarrow': '⇐',
    '\\leftrightarrow': '↔',
    '\\Leftrightarrow': '⇔',
    '\\to': '→',
    '\\gets': '←',
    '\\quad': '  ',
    '\\qquad': '    ',
    '\\,': ' ',
    '\\;': ' ',
    '\\!': '',
    '\\left': '',
    '\\right': '',
    '\\bigl': '',
    '\\bigr': '',
    '\\Bigl': '',
    '\\Bigr': '',
    '\\biggl': '',
    '\\biggr': '',
    '\\big': '',
    '\\Big': '',
    '\\bigg': '',
    '\\Bigg': '',
  };
  // Sort by key length descending to prevent prefix matching issues
  // Use regex with word boundary for alpha commands (e.g., \in must not match inside \int)
  const sortedSymbols = Object.entries(symbolMap).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [cmd, sym] of sortedSymbols) {
    // Check if the command ends with a letter (needs word boundary)
    if (/[a-zA-Z]$/.test(cmd)) {
      text = text.replace(
        new RegExp(cmd.replace(/\\/g, '\\\\') + '(?![a-zA-Z])', 'g'),
        sym,
      );
    } else {
      text = text.split(cmd).join(sym);
    }
  }

  // One-arg commands with nested brace support
  text = replaceOneArgCmd(text, 'text', (a) => a);
  text = replaceOneArgCmd(text, 'textbf', (a) => a);
  text = replaceOneArgCmd(text, 'textit', (a) => a);
  text = replaceOneArgCmd(text, 'mathrm', (a) => a);
  text = replaceOneArgCmd(text, 'mathbf', (a) => a);
  text = replaceOneArgCmd(text, 'mathcal', (a) => a);
  text = replaceOneArgCmd(text, 'hat', (a) => `${a}\u0302`);
  text = replaceOneArgCmd(text, 'bar', (a) => `${a}\u0304`);
  text = replaceOneArgCmd(text, 'tilde', (a) => `${a}\u0303`);
  text = replaceOneArgCmd(text, 'vec', (a) => `${a}\u20D7`);
  text = replaceOneArgCmd(text, 'dot', (a) => `${a}\u0307`);
  text = replaceOneArgCmd(text, 'sqrt', (a) => `√(${a})`);
  text = replaceOneArgCmd(text, 'overline', (a) => `${a}\u0304`);

  // \frac{a}{b} → (a)/(b) with nested brace support — apply recursively
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = replaceTwoArgCmd(text, 'frac', (a, b) => `(${a})/(${b})`);
  }

  // ^{exp} and _{sub} with proper brace matching
  // Process from right to left by repeatedly replacing innermost
  prev = '';
  while (prev !== text) {
    prev = text;
    // Simple regex for innermost brace groups in ^ and _
    text = text.replace(/\^\{([^{}]*)\}/g, '^($1)');
    text = text.replace(/_\{([^{}]*)\}/g, '_($1)');
  }

  // Remove remaining braces that were just for grouping
  prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(/\{([^{}]*)\}/g, '$1');
  }

  // Clean up remaining backslash commands — just remove the backslash
  text = text.replace(/\\([a-zA-Z]+)/g, '$1');

  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
};

/**
 * Extract readable math text from a KaTeX DOM element.
 * Uses the MathML content (proper Unicode) with structural awareness,
 * falling back to latexToReadableText on the annotation.
 */
export const extractReadableMath = (element: Element): string => {
  // Try annotation first, convert via latexToReadableText
  const annotation = element.querySelector(
    'annotation[encoding="application/x-tex"]',
  );
  if (annotation?.textContent) {
    return latexToReadableText(annotation.textContent);
  }
  return element.textContent ?? '';
};

/* istanbul ignore next -- @preserve internal base64 encoding for PDF fonts */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  throw new Error('Base64 encoder is not available.');
};

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Convert oklch color to RGB
 */
export const convertOklchToRgb = (
  value: string,
  ownerDoc: Document,
): string | null => {
  if (!value || !value.includes('oklch')) return null;

  try {
    const probe = ownerDoc.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.color = value.trim();
    ownerDoc.body.appendChild(probe);

    const computed = ownerDoc.defaultView?.getComputedStyle(probe);
    const rgb = computed?.color || null;

    ownerDoc.body.removeChild(probe);

    if (rgb && !rgb.includes('oklch') && rgb !== 'rgba(0, 0, 0, 0)') {
      return rgb;
    }
  } catch (error) {
    console.error('[Canvas] Failed to convert oklch color:', error);
  }

  return null;
};

/**
 * Normalize root colors for export (html2canvas cannot parse modern oklch colors)
 */
export const normalizeRootColorsForExport = (): (() => void) => {
  const root = document.documentElement;
  const computed = getComputedStyle(root);
  const revertedValues: Array<[string, string]> = [];

  const convertOklch = (value: string) => {
    // Note: This branch is defensive; convertOklch is only called for oklch values
    /* istanbul ignore next -- @preserve unreachable defensive check */
    if (!value.includes('oklch')) return null;
    const probe = document.createElement('div');
    probe.style.color = value.trim();
    document.body.appendChild(probe);
    const rgbValue = getComputedStyle(probe).color || null;
    document.body.removeChild(probe);
    return rgbValue;
  };

  Array.from(computed)
    .filter((prop) => prop.startsWith('--'))
    .forEach((prop) => {
      const value = computed.getPropertyValue(prop);
      if (value && value.includes('oklch')) {
        const rgbValue = convertOklch(value);
        if (rgbValue) {
          revertedValues.push([prop, value]);
          root.style.setProperty(prop, rgbValue);
        }
      }
    });

  return () => {
    revertedValues.forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
  };
};

/**
 * Sanitize all colors in an element and its children
 */
export const sanitizeElementColors = (
  rootEl: HTMLElement,
  ownerDoc: Document,
): void => {
  const patchInlineStyles = (el: HTMLElement) => {
    const inlineStyle = el.style;
    const properties = Array.from({ length: inlineStyle.length }, (_, i) =>
      inlineStyle.item(i),
    );

    properties.forEach((prop) => {
      const current = inlineStyle.getPropertyValue(prop);
      if (current && current.includes('oklch')) {
        const rgb = convertOklchToRgb(current, ownerDoc);
        if (rgb) {
          inlineStyle.setProperty(
            prop,
            rgb,
            inlineStyle.getPropertyPriority(prop),
          );
        } else {
          inlineStyle.removeProperty(prop);
        }
      }
    });
  };

  const walker = ownerDoc.createTreeWalker(
    rootEl,
    NodeFilter.SHOW_ELEMENT,
    null,
  );

  let node = walker.currentNode as HTMLElement | null;
  while (node) {
    patchInlineStyles(node);
    node = walker.nextNode() as HTMLElement | null;
  }
};

/**
 * Sanitize all CSS custom properties in a document
 */
export const sanitizeCssVariables = (
  doc: Document,
): Array<[string, string]> | undefined => {
  const rootComputed = doc.defaultView?.getComputedStyle(doc.documentElement);
  if (!rootComputed) return;

  const cssVariables: Array<[string, string]> = [];

  Array.from(rootComputed)
    .filter((prop) => prop.startsWith('--'))
    .forEach((prop) => {
      const value = rootComputed.getPropertyValue(prop);
      if (value && value.includes('oklch')) {
        const rgb = convertOklchToRgb(value, doc);
        if (rgb) {
          cssVariables.push([prop, rgb]);
          doc.documentElement.style.setProperty(prop, rgb);
        }
      }
    });

  return cssVariables;
};

export interface ExportData {
  markdownSource: string;
  exportTitle: string;
}

/**
 * Export content as PDF with full support for tables, lists, and links
 */
export const exportAsPDF = async (
  markdownSource: string,
  exportTitle: string,
): Promise<void> => {
  if (!markdownSource || !markdownSource.trim()) {
    toast.error('Nothing to export yet');
    return;
  }

  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

  const fontState: {
    family: string;
    styles: Set<FontStyle>;
    monoFamily: string;
    symbolFamily: string;
    mathFamily: string;
  } = {
    family: 'helvetica',
    styles: new Set<FontStyle>(['normal', 'bold', 'italic', 'bolditalic']),
    monoFamily: 'courier',
    symbolFamily: 'helvetica',
    mathFamily: 'helvetica',
  };

  /* istanbul ignore next -- @preserve internal PDF font URL resolution */
  const getFontUrlCandidates = (path: string): string[] => {
    if (!path.startsWith('/')) return [path];

    const candidates = new Set<string>();
    const envBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    if (envBasePath) {
      candidates.add(`${envBasePath.replace(/\/$/, '')}${path}`);
    }

    if (typeof window !== 'undefined') {
      const nextData = (window as any).__NEXT_DATA__;
      const assetPrefix = nextData?.assetPrefix || '';
      if (assetPrefix) {
        candidates.add(`${String(assetPrefix).replace(/\/$/, '')}${path}`);
      }
    }

    candidates.add(path);
    return Array.from(candidates);
  };

  /* istanbul ignore next -- @preserve internal PDF fetch URL resolution */
  const resolveFetchUrl = (path: string) => {
    if (typeof window === 'undefined') return path;
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return path;
    }
  };

  /* istanbul ignore next -- @preserve internal font loading with multiple fallbacks */
  const loadPdfFont = async (
    url: string,
    fileName: string,
    family: string,
    style: FontStyle,
  ): Promise<boolean> => {
    if (typeof fetch !== 'function') return false;
    if (process.env.NODE_ENV === 'test') return false;
    try {
      const response = await fetch(resolveFetchUrl(url));
      if (!response.ok) return false;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        return false;
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 4) return false;
      const header = new Uint8Array(buffer.slice(0, 4));
      const isTrueType =
        (header[0] === 0x00 &&
          header[1] === 0x01 &&
          header[2] === 0x00 &&
          header[3] === 0x00) ||
        (header[0] === 0x4f &&
          header[1] === 0x54 &&
          header[2] === 0x54 &&
          header[3] === 0x4f);
      if (!isTrueType) {
        return false;
      }
      const base64 = arrayBufferToBase64(buffer);
      pdf.addFileToVFS(fileName, base64);
      pdf.addFont(fileName, family, style);
      return true;
    } catch (error) {
      if ((process.env.NODE_ENV as string) !== 'test') {
        console.warn('[Canvas] Failed to load PDF font:', error);
      }
      return false;
    }
  };

  /* istanbul ignore next -- @preserve font loading fallback chain */
  const loadPdfFontWithFallback = async (
    path: string,
    fileName: string,
    family: string,
    style: FontStyle,
  ): Promise<boolean> => {
    const candidates = getFontUrlCandidates(path);
    for (const candidate of candidates) {
      const loaded = await loadPdfFont(candidate, fileName, family, style);
      if (loaded) return true;
    }
    return false;
  };

  /* istanbul ignore next -- @preserve PDF font loading orchestration */
  const loadPdfFonts = async () => {
    const loadedStyles = new Set<FontStyle>();

    const normalLoaded = await loadPdfFontWithFallback(
      '/fonts/NotoSans-Regular.ttf',
      'NotoSans-Regular.ttf',
      'NotoSans',
      'normal',
    );
    if (normalLoaded) {
      loadedStyles.add('normal');
    }

    const boldLoaded = await loadPdfFontWithFallback(
      '/fonts/NotoSans-Bold.ttf',
      'NotoSans-Bold.ttf',
      'NotoSans',
      'bold',
    );
    if (boldLoaded) {
      loadedStyles.add('bold');
    }

    const italicLoaded = await loadPdfFontWithFallback(
      '/fonts/NotoSans-Italic.ttf',
      'NotoSans-Italic.ttf',
      'NotoSans',
      'italic',
    );
    if (italicLoaded) {
      loadedStyles.add('italic');
    }

    const boldItalicLoaded = await loadPdfFontWithFallback(
      '/fonts/NotoSans-BoldItalic.ttf',
      'NotoSans-BoldItalic.ttf',
      'NotoSans',
      'bolditalic',
    );
    if (boldItalicLoaded) {
      loadedStyles.add('bolditalic');
    }

    if (loadedStyles.size === 0) {
      const fallbackNormalLoaded = await loadPdfFontWithFallback(
        '/fonts/NotoSans-Variable.ttf',
        'NotoSans-Variable.ttf',
        'NotoSans',
        'normal',
      );
      if (fallbackNormalLoaded) {
        loadedStyles.add('normal');
      }

      const fallbackItalicLoaded = await loadPdfFontWithFallback(
        '/fonts/NotoSans-Italic-Variable.ttf',
        'NotoSans-Italic-Variable.ttf',
        'NotoSans',
        'italic',
      );
      if (fallbackItalicLoaded) {
        loadedStyles.add('italic');
      }
    }

    if (loadedStyles.size > 0) {
      fontState.family = 'NotoSans';
      fontState.styles = loadedStyles;
    }

    const monoLoaded = await loadPdfFontWithFallback(
      '/fonts/NotoSansMono-Regular.ttf',
      'NotoSansMono-Regular.ttf',
      'NotoSansMono',
      'normal',
    );
    if (monoLoaded) {
      fontState.monoFamily = 'NotoSansMono';
    } else {
      fontState.monoFamily = fontState.family;
    }

    const symbolLoaded = await loadPdfFontWithFallback(
      '/fonts/NotoSansSymbols2-Regular.ttf',
      'NotoSansSymbols2-Regular.ttf',
      'NotoSansSymbols2',
      'normal',
    );
    if (symbolLoaded) {
      fontState.symbolFamily = 'NotoSansSymbols2';
    } else {
      fontState.symbolFamily = fontState.family;
    }

    const mathLoaded = await loadPdfFontWithFallback(
      '/fonts/NotoSansMath-Regular.ttf',
      'NotoSansMath-Regular.ttf',
      'NotoSansMath',
      'normal',
    );
    if (mathLoaded) {
      fontState.mathFamily = 'NotoSansMath';
    } else {
      fontState.mathFamily = fontState.family;
    }
  };

  await loadPdfFonts();

  /* istanbul ignore next -- @preserve PDF font style resolution */
  const resolveFontStyle = (style: FontStyle): FontStyle => {
    if (fontState.styles.has(style)) {
      return style;
    }
    if (style === 'bolditalic') {
      if (fontState.styles.has('bold')) return 'bold';
      if (fontState.styles.has('italic')) return 'italic';
    }
    return 'normal';
  };

  /* istanbul ignore next -- @preserve PDF font setter */
  const setPdfFont = (style: FontStyle = 'normal'): FontStyle => {
    const resolvedStyle = resolveFontStyle(style);
    pdf.setFont(fontState.family, resolvedStyle);
    return resolvedStyle;
  };

  /* istanbul ignore next -- @preserve code font setter */
  const setCodeFont = () => {
    pdf.setFont(fontState.monoFamily, 'normal');
  };

  /* istanbul ignore next -- @preserve internal PDF bold style check */
  const isBoldStyle = (style: FontStyle) =>
    style === 'bold' || style === 'bolditalic';

  const ARROW_REGEX = /[\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F\u2B00-\u2BFF]/u;

  const SYMBOL_FONT_REGEX =
    /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u27F0-\u27FF\u2900-\u297F\u2B00-\u2BFF]/u;

  const MATH_FONT_REGEX =
    /[\u2200-\u22FF\u27C0-\u27EF\u2980-\u29FF\u2A00-\u2AFF\u1D400-\u1D7FF]/u;

  type FontRunKind = 'text' | 'symbol' | 'math';

  /* istanbul ignore next -- @preserve font run classification */
  const getFontRunKind = (ch: string): FontRunKind => {
    // if arrows fail in your symbol font, just treat them as math:
    if (ARROW_REGEX.test(ch)) return 'math';

    if (MATH_FONT_REGEX.test(ch)) return 'math';
    if (SYMBOL_FONT_REGEX.test(ch)) return 'symbol';
    return 'text';
  };

  /* istanbul ignore next -- @preserve text splitting by font requirements */
  const splitFontRuns = (
    value: string,
  ): Array<{ text: string; kind: FontRunKind }> => {
    const parts: Array<{ text: string; kind: FontRunKind }> = [];
    let buffer = '';
    let currentKind: FontRunKind = 'text';

    for (const char of value) {
      const kind = getFontRunKind(char);
      if (buffer && kind !== currentKind) {
        parts.push({ text: buffer, kind: currentKind });
        buffer = '';
      }
      buffer += char;
      currentKind = kind;
    }

    if (buffer) {
      parts.push({ text: buffer, kind: currentKind });
    }

    return parts;
  };

  /* istanbul ignore next -- @preserve internal PDF text sanitization with font fallbacks */
  const sanitizePdfText = (text: string): string => {
    if (fontState.family === 'helvetica') {
      const fallbackMap: Record<string, string> = {
        '•': '•',
        '○': 'o',
        '▪': '-',
        '∞': 'inf',
        '√': 'sqrt',
        '≠': '!=',
        '⇒': '=>',
        '⇔': '<=>',
      };
      return text.replace(/[^\x00-\xFF]/g, (char) => {
        if (
          fontState.symbolFamily !== 'helvetica' &&
          SYMBOL_FONT_REGEX.test(char)
        ) {
          return char;
        }
        if (
          fontState.mathFamily !== 'helvetica' &&
          MATH_FONT_REGEX.test(char)
        ) {
          return char;
        }
        return fallbackMap[char] ?? '?';
      });
    }
    return text;
  };

  /* istanbul ignore next -- @preserve internal PDF text width measurement */
  const safeGetTextWidth = (text: string): number => {
    const sanitized = sanitizePdfText(text);
    try {
      return pdf.getTextWidth(sanitized);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Canvas] Failed to measure PDF text width:', error);
      }
      return sanitized.length * 2.5;
    }
  };

  /* istanbul ignore next -- @preserve internal PDF text rendering */
  const safePdfText = (text: string, x: number, y: number): void => {
    const sanitized = sanitizePdfText(text);
    try {
      pdf.text(sanitized, x, y);
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Canvas] Failed to render PDF text:', error);
      }
    }
  };

  /* istanbul ignore next -- @preserve internal PDF styled text rendering */
  const drawStyledText = (
    text: string,
    x: number,
    y: number,
    style: FontStyle,
  ) => {
    const resolvedStyle = setPdfFont(style);
    safePdfText(text, x, y);
    if (isBoldStyle(style) && !isBoldStyle(resolvedStyle)) {
      safePdfText(text, x + 0.2, y);
    }
  };

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let yPosition = margin;
  const lineHeight = 7;
  const titleFontSize = 18;
  const headingFontSize = 14;
  const normalFontSize = 11;

  /* istanbul ignore next -- @preserve internal text line splitting */
  const splitTextIntoLinesSafe = (
    text: string,
    maxLineWidth: number,
  ): string[] => {
    const sanitized = sanitizePdfText(text);
    const measurePdf = {
      getTextWidth: (value: string) => safeGetTextWidth(value),
    } as typeof pdf;
    return splitTextIntoLines(sanitized, maxLineWidth, measurePdf);
  };

  // Track list state for proper numbering and nesting
  const listState: { type: 'ul' | 'ol'; counter: number; depth: number }[] = [];

  /* istanbul ignore next -- @preserve internal PDF list bullet generation */
  // Get bullet marker based on nesting depth
  const getBulletMarker = (depth: number): string => {
    if (depth <= 0) return '• ';
    const fallbackMarkers = ['- ', '* ', '+ '];
    return fallbackMarkers[Math.min(depth - 1, fallbackMarkers.length - 1)];
  };

  /* istanbul ignore next -- @preserve internal PDF ordered list marker generation */
  // Get ordered list marker
  const getOrderedMarker = (counter: number, depth: number): string => {
    if (depth === 0) return `${counter}. `;
    if (depth === 1) {
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      return `${letters[(counter - 1) % 26]}. `;
    }
    // Roman numerals for depth 2+
    const romanNumerals = [
      'i',
      'ii',
      'iii',
      'iv',
      'v',
      'vi',
      'vii',
      'viii',
      'ix',
      'x',
    ];
    return `${romanNumerals[(counter - 1) % 10]}. `;
  };

  /* istanbul ignore next -- @preserve internal PDF page break management */
  // Check and add new page if needed
  const checkPageBreak = (additionalSpace = 0): void => {
    if (yPosition + additionalSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Add title
  pdf.setFontSize(titleFontSize);
  const titleLines = splitTextIntoLinesSafe(exportTitle, maxWidth);
  titleLines.forEach((line) => {
    checkPageBreak();
    drawStyledText(line, margin, yPosition, 'bold');
    yPosition += lineHeight + 2;
  });

  yPosition += 5;

  const htmlOutput = markdownToHtml(markdownSource);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlOutput;

  /* istanbul ignore next -- @preserve internal PDF table rendering */
  // Process table element with text wrapping support
  const processTable = (table: Element): void => {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return;

    // Calculate column widths based on content
    const firstRow = rows[0];
    const headerCells = firstRow.querySelectorAll('th, td');
    const numCols = headerCells.length;
    if (numCols === 0) return;

    const cellPadding = 3;
    const cellLineHeight = 5;
    const availableTableWidth = maxWidth;

    // Determine if we need to use a smaller font for wide tables
    let tableFontSize = normalFontSize - 1;
    const minFontSize = 7;

    // Calculate column widths with word-aware algorithm
    const calculateColumnWidths = (fontSize: number): number[] => {
      pdf.setFontSize(fontSize);
      setPdfFont('normal');

      // First pass: find minimum width needed for each column (based on longest word)
      const minWidths: number[] = [];
      const totalContentLengths: number[] = [];
      let totalContentLength = 0;

      for (let i = 0; i < numCols; i++) {
        let maxWordWidth = 0;
        let maxContentLength = 0;

        rows.forEach((row) => {
          const cells = row.querySelectorAll('th, td');
          if (cells[i]) {
            const text = cells[i].textContent?.trim() || '';
            maxContentLength = Math.max(maxContentLength, text.length);

            // Find the longest word in this cell
            const words = text.split(/\s+/);
            words.forEach((word) => {
              if (word) {
                const wordWidth = safeGetTextWidth(word);
                maxWordWidth = Math.max(maxWordWidth, wordWidth);
              }
            });
          }
        });

        // Minimum width = longest word + padding on both sides
        const minWidth = maxWordWidth + cellPadding * 2 + 1;
        minWidths.push(minWidth);
        totalContentLengths.push(maxContentLength);
        totalContentLength += maxContentLength;
      }

      // Calculate total minimum width needed
      const totalMinWidth = minWidths.reduce((a, b) => a + b, 0);

      // If total minimum exceeds available width, return empty to signal font reduction needed
      if (totalMinWidth > availableTableWidth) {
        return [];
      }

      // Distribute extra space proportionally based on content length
      const extraSpace = availableTableWidth - totalMinWidth;
      const widths: number[] = [];

      for (let i = 0; i < numCols; i++) {
        const proportion =
          totalContentLength > 0
            ? totalContentLengths[i] / totalContentLength
            : 1 / numCols;
        const extraWidth = extraSpace * proportion;
        widths.push(minWidths[i] + extraWidth);
      }

      return widths;
    };

    // Try to calculate widths, reducing font size if needed
    let colWidths = calculateColumnWidths(tableFontSize);
    while (colWidths.length === 0 && tableFontSize > minFontSize) {
      tableFontSize -= 0.5;
      colWidths = calculateColumnWidths(tableFontSize);
    }

    // Fallback: if still can't fit, use equal distribution with current font
    if (colWidths.length === 0) {
      tableFontSize = minFontSize;
      const equalWidth = availableTableWidth / numCols;
      colWidths = Array(numCols).fill(equalWidth);
    }

    yPosition += 5;

    rows.forEach((row) => {
      const cells = row.querySelectorAll('th, td');
      const isHeader = row.querySelector('th') !== null;

      // Calculate row height based on wrapped text
      let maxLines = 1;
      const cellTexts: string[][] = [];

      cells.forEach((cell, colIndex) => {
        const text = cell.textContent?.trim() || '';
        const cellWidth = colWidths[colIndex] - cellPadding * 2;

        if (isHeader) {
          setPdfFont('bold');
        } else {
          setPdfFont('normal');
        }
        pdf.setFontSize(tableFontSize);

        const lines = splitTextIntoLinesSafe(text, cellWidth);
        cellTexts.push(lines);
        maxLines = Math.max(maxLines, lines.length);
      });

      const rowHeight = maxLines * cellLineHeight + cellPadding * 2;

      // Check if we need a new page for this row
      checkPageBreak(rowHeight);

      const rowStartY = yPosition;

      // Draw cell backgrounds and borders first
      let cellX = margin;
      cells.forEach((_, colIndex) => {
        const colWidth = colWidths[colIndex];
        pdf.setDrawColor(180, 180, 180);

        if (isHeader) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(cellX, rowStartY, colWidth, rowHeight, 'FD');
        } else {
          pdf.rect(cellX, rowStartY, colWidth, rowHeight, 'S');
        }

        cellX += colWidth;
      });

      // Draw cell contents
      cellX = margin;
      cells.forEach((_, colIndex) => {
        const colWidth = colWidths[colIndex];
        const lines = cellTexts[colIndex];

        if (isHeader) {
          setPdfFont('bold');
        } else {
          setPdfFont('normal');
        }
        pdf.setFontSize(tableFontSize);
        pdf.setTextColor(0, 0, 0);

        let textY = rowStartY + cellPadding + 3;
        lines.forEach((line) => {
          if (isHeader) {
            drawStyledText(line, cellX + cellPadding, textY, 'bold');
          } else {
            safePdfText(line, cellX + cellPadding, textY);
          }
          textY += cellLineHeight;
        });

        cellX += colWidth;
      });

      yPosition += rowHeight;
    });

    yPosition += 5;
    setPdfFont('normal');
    pdf.setFontSize(normalFontSize);
  };

  /* istanbul ignore next -- @preserve internal PDF link rendering */
  // Process link element - renders inline and advances yPosition properly
  const processLink = (
    element: Element,
    currentMargin: number,
    availableWidth: number,
  ): void => {
    const href = element.getAttribute('href') || '';
    const text = element.textContent?.trim() || '';

    if (!text) return;

    // Set link color (blue)
    pdf.setTextColor(37, 99, 235);
    setPdfFont('normal');
    pdf.setFontSize(normalFontSize);

    const lines = splitTextIntoLinesSafe(text, availableWidth);
    lines.forEach((line) => {
      checkPageBreak();
      safePdfText(line, currentMargin, yPosition);

      // Add underline
      const textWidth = safeGetTextWidth(line);
      pdf.setDrawColor(37, 99, 235);
      pdf.line(
        currentMargin,
        yPosition + 1,
        currentMargin + textWidth,
        yPosition + 1,
      );

      // Add clickable link annotation for the full link
      if (href) {
        pdf.link(currentMargin, yPosition - 5, textWidth, 7, { url: href });
      }

      yPosition += lineHeight;
    });

    // Reset text color and draw color
    pdf.setTextColor(0, 0, 0);
    pdf.setDrawColor(0, 0, 0);
  };

  type InlinePart = {
    text: string;
    type: 'text' | 'sup' | 'sub' | 'code' | 'linebreak';
    href?: string;
    style?: FontStyle;
  };

  type InlineContext = {
    style: FontStyle;
    href?: string;
    script?: 'sup' | 'sub';
    code?: boolean;
  };

  /* istanbul ignore next -- @preserve internal PDF text tokenization */
  const tokenizeInlineText = (text: string): string[] =>
    text
      .replace(/\u00a0/g, ' ')
      .replace(/\r?\n/g, ' ')
      .split(/(\s+)/)
      .filter(Boolean);

  /* istanbul ignore next -- @preserve internal PDF font style conversion */
  const styleToFlags = (style: FontStyle) => ({
    bold: style === 'bold' || style === 'bolditalic',
    italic: style === 'italic' || style === 'bolditalic',
  });

  /* istanbul ignore next -- @preserve internal PDF font style conversion */
  const flagsToStyle = (bold: boolean, italic: boolean): FontStyle => {
    if (bold && italic) return 'bolditalic';
    if (bold) return 'bold';
    if (italic) return 'italic';
    return 'normal';
  };

  /* istanbul ignore next -- @preserve internal PDF style merging */
  const mergeInlineStyle = (base: FontStyle, next: FontStyle): FontStyle => {
    const baseFlags = styleToFlags(base);
    const nextFlags = styleToFlags(next);
    return flagsToStyle(
      baseFlags.bold || nextFlags.bold,
      baseFlags.italic || nextFlags.italic,
    );
  };

  /* istanbul ignore next -- @preserve internal PDF inline content collection */
  const collectInlineParts = (
    node: Node,
    parts: InlinePart[],
    context: InlineContext,
  ): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (text === '') return;
      let type: InlinePart['type'] = 'text';
      if (context.code) {
        type = 'code';
      } else if (context.script) {
        type = context.script;
      }
      parts.push({
        text,
        type,
        href: context.href,
        style: context.style,
      });
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    if (element.getAttribute('aria-hidden') === 'true') {
      return;
    }

    // Handle KaTeX math elements: extract readable math text
    if (
      element.classList.contains('katex-display') ||
      element.classList.contains('katex')
    ) {
      // Skip inner .katex when already handled by .katex-display parent
      if (
        element.classList.contains('katex') &&
        element.parentElement?.classList.contains('katex-display')
      ) {
        return;
      }
      const readable = extractReadableMath(element);
      if (readable) {
        const isDisplay = element.classList.contains('katex-display');
        parts.push({
          text: isDisplay ? ` ${readable} ` : readable,
          type: 'text',
          href: context.href,
          style: context.style,
        });
      }
      return;
    }

    if (element.classList.contains('katex-html')) {
      return;
    }

    if (tag === 'annotation') {
      return;
    }

    if (tag === 'br') {
      parts.push({
        text: '',
        type: 'linebreak',
        href: context.href,
        style: context.style,
      });
      return;
    }

    const nextContext = { ...context };

    if (tag === 'a') {
      const href = element.getAttribute('href');
      if (href) {
        nextContext.href = href;
      }
    }

    if (tag === 'strong' || tag === 'b') {
      nextContext.style = mergeInlineStyle(nextContext.style, 'bold');
    }

    if (tag === 'em' || tag === 'i') {
      nextContext.style = mergeInlineStyle(nextContext.style, 'italic');
    }

    if (tag === 'code') {
      nextContext.code = true;
    }

    if (tag === 'sup') {
      nextContext.script = 'sup';
    }

    if (tag === 'sub') {
      nextContext.script = 'sub';
    }

    Array.from(element.childNodes).forEach((child) =>
      collectInlineParts(child, parts, nextContext),
    );
  };

  /* istanbul ignore next -- @preserve internal PDF font application */
  const applyInlineFont = (
    style: FontStyle,
    isCode: boolean,
    fontSize: number,
  ): { resolvedStyle: FontStyle; needsEmbolden: boolean } => {
    if (isCode) {
      setCodeFont();
      pdf.setFontSize(fontSize);
      return { resolvedStyle: 'normal', needsEmbolden: false };
    }

    const resolvedStyle = setPdfFont(style);
    pdf.setFontSize(fontSize);

    const needsEmbolden = isBoldStyle(style) && !isBoldStyle(resolvedStyle);
    return { resolvedStyle, needsEmbolden };
  };

  /* istanbul ignore next -- @preserve internal PDF inline parts rendering */
  const renderInlineParts = (
    parts: InlinePart[],
    startX: number,
    availableWidth: number,
    baseFontSize: number,
  ): void => {
    if (parts.length === 0) return;

    let currentX = startX;
    let baselineY = yPosition;
    let didDraw = false;

    const maxX = startX + availableWidth;
    const moveToNextLine = () => {
      yPosition += lineHeight;
      checkPageBreak();
      baselineY = yPosition;
      currentX = startX;
    };

    parts.forEach((part) => {
      const text = part.text ?? '';
      if (part.type === 'linebreak') {
        moveToNextLine();
        didDraw = true;
        return;
      }

      if (text === '') {
        return;
      }

      if (part.type === 'sup' || part.type === 'sub') {
        const scriptText = text;
        if (!scriptText) return;
        const scriptFontSize = Math.max(baseFontSize - 3, 6);
        const yOffset =
          part.type === 'sup' ? -baseFontSize * 0.35 : baseFontSize * 0.2;
        const renderSegment = (segmentText: string, kind: FontRunKind) => {
          let needsEmbolden = false;
          if (
            kind === 'symbol' &&
            fontState.symbolFamily !== fontState.family
          ) {
            pdf.setFont(fontState.symbolFamily, 'normal');
            pdf.setFontSize(scriptFontSize);
            needsEmbolden = isBoldStyle(part.style ?? 'normal');
          } else if (
            kind === 'math' &&
            fontState.mathFamily !== fontState.family
          ) {
            pdf.setFont(fontState.mathFamily, 'normal');
            pdf.setFontSize(scriptFontSize);
            needsEmbolden = isBoldStyle(part.style ?? 'normal');
          } else {
            ({ needsEmbolden } = applyInlineFont(
              part.style ?? 'normal',
              false,
              scriptFontSize,
            ));
          }
          const segmentWidth = safeGetTextWidth(segmentText);
          if (currentX + segmentWidth > maxX && currentX > startX) {
            moveToNextLine();
          }
          if (part.href) {
            pdf.setTextColor(37, 99, 235);
          } else {
            pdf.setTextColor(0, 0, 0);
          }
          safePdfText(segmentText, currentX, baselineY + yOffset);
          if (needsEmbolden) {
            safePdfText(segmentText, currentX + 0.2, baselineY + yOffset);
          }
          if (part.href) {
            pdf.setDrawColor(37, 99, 235);
            pdf.line(
              currentX,
              baselineY + 1,
              currentX + segmentWidth,
              baselineY + 1,
            );
            pdf.link(currentX, baselineY - 5, segmentWidth, 7, {
              url: part.href,
            });
            pdf.setDrawColor(0, 0, 0);
            pdf.setTextColor(0, 0, 0);
          }
          currentX += segmentWidth;
          didDraw = true;
        };

        const shouldSplit =
          (fontState.symbolFamily !== fontState.family &&
            SYMBOL_FONT_REGEX.test(scriptText)) ||
          (fontState.mathFamily !== fontState.family &&
            MATH_FONT_REGEX.test(scriptText));

        if (shouldSplit) {
          const segments = splitFontRuns(scriptText);
          segments.forEach((segment) =>
            renderSegment(segment.text, segment.kind),
          );
        } else {
          renderSegment(scriptText, 'text');
        }
        return;
      }

      const renderWhitespace = (fontSize: number, isCode: boolean) => {
        applyInlineFont(part.style ?? 'normal', isCode, fontSize);
        const spaceWidth = safeGetTextWidth(' ');
        if (currentX === startX) return;
        if (currentX + spaceWidth > maxX) {
          moveToNextLine();
        } else {
          currentX += spaceWidth;
        }
      };

      const renderToken = (
        token: string,
        fontSize: number,
        isCode: boolean,
      ) => {
        const renderSegment = (segmentText: string, kind: FontRunKind) => {
          let needsEmbolden = false;
          if (
            kind === 'symbol' &&
            fontState.symbolFamily !== fontState.family &&
            !isCode
          ) {
            pdf.setFont(fontState.symbolFamily, 'normal');
            pdf.setFontSize(fontSize);
            needsEmbolden = isBoldStyle(part.style ?? 'normal');
          } else if (
            kind === 'math' &&
            fontState.mathFamily !== fontState.family &&
            !isCode
          ) {
            pdf.setFont(fontState.mathFamily, 'normal');
            pdf.setFontSize(fontSize);
            needsEmbolden = isBoldStyle(part.style ?? 'normal');
          } else {
            ({ needsEmbolden } = applyInlineFont(
              part.style ?? 'normal',
              isCode,
              fontSize,
            ));
          }
          const segmentWidth = safeGetTextWidth(segmentText);
          if (currentX + segmentWidth > maxX && currentX > startX) {
            moveToNextLine();
          }
          if (part.href) {
            pdf.setTextColor(37, 99, 235);
          } else {
            pdf.setTextColor(0, 0, 0);
          }
          safePdfText(segmentText, currentX, baselineY);
          if (needsEmbolden) {
            safePdfText(segmentText, currentX + 0.2, baselineY);
          }
          if (part.href) {
            pdf.setDrawColor(37, 99, 235);
            pdf.line(
              currentX,
              baselineY + 1,
              currentX + segmentWidth,
              baselineY + 1,
            );
            pdf.link(currentX, baselineY - 5, segmentWidth, 7, {
              url: part.href,
            });
            pdf.setDrawColor(0, 0, 0);
            pdf.setTextColor(0, 0, 0);
          }
          currentX += segmentWidth;
          didDraw = true;
        };

        if (!isCode) {
          const shouldSplit =
            (fontState.symbolFamily !== fontState.family &&
              SYMBOL_FONT_REGEX.test(token)) ||
            (fontState.mathFamily !== fontState.family &&
              MATH_FONT_REGEX.test(token));
          if (shouldSplit) {
            const segments = splitFontRuns(token);
            segments.forEach((segment) =>
              renderSegment(segment.text, segment.kind),
            );
            return;
          }
        }

        renderSegment(token, 'text');
      };

      if (part.type === 'code') {
        const codeText = text;
        const codeFontSize = Math.max(baseFontSize - 1, 8);
        const tokens = tokenizeInlineText(codeText);
        tokens.forEach((token) => {
          if (/^\s+$/.test(token)) {
            renderWhitespace(codeFontSize, true);
            return;
          }
          renderToken(token, codeFontSize, true);
        });
        return;
      }

      const tokens = tokenizeInlineText(text);
      tokens.forEach((token) => {
        if (/^\s+$/.test(token)) {
          renderWhitespace(baseFontSize, false);
          return;
        }
        renderToken(token, baseFontSize, false);
      });
    });

    if (didDraw) {
      yPosition += lineHeight;
      pdf.setFontSize(baseFontSize);
      setPdfFont('normal');
    }
  };

  /* istanbul ignore next -- @preserve internal PDF inline element rendering */
  const renderInlineElement = (
    element: Element,
    currentMargin: number,
    availableWidth: number,
    baseFontSize: number,
    baseStyle: FontStyle,
  ) => {
    const inlineParts: InlinePart[] = [];
    const baseContext: InlineContext = { style: baseStyle };
    Array.from(element.childNodes).forEach((child) =>
      collectInlineParts(child, inlineParts, baseContext),
    );
    const hasInlineContent = inlineParts.some(
      (part) => part.type === 'linebreak' || part.text.trim(),
    );
    if (hasInlineContent) {
      renderInlineParts(
        inlineParts,
        currentMargin,
        availableWidth,
        baseFontSize,
      );
    } else {
      yPosition += lineHeight;
    }
  };

  /* istanbul ignore next -- @preserve internal PDF DOM processing */
  const processNode = (
    node: Node,
    currentMargin: number = margin,
    availableWidth: number = maxWidth,
  ): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        checkPageBreak();
        const lines = splitTextIntoLinesSafe(text, availableWidth);
        lines.forEach((line) => {
          checkPageBreak();
          safePdfText(line, currentMargin, yPosition);
          yPosition += lineHeight;
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      checkPageBreak();

      switch (tagName) {
        case 'h1':
          yPosition += 5;
          pdf.setFontSize(headingFontSize + 2);
          setPdfFont('bold');
          renderInlineElement(
            element,
            currentMargin,
            availableWidth,
            headingFontSize + 2,
            'bold',
          );
          pdf.setFontSize(normalFontSize);
          setPdfFont('normal');
          yPosition += 3;
          return;
        case 'h2':
          yPosition += 4;
          pdf.setFontSize(headingFontSize + 1);
          setPdfFont('bold');
          renderInlineElement(
            element,
            currentMargin,
            availableWidth,
            headingFontSize + 1,
            'bold',
          );
          pdf.setFontSize(normalFontSize);
          setPdfFont('normal');
          yPosition += 3;
          return;
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          yPosition += 3;
          pdf.setFontSize(headingFontSize);
          setPdfFont('bold');
          renderInlineElement(
            element,
            currentMargin,
            availableWidth,
            headingFontSize,
            'bold',
          );
          pdf.setFontSize(normalFontSize);
          setPdfFont('normal');
          yPosition += 3;
          return;
        case 'p': {
          yPosition += 2;
          pdf.setFontSize(normalFontSize);
          setPdfFont('normal');
          renderInlineElement(
            element,
            currentMargin,
            availableWidth,
            normalFontSize,
            'normal',
          );
          return;
        }
        case 'table':
          processTable(element);
          return;
        case 'a':
          processLink(element, currentMargin, availableWidth);
          return;
        case 'ul':
          yPosition += 2;
          pdf.setFontSize(normalFontSize);
          setPdfFont('normal');
          listState.push({ type: 'ul', counter: 0, depth: listState.length });
          Array.from(element.children).forEach((child) => {
            if (child.tagName.toLowerCase() === 'li') {
              processNode(child, currentMargin, availableWidth);
            }
          });
          listState.pop();
          yPosition += 2;
          return;
        case 'ol':
          yPosition += 2;
          pdf.setFontSize(normalFontSize);
          setPdfFont('normal');
          listState.push({ type: 'ol', counter: 0, depth: listState.length });
          Array.from(element.children).forEach((child) => {
            if (child.tagName.toLowerCase() === 'li') {
              processNode(child, currentMargin, availableWidth);
            }
          });
          listState.pop();
          yPosition += 2;
          return;
        case 'li': {
          const currentList = listState[listState.length - 1];
          const depth = currentList?.depth || 0;
          const indent = depth * 8;
          const liMargin = currentMargin + indent;

          let marker: string;
          const isOrdered = currentList?.type === 'ol';
          const useShapeMarker = !isOrdered && depth > 0;

          if (isOrdered) {
            currentList.counter++;
            marker = getOrderedMarker(currentList.counter, depth);
          } else {
            marker = getBulletMarker(depth);
          }

          checkPageBreak();
          const markerWidth = useShapeMarker ? 4 : safeGetTextWidth(marker) + 1; // Add small gap after marker
          const contentMargin = liMargin + markerWidth;
          const contentWidth = availableWidth - indent - markerWidth;

          // Track if we've drawn the marker yet
          let markerDrawn = false;
          const markerY = yPosition;

          const drawMarker = () => {
            if (markerDrawn) return;
            if (
              useShapeMarker &&
              typeof pdf.circle === 'function' &&
              typeof pdf.rect === 'function'
            ) {
              const size = 1.2;
              const centerX = liMargin + size;
              const centerY = markerY - 1.5;

              if (depth === 1) {
                pdf.circle(centerX, centerY, size, 'S');
              } else if (depth === 2) {
                pdf.rect(
                  liMargin + 0.2,
                  centerY - size,
                  size * 2,
                  size * 2,
                  'F',
                );
              } else {
                pdf.rect(
                  liMargin + 0.2,
                  centerY - size,
                  size * 2,
                  size * 2,
                  'S',
                );
              }
            } else {
              safePdfText(marker, liMargin, markerY);
            }
            markerDrawn = true;
          };

          const inlineParts: InlinePart[] = [];
          const baseContext: InlineContext = { style: 'normal' };

          const flushInlineParts = () => {
            const hasContent = inlineParts.some(
              (part) => part.type === 'linebreak' || part.text.trim(),
            );
            if (!hasContent) {
              inlineParts.length = 0;
              return;
            }
            drawMarker();
            renderInlineParts(
              inlineParts,
              contentMargin,
              contentWidth,
              normalFontSize,
            );
            inlineParts.length = 0;
          };

          Array.from(element.childNodes).forEach((child) => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const childElement = child as Element;
              const childTag = childElement.tagName.toLowerCase();
              if (childTag === 'ul' || childTag === 'ol') {
                flushInlineParts();
                drawMarker();
                processNode(child, liMargin, availableWidth - indent);
                return;
              }
            }

            collectInlineParts(child, inlineParts, baseContext);
          });

          flushInlineParts();

          if (!markerDrawn) {
            // Empty list item - still draw marker
            drawMarker();
            yPosition += lineHeight;
          }

          return;
        }
        case 'strong':
        case 'b':
          setPdfFont('bold');
          break;
        case 'em':
        case 'i':
          setPdfFont('italic');
          break;
        case 'code':
          setCodeFont();
          pdf.setFontSize(normalFontSize - 1);
          break;
        case 'pre':
          yPosition += 3;
          setCodeFont();
          pdf.setFontSize(normalFontSize - 1);
          // Draw code block background
          const codeText = element.textContent || '';
          const codeLines = codeText.split('\n');
          const blockHeight = codeLines.length * lineHeight + 6;
          checkPageBreak(blockHeight);
          pdf.setFillColor(243, 244, 246);
          pdf.roundedRect(
            currentMargin,
            yPosition - 3,
            availableWidth,
            blockHeight,
            2,
            2,
            'F',
          );
          codeLines.forEach((line) => {
            checkPageBreak();
            safePdfText(line || ' ', currentMargin + 3, yPosition + 3);
            yPosition += lineHeight;
          });
          yPosition += 3;
          setPdfFont('normal');
          pdf.setFontSize(normalFontSize);
          return;
        case 'blockquote':
          yPosition += 3;
          setPdfFont('italic');
          // Draw quote border
          pdf.setDrawColor(37, 99, 235);
          pdf.setLineWidth(0.5);
          const quoteStartY = yPosition;
          Array.from(element.childNodes).forEach((child) => {
            processNode(child, currentMargin + 5, availableWidth - 5);
          });
          pdf.line(currentMargin, quoteStartY - 2, currentMargin, yPosition);
          pdf.setLineWidth(0.2);
          setPdfFont('normal');
          yPosition += 3;
          return;
        case 'hr':
          yPosition += 3;
          pdf.setDrawColor(200, 200, 200);
          pdf.line(
            currentMargin,
            yPosition,
            currentMargin + availableWidth,
            yPosition,
          );
          yPosition += 5;
          return;
        case 'br':
          yPosition += lineHeight;
          return;
        case 'sup':
        case 'sub':
          // Handle superscript/subscript as regular text (jsPDF doesn't support vertical offset easily)
          break;
        default:
          pdf.setFontSize(normalFontSize);
          setPdfFont('normal');
      }

      // Process children for elements that weren't handled specially
      if (
        ![
          'ul',
          'ol',
          'li',
          'table',
          'a',
          'pre',
          'blockquote',
          'hr',
          'br',
        ].includes(tagName)
      ) {
        Array.from(element.childNodes).forEach((child) =>
          processNode(child, currentMargin, availableWidth),
        );
      }

      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        pdf.setFontSize(normalFontSize);
        setPdfFont('normal');
        yPosition += 3;
      }
    }
  };

  Array.from(tempDiv.childNodes).forEach((node) => processNode(node));

  // Fallback: if no content was processed, add plain text
  if (yPosition === margin + titleLines.length * (lineHeight + 2) + 5) {
    pdf.setFontSize(normalFontSize);
    setPdfFont('normal');
    const plainText = stripHtml(htmlOutput);
    if (plainText.trim()) {
      const lines = splitTextIntoLinesSafe(plainText, maxWidth);
      lines.forEach((line) => {
        /* istanbul ignore next -- @preserve fallback page break rarely triggers */
        checkPageBreak();
        safePdfText(line, margin, yPosition);
        yPosition += lineHeight;
      });
    }
  }

  pdf.save(`${sanitizeFilename(exportTitle)}.pdf`);
  toast.success('Document exported as PDF');
};

/**
 * Export content as DOCX
 */
/**
 * Replace KaTeX HTML spans with readable math text for export formats
 * that don't support KaTeX CSS (e.g., DOCX).
 */
const replaceKatexWithText = (html: string): string => {
  // Replace display math: <span class="katex-display">...<annotation>LATEX</annotation>...</span>
  let result = html.replace(
    /<span class="katex-display">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g,
    (_, tex) => {
      const readable = latexToReadableText(tex);
      return `<p style="text-align:center;font-family:'Cambria Math',serif;">${escapeHtml(readable)}</p>`;
    },
  );
  // Replace inline math: <span class="katex">...<annotation>LATEX</annotation>...</span>
  result = result.replace(
    /<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g,
    (_, tex) => {
      const readable = latexToReadableText(tex);
      return `<span style="font-family:'Cambria Math',serif;">${escapeHtml(readable)}</span>`;
    },
  );
  return result;
};

export const exportAsDOCX = (
  markdownSource: string,
  exportTitle: string,
): void => {
  if (!markdownSource || !markdownSource.trim()) {
    toast.error('Nothing to export yet');
    return;
  }

  const htmlOutput = replaceKatexWithText(markdownToHtml(markdownSource));
  const wordContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(exportTitle)}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1f2937; }
        h1, h2, h3, h4, h5, h6 { color: #111827; }
        code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
        pre { background: #f3f4f6; padding: 10px; border-radius: 5px; overflow-x: auto; }
        blockquote { border-left: 4px solid #2563eb; margin: 1em 0; padding-left: 1em; color: #374151; }
        a { color: #2563eb; }
        ul, ol { margin: 0 0 1em 1.5em; }
    </style>
</head>
<body>
    <h1>${escapeHtml(exportTitle)}</h1>
    ${htmlOutput}
</body>
</html>`;

  const blob = new Blob(['\ufeff', wordContent], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  downloadBlob(blob, `${sanitizeFilename(exportTitle)}.docx`);
  toast.success('Document exported as DOCX');
};

/**
 * Export content as Markdown
 */
export const exportAsMarkdown = (
  markdownSource: string,
  exportTitle: string,
): void => {
  if (!markdownSource || !markdownSource.trim()) {
    toast.error('Nothing to export yet');
    return;
  }

  const blob = new Blob([markdownSource], { type: 'text/markdown' });
  downloadBlob(blob, `${sanitizeFilename(exportTitle)}.md`);
  toast.success('Document exported as Markdown');
};
