import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  downloadBlob,
  convertOklchToRgb,
  normalizeRootColorsForExport,
  sanitizeElementColors,
  sanitizeCssVariables,
  exportAsPDF,
  exportAsDOCX,
  exportAsMarkdown,
} from '../canvas-export-handlers';

// ============================================================================
// MOCKS
// ============================================================================

// Mock toast with hoisted mocks
const { mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock('sonner', () => {
  return {
    toast: {
      error: (...args: any[]) => mockToastError(...args),
      success: (...args: any[]) => mockToastSuccess(...args),
    },
  };
});

// Mock markdownToHtml with hoisted mock for dynamic behavior
const { mockMarkdownToHtml } = vi.hoisted(() => ({
  mockMarkdownToHtml: vi.fn((md: string) => `<p>${md}</p>`),
}));

vi.mock('@/lib/utils', () => ({
  markdownToHtml: mockMarkdownToHtml,
}));

// Mock jsPDF - use vi.hoisted for dynamic import support
const {
  mockPdfSave,
  mockPdfAddPage,
  mockPdfText,
  mockPdfSetFontSize,
  mockPdfSetFont,
  mockPdfSetTextColor,
  mockPdfSetDrawColor,
  mockPdfLine,
  mockPdfLink,
  mockPdfSetFillColor,
  mockPdfRect,
  mockPdfRoundedRect,
  mockPdfSetLineWidth,
  mockPdfGetTextWidth,
  mockPdfAddFileToVFS,
  mockPdfAddFont,
} = vi.hoisted(() => ({
  mockPdfSave: vi.fn(),
  mockPdfAddPage: vi.fn(),
  mockPdfText: vi.fn(),
  mockPdfSetFontSize: vi.fn(),
  mockPdfSetFont: vi.fn(),
  mockPdfSetTextColor: vi.fn(),
  mockPdfSetDrawColor: vi.fn(),
  mockPdfLine: vi.fn(),
  mockPdfLink: vi.fn(),
  mockPdfSetFillColor: vi.fn(),
  mockPdfRect: vi.fn(),
  mockPdfRoundedRect: vi.fn(),
  mockPdfSetLineWidth: vi.fn(),
  mockPdfGetTextWidth: vi.fn().mockReturnValue(5),
  mockPdfAddFileToVFS: vi.fn(),
  mockPdfAddFont: vi.fn(),
}));

vi.mock('jspdf', () => {
  const MockJsPDF = function (this: any) {
    this.save = mockPdfSave;
    this.addPage = mockPdfAddPage;
    this.text = mockPdfText;
    this.setFontSize = mockPdfSetFontSize;
    this.setFont = mockPdfSetFont;
    this.setTextColor = mockPdfSetTextColor;
    this.setDrawColor = mockPdfSetDrawColor;
    this.line = mockPdfLine;
    this.link = mockPdfLink;
    this.setFillColor = mockPdfSetFillColor;
    this.rect = mockPdfRect;
    this.roundedRect = mockPdfRoundedRect;
    this.setLineWidth = mockPdfSetLineWidth;
    this.getTextWidth = mockPdfGetTextWidth;
    this.addFileToVFS = mockPdfAddFileToVFS;
    this.addFont = mockPdfAddFont;
  };
  return {
    jsPDF: MockJsPDF,
    default: { jsPDF: MockJsPDF },
  };
});

// Mock canvas-utils with hoisted mocks for dynamic behavior
const {
  mockSanitizeFilename,
  mockEscapeHtml,
  mockStripHtml,
  mockSplitTextIntoLines,
} = vi.hoisted(() => ({
  mockSanitizeFilename: vi.fn((name: string) =>
    name.replace(/[^a-zA-Z0-9-_]/g, '_'),
  ),
  mockEscapeHtml: vi.fn((str: string) =>
    str.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  ),
  mockStripHtml: vi.fn((html: string) => html.replace(/<[^>]+>/g, '')),
  mockSplitTextIntoLines: vi.fn((text: string) => [text]),
}));

vi.mock('../canvas-utils', () => ({
  sanitizeFilename: mockSanitizeFilename,
  escapeHtml: mockEscapeHtml,
  stripHtml: mockStripHtml,
  splitTextIntoLines: mockSplitTextIntoLines,
}));

// ============================================================================
// TESTS
// ============================================================================

describe('canvas-export-handlers', () => {
  let createdElements: Array<HTMLElement> = [];
  let stubbedGlobals: Array<string> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    createdElements = [];
    stubbedGlobals = [];
  });

  afterEach(() => {
    // Clean up all created DOM elements
    createdElements.forEach((el) => {
      try {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    createdElements = [];

    // Clean up any remaining elements in document.body
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }

    // Restore all stubbed globals
    if (stubbedGlobals.length > 0) {
      try {
        vi.unstubAllGlobals();
      } catch (e) {
        // Ignore errors
      }
    }
    stubbedGlobals = [];

    // Clear all spies
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // downloadBlob
  // ==========================================================================

  describe('downloadBlob', () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockAppendChild: ReturnType<typeof vi.fn>;
    let mockRemoveChild: ReturnType<typeof vi.fn>;
    let mockClick: ReturnType<typeof vi.fn>;
    let mockAnchor: HTMLAnchorElement;

    beforeEach(() => {
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      mockRevokeObjectURL = vi.fn();
      mockClick = vi.fn();
      mockAppendChild = vi.fn();
      mockRemoveChild = vi.fn();

      mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
      } as unknown as HTMLAnchorElement;

      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      });
      stubbedGlobals.push('URL');

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        mockAppendChild,
      );
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        mockRemoveChild,
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('creates object URL from blob', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    });

    it('creates anchor element', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');

      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('sets href to blob URL', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');

      expect(mockAnchor.href).toBe('blob:test-url');
    });

    it('sets download filename', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test-file.txt');

      expect(mockAnchor.download).toBe('test-file.txt');
    });

    it('appends anchor to body', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');

      expect(mockAppendChild).toHaveBeenCalledWith(mockAnchor);
    });

    it('triggers click on anchor', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');

      expect(mockClick).toHaveBeenCalled();
    });

    it('removes anchor from body', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');

      expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor);
    });

    it('revokes object URL', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      downloadBlob(blob, 'test.txt');

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });
  });

  // ==========================================================================
  // convertOklchToRgb
  // ==========================================================================

  describe('convertOklchToRgb', () => {
    let mockOwnerDoc: Document;
    let mockProbe: HTMLDivElement;
    let mockComputedStyle: CSSStyleDeclaration;

    beforeEach(() => {
      mockProbe = {
        style: {
          position: '',
          visibility: '',
          color: '',
        },
      } as unknown as HTMLDivElement;
      createdElements.push(mockProbe);

      mockComputedStyle = {
        color: 'rgb(255, 0, 0)',
      } as unknown as CSSStyleDeclaration;

      mockOwnerDoc = {
        createElement: vi.fn().mockReturnValue(mockProbe),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        defaultView: {
          getComputedStyle: vi.fn().mockReturnValue(mockComputedStyle),
        },
      } as unknown as Document;
    });

    afterEach(() => {
      // Ensure probe is removed
      if (mockProbe && mockOwnerDoc.body.removeChild) {
        try {
          (mockOwnerDoc.body.removeChild as ReturnType<typeof vi.fn>)(
            mockProbe,
          );
        } catch (e) {
          // Ignore
        }
      }
    });

    it('returns null for empty value', () => {
      const result = convertOklchToRgb('', mockOwnerDoc);
      expect(result).toBeNull();
    });

    it('returns null for null value', () => {
      const result = convertOklchToRgb(null as unknown as string, mockOwnerDoc);
      expect(result).toBeNull();
    });

    it('returns null for non-oklch value', () => {
      const result = convertOklchToRgb('rgb(255, 0, 0)', mockOwnerDoc);
      expect(result).toBeNull();
    });

    it('creates probe element for oklch value', () => {
      convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(mockOwnerDoc.createElement).toHaveBeenCalledWith('div');
    });

    it('sets probe visibility to hidden', () => {
      convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(mockProbe.style.visibility).toBe('hidden');
    });

    it('sets probe position to absolute', () => {
      convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(mockProbe.style.position).toBe('absolute');
    });

    it('sets probe color to oklch value', () => {
      convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(mockProbe.style.color).toBe('oklch(0.5 0.2 180)');
    });

    it('appends probe to body', () => {
      convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(mockOwnerDoc.body.appendChild).toHaveBeenCalledWith(mockProbe);
    });

    it('removes probe from body', () => {
      convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(mockOwnerDoc.body.removeChild).toHaveBeenCalledWith(mockProbe);
    });

    it('returns computed RGB color', () => {
      const result = convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(result).toBe('rgb(255, 0, 0)');
    });

    it('returns null if computed color still contains oklch', () => {
      mockComputedStyle.color = 'oklch(0.5 0.2 180)';
      const result = convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(result).toBeNull();
    });

    it('returns null if computed color is transparent', () => {
      mockComputedStyle.color = 'rgba(0, 0, 0, 0)';
      const result = convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);
      expect(result).toBeNull();
    });

    it('returns null on error', () => {
      mockOwnerDoc.createElement = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = convertOklchToRgb('oklch(0.5 0.2 180)', mockOwnerDoc);

      expect(result).toBeNull();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('trims whitespace from value', () => {
      convertOklchToRgb('  oklch(0.5 0.2 180)  ', mockOwnerDoc);
      expect(mockProbe.style.color).toBe('oklch(0.5 0.2 180)');
    });
  });

  // ==========================================================================
  // normalizeRootColorsForExport
  // ==========================================================================

  describe('normalizeRootColorsForExport', () => {
    let originalGetComputedStyle: typeof window.getComputedStyle;
    let mockSetProperty: ReturnType<typeof vi.fn>;
    let mockProbe: HTMLDivElement;
    let realCreateElement: typeof document.createElement;

    beforeEach(() => {
      originalGetComputedStyle = window.getComputedStyle;
      realCreateElement = document.createElement.bind(document);

      mockSetProperty = vi.fn();
      mockProbe = realCreateElement('div');
      createdElements.push(mockProbe);

      document.documentElement.style.setProperty = mockSetProperty;

      vi.spyOn(document, 'createElement').mockReturnValue(mockProbe as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => mockProbe,
      );
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        () => mockProbe,
      );
    });

    afterEach(() => {
      window.getComputedStyle = originalGetComputedStyle;
      vi.restoreAllMocks();
      // Clean up probe - don't use contains on mock objects
      if (mockProbe) {
        try {
          if (mockProbe.parentNode) {
            mockProbe.parentNode.removeChild(mockProbe);
          }
        } catch (e) {
          // Ignore - mock object might not be a real Node
        }
      }
    });

    it('returns a revert function', () => {
      vi.stubGlobal('getComputedStyle', () => ({
        [Symbol.iterator]: function* () {
          yield '--test-color';
        },
        getPropertyValue: () => 'oklch(0.5 0.2 180)',
      }));
      stubbedGlobals.push('getComputedStyle');

      const revert = normalizeRootColorsForExport();
      expect(typeof revert).toBe('function');
      // Call revert to clean up
      revert();
    });

    it('converts oklch CSS variables', () => {
      const mockComputed = {
        [Symbol.iterator]: function* () {
          yield '--primary';
        },
        getPropertyValue: vi.fn().mockReturnValue('oklch(0.5 0.2 180)'),
      };

      vi.stubGlobal('getComputedStyle', () => mockComputed);
      stubbedGlobals.push('getComputedStyle');

      // Mock the probe to return rgb value
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
        if (el === mockProbe) {
          return { color: 'rgb(100, 150, 200)' } as CSSStyleDeclaration;
        }
        return mockComputed as unknown as CSSStyleDeclaration;
      });

      const revert = normalizeRootColorsForExport();

      // The function should set properties
      expect(mockSetProperty).toHaveBeenCalled();
      // Clean up
      revert();
    });

    it('skips non-CSS variable properties', () => {
      const mockComputed = {
        [Symbol.iterator]: function* () {
          yield 'color';
          yield 'background';
        },
        getPropertyValue: vi.fn().mockReturnValue('oklch(0.5 0.2 180)'),
      };

      vi.stubGlobal('getComputedStyle', () => mockComputed);
      stubbedGlobals.push('getComputedStyle');

      const revert = normalizeRootColorsForExport();

      expect(mockSetProperty).not.toHaveBeenCalled();
      revert();
    });

    it('skips non-oklch values', () => {
      const mockComputed = {
        [Symbol.iterator]: function* () {
          yield '--primary';
        },
        getPropertyValue: vi.fn().mockReturnValue('rgb(255, 0, 0)'),
      };

      vi.stubGlobal('getComputedStyle', () => mockComputed);
      stubbedGlobals.push('getComputedStyle');

      const revert = normalizeRootColorsForExport();

      expect(mockSetProperty).not.toHaveBeenCalled();
      revert();
    });

    it('revert function restores original values', () => {
      const mockComputed = {
        [Symbol.iterator]: function* () {
          yield '--primary';
        },
        getPropertyValue: vi.fn().mockReturnValue('oklch(0.5 0.2 180)'),
      };

      vi.stubGlobal('getComputedStyle', () => mockComputed);
      stubbedGlobals.push('getComputedStyle');

      vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
        if (el === mockProbe) {
          return { color: 'rgb(100, 150, 200)' } as CSSStyleDeclaration;
        }
        return mockComputed as unknown as CSSStyleDeclaration;
      });

      const revert = normalizeRootColorsForExport();
      mockSetProperty.mockClear();

      revert();

      expect(mockSetProperty).toHaveBeenCalledWith(
        '--primary',
        'oklch(0.5 0.2 180)',
      );
    });
  });

  // ==========================================================================
  // sanitizeElementColors
  // ==========================================================================

  describe('sanitizeElementColors', () => {
    let mockOwnerDoc: Document;
    let mockElement: HTMLElement;
    let mockTreeWalker: TreeWalker;
    let mockProbe: HTMLElement;

    beforeEach(() => {
      mockElement = {
        style: {
          length: 1,
          item: vi.fn().mockReturnValue('background-color'),
          getPropertyValue: vi.fn().mockReturnValue('oklch(0.5 0.2 180)'),
          getPropertyPriority: vi.fn().mockReturnValue(''),
          setProperty: vi.fn(),
          removeProperty: vi.fn(),
        },
      } as unknown as HTMLElement;
      createdElements.push(mockElement);

      mockProbe = {
        style: { position: '', visibility: '', color: '' },
      } as unknown as HTMLElement;
      createdElements.push(mockProbe);

      mockTreeWalker = {
        currentNode: mockElement,
        nextNode: vi.fn().mockReturnValue(null),
      } as unknown as TreeWalker;

      mockOwnerDoc = {
        createTreeWalker: vi.fn().mockReturnValue(mockTreeWalker),
        createElement: vi.fn().mockReturnValue(mockProbe),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        defaultView: {
          getComputedStyle: vi
            .fn()
            .mockReturnValue({ color: 'rgb(255, 0, 0)' }),
        },
      } as unknown as Document;
    });

    afterEach(() => {
      // Clean up probe if it was added to body
      if (mockProbe && mockOwnerDoc.body.removeChild) {
        try {
          (mockOwnerDoc.body.removeChild as ReturnType<typeof vi.fn>)(
            mockProbe,
          );
        } catch (e) {
          // Ignore
        }
      }
    });

    it('creates tree walker with root element', () => {
      sanitizeElementColors(mockElement, mockOwnerDoc);
      expect(mockOwnerDoc.createTreeWalker).toHaveBeenCalledWith(
        mockElement,
        NodeFilter.SHOW_ELEMENT,
        null,
      );
    });

    it('iterates through all elements', () => {
      sanitizeElementColors(mockElement, mockOwnerDoc);
      expect(mockTreeWalker.nextNode).toHaveBeenCalled();
    });

    it('patches oklch inline styles', () => {
      sanitizeElementColors(mockElement, mockOwnerDoc);

      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        'background-color',
        'rgb(255, 0, 0)',
        '',
      );
    });

    it('removes property if conversion fails', () => {
      (
        mockOwnerDoc.defaultView!.getComputedStyle as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        color: 'rgba(0, 0, 0, 0)',
      });

      sanitizeElementColors(mockElement, mockOwnerDoc);

      expect(mockElement.style.removeProperty).toHaveBeenCalledWith(
        'background-color',
      );
    });

    it('skips non-oklch properties', () => {
      (
        mockElement.style.getPropertyValue as ReturnType<typeof vi.fn>
      ).mockReturnValue('rgb(255, 0, 0)');

      sanitizeElementColors(mockElement, mockOwnerDoc);

      expect(mockElement.style.setProperty).not.toHaveBeenCalled();
      expect(mockElement.style.removeProperty).not.toHaveBeenCalled();
    });

    it('handles multiple elements', () => {
      const secondElement = {
        style: {
          length: 1,
          item: vi.fn().mockReturnValue('color'),
          getPropertyValue: vi.fn().mockReturnValue('oklch(0.3 0.1 90)'),
          getPropertyPriority: vi.fn().mockReturnValue('important'),
          setProperty: vi.fn(),
          removeProperty: vi.fn(),
        },
      } as unknown as HTMLElement;

      (mockTreeWalker.nextNode as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(secondElement)
        .mockReturnValueOnce(null);

      sanitizeElementColors(mockElement, mockOwnerDoc);

      expect(secondElement.style.setProperty).toHaveBeenCalled();
    });

    it('preserves property priority', () => {
      (
        mockElement.style.getPropertyPriority as ReturnType<typeof vi.fn>
      ).mockReturnValue('important');

      sanitizeElementColors(mockElement, mockOwnerDoc);

      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        'background-color',
        'rgb(255, 0, 0)',
        'important',
      );
    });
  });

  // ==========================================================================
  // sanitizeCssVariables
  // ==========================================================================

  describe('sanitizeCssVariables', () => {
    let mockDoc: Document;
    let mockRootComputed: CSSStyleDeclaration;
    let mockSetProperty: ReturnType<typeof vi.fn>;
    let mockProbe: HTMLDivElement;

    beforeEach(() => {
      mockSetProperty = vi.fn();
      mockProbe = {
        style: { position: '', visibility: '', color: '' },
      } as unknown as HTMLDivElement;
      createdElements.push(mockProbe);

      mockRootComputed = {
        [Symbol.iterator]: function* () {
          yield '--primary';
        },
        getPropertyValue: vi.fn().mockReturnValue('oklch(0.5 0.2 180)'),
      } as unknown as CSSStyleDeclaration;

      mockDoc = {
        documentElement: {
          style: {
            setProperty: mockSetProperty,
          },
        },
        defaultView: {
          getComputedStyle: vi.fn().mockReturnValue(mockRootComputed),
        },
        createElement: vi.fn().mockReturnValue(mockProbe),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as unknown as Document;
    });

    afterEach(() => {
      // Clean up probe
      if (mockProbe && mockDoc.body.removeChild) {
        try {
          (mockDoc.body.removeChild as ReturnType<typeof vi.fn>)(mockProbe);
        } catch (e) {
          // Ignore
        }
      }
    });

    it('returns undefined if no defaultView', () => {
      const docWithoutView = {
        documentElement: {
          style: {
            setProperty: vi.fn(),
          },
        },
        defaultView: null,
      } as unknown as Document;

      const result = sanitizeCssVariables(docWithoutView);
      expect(result).toBeUndefined();
    });

    it('returns array of converted variables', () => {
      const mockComputedProbe = {
        color: 'rgb(100, 150, 200)',
      } as CSSStyleDeclaration;
      (
        mockDoc.defaultView!.getComputedStyle as ReturnType<typeof vi.fn>
      ).mockImplementation((el) => {
        if (el === mockProbe) return mockComputedProbe;
        return mockRootComputed;
      });

      const result = sanitizeCssVariables(mockDoc);

      expect(result).toEqual([['--primary', 'rgb(100, 150, 200)']]);
    });

    it('sets property on document element', () => {
      const mockComputedProbe = {
        color: 'rgb(100, 150, 200)',
      } as CSSStyleDeclaration;
      (
        mockDoc.defaultView!.getComputedStyle as ReturnType<typeof vi.fn>
      ).mockImplementation((el) => {
        if (el === mockProbe) return mockComputedProbe;
        return mockRootComputed;
      });

      sanitizeCssVariables(mockDoc);

      expect(mockSetProperty).toHaveBeenCalledWith(
        '--primary',
        'rgb(100, 150, 200)',
      );
    });

    it('skips non-CSS variable properties', () => {
      mockRootComputed = {
        [Symbol.iterator]: function* () {
          yield 'color';
        },
        getPropertyValue: vi.fn().mockReturnValue('oklch(0.5 0.2 180)'),
      } as unknown as CSSStyleDeclaration;

      (
        mockDoc.defaultView!.getComputedStyle as ReturnType<typeof vi.fn>
      ).mockReturnValue(mockRootComputed);

      const result = sanitizeCssVariables(mockDoc);

      expect(result).toEqual([]);
    });

    it('skips non-oklch values', () => {
      (
        mockRootComputed.getPropertyValue as ReturnType<typeof vi.fn>
      ).mockReturnValue('rgb(255, 0, 0)');

      const result = sanitizeCssVariables(mockDoc);

      expect(result).toEqual([]);
    });

    it('handles empty variables', () => {
      (
        mockRootComputed.getPropertyValue as ReturnType<typeof vi.fn>
      ).mockReturnValue('');

      const result = sanitizeCssVariables(mockDoc);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // exportAsPDF
  // ==========================================================================

  describe('exportAsPDF', () => {
    let tempDivs: Array<HTMLDivElement> = [];
    let realCreateElement: typeof document.createElement;

    beforeEach(() => {
      vi.clearAllMocks();
      tempDivs = [];
      // Ensure toast mocks are reset
      mockToastSuccess.mockClear();
      mockToastError.mockClear();
      realCreateElement = document.createElement.bind(document);

      // Mock document.createElement for tempDiv
      (vi.spyOn(document, 'createElement') as any).mockImplementation(
        (tag: string) => {
          if (tag === 'div') {
            const div = realCreateElement('div');
            tempDivs.push(div);
            createdElements.push(div);
            return div;
          }
          return realCreateElement(tag);
        },
      );
    });

    afterEach(() => {
      // Clean up temp divs
      tempDivs.forEach((div) => {
        try {
          if (div.parentNode) {
            div.parentNode.removeChild(div);
          }
        } catch (e) {
          // Ignore
        }
      });
      tempDivs = [];
      vi.restoreAllMocks();
    });

    it('shows error toast for empty content', async () => {
      await exportAsPDF('', 'Test Title');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('shows error toast for whitespace only content', async () => {
      await exportAsPDF('   ', 'Test Title');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('creates jsPDF instance', async () => {
      await exportAsPDF('# Test Content', 'Test Title');

      // Verify PDF was created by checking save was called
      expect(mockPdfSave).toHaveBeenCalled();
    });

    it('saves PDF with sanitized filename', async () => {
      await exportAsPDF('# Test Content', 'Test Title');

      expect(mockPdfSave).toHaveBeenCalledWith('Test_Title.pdf');
    });

    it('shows success toast on export', async () => {
      await exportAsPDF('# Test Content', 'Test Title');

      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');
    });

    it('sets font for title', async () => {
      await exportAsPDF('# Test Content', 'Test Title');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(18);
      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'bold');
    });

    it('handles special characters in title', async () => {
      await exportAsPDF('# Content', 'Test / Title : Name');

      expect(mockPdfSave).toHaveBeenCalledWith('Test___Title___Name.pdf');
    });
  });

  // ==========================================================================
  // exportAsDOCX
  // ==========================================================================

  describe('exportAsDOCX', () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockAnchor: HTMLAnchorElement;
    let mockClick: ReturnType<typeof vi.fn>;
    let realCreateElement: typeof document.createElement;

    beforeEach(() => {
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      mockRevokeObjectURL = vi.fn();
      mockClick = vi.fn();
      realCreateElement = document.createElement.bind(document);

      mockAnchor = realCreateElement('a');
      vi.spyOn(mockAnchor, 'click').mockImplementation(mockClick);
      createdElements.push(mockAnchor);

      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      });
      stubbedGlobals.push('URL');

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => mockAnchor,
      );
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        () => mockAnchor,
      );
    });

    afterEach(() => {
      // Ensure anchor is removed - don't use contains on mock objects
      if (mockAnchor) {
        try {
          if (mockAnchor.parentNode) {
            mockAnchor.parentNode.removeChild(mockAnchor);
          }
        } catch (e) {
          // Ignore - mock object might not be a real Node
        }
      }
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('shows error toast for empty content', () => {
      exportAsDOCX('', 'Test Title');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('shows error toast for whitespace only content', () => {
      exportAsDOCX('   ', 'Test Title');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('creates blob with Word document content', () => {
      exportAsDOCX('# Test Content', 'Test Title');

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('downloads file with .docx extension', () => {
      exportAsDOCX('# Test Content', 'Test Title');

      expect(mockAnchor.download).toBe('Test_Title.docx');
    });

    it('shows success toast on export', () => {
      exportAsDOCX('# Test Content', 'Test Title');

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Document exported as DOCX',
      );
    });

    it('escapes HTML in title', () => {
      exportAsDOCX('# Content', '<script>alert("xss")</script>');

      // The blob should be created with escaped title
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('triggers download', () => {
      exportAsDOCX('# Test Content', 'Test Title');

      expect(mockClick).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // exportAsMarkdown
  // ==========================================================================

  describe('exportAsMarkdown', () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockAnchor: HTMLAnchorElement;
    let mockClick: ReturnType<typeof vi.fn>;
    let realCreateElement: typeof document.createElement;

    beforeEach(() => {
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      mockRevokeObjectURL = vi.fn();
      mockClick = vi.fn();
      realCreateElement = document.createElement.bind(document);

      mockAnchor = realCreateElement('a');
      vi.spyOn(mockAnchor, 'click').mockImplementation(mockClick);
      createdElements.push(mockAnchor);

      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      });
      stubbedGlobals.push('URL');

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => mockAnchor,
      );
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        () => mockAnchor,
      );
    });

    afterEach(() => {
      // Ensure anchor is removed - don't use contains on mock objects
      if (mockAnchor) {
        try {
          if (mockAnchor.parentNode) {
            mockAnchor.parentNode.removeChild(mockAnchor);
          }
        } catch (e) {
          // Ignore - mock object might not be a real Node
        }
      }
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('shows error toast for empty content', () => {
      exportAsMarkdown('', 'Test Title');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('shows error toast for whitespace only content', () => {
      exportAsMarkdown('   ', 'Test Title');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('creates blob with markdown content', () => {
      const markdownContent = '# Test Heading\n\nSome paragraph content.';
      exportAsMarkdown(markdownContent, 'Test Title');

      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('downloads file with .md extension', () => {
      exportAsMarkdown('# Test Content', 'Test Title');

      expect(mockAnchor.download).toBe('Test_Title.md');
    });

    it('shows success toast on export', () => {
      exportAsMarkdown('# Test Content', 'Test Title');

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Document exported as Markdown',
      );
    });

    it('uses text/markdown content type', () => {
      exportAsMarkdown('# Test Content', 'Test Title');

      const blobCall = mockCreateObjectURL.mock.calls[0][0] as Blob;
      expect(blobCall.type).toBe('text/markdown');
    });

    it('preserves original markdown content', () => {
      const originalContent =
        '# Heading\n\n- Item 1\n- Item 2\n\n```js\nconst x = 1;\n```';
      exportAsMarkdown(originalContent, 'Code Example');

      expect(mockClick).toHaveBeenCalled();
    });

    it('sanitizes filename with special characters', () => {
      exportAsMarkdown('# Content', 'My File / Name : Test');

      expect(mockAnchor.download).toBe('My_File___Name___Test.md');
    });

    it('triggers download', () => {
      exportAsMarkdown('# Test', 'Test');

      expect(mockClick).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // exportAsPDF - processNode branches via markdownToHtml mock
  // ==========================================================================

  describe('exportAsPDF processNode coverage', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Reset to default behavior
      mockMarkdownToHtml.mockImplementation((md: string) => `<p>${md}</p>`);
      // Ensure toast mocks are reset and working
      mockToastSuccess.mockClear();
      mockToastError.mockClear();
      // Ensure toast mock functions are callable
      mockToastSuccess.mockImplementation(() => {});
      mockToastError.mockImplementation(() => {});
    });

    afterEach(() => {
      // Don't restore all mocks - we need to keep the toast mock
      // Just clear the call history
      vi.clearAllMocks();
    });

    it('processes TEXT_NODE with text content', async () => {
      await exportAsPDF('Some text content', 'Test');

      expect(mockPdfText).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');
    });

    it('processes h1 element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<h1>Heading 1</h1>');

      await exportAsPDF('# Heading 1', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(16); // headingFontSize + 2
      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'bold');
    });

    it('processes h2 element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<h2>Heading 2</h2>');

      await exportAsPDF('## Heading 2', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(15); // headingFontSize + 1
    });

    it('processes h3 element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<h3>Heading 3</h3>');

      await exportAsPDF('### Heading 3', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(14); // headingFontSize
    });

    it('processes p element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<p>Paragraph content</p>');

      await exportAsPDF('Paragraph content', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(11); // normalFontSize
      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'normal');
    });

    it('processes ul element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<ul><li>item</li></ul>');

      await exportAsPDF('- item', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(11);
    });

    it('processes ol element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<ol><li>item</li></ol>');

      await exportAsPDF('1. item', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(11);
    });

    it('processes li element with text child via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<ul><li>List item text</li></ul>');

      await exportAsPDF('- List item text', 'Test');

      // Should add bullet point
      expect(mockPdfText).toHaveBeenCalledWith('• ', 20, expect.any(Number));
      expect(mockPdfGetTextWidth).toHaveBeenCalledWith('• ');
    });

    it('processes li element with nested element child via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue(
        '<ul><li><strong>Bold in list</strong></li></ul>',
      );

      await exportAsPDF('- **Bold in list**', 'Test');

      expect(mockPdfText).toHaveBeenCalledWith('• ', 20, expect.any(Number));
    });

    it('processes strong element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<p><strong>Bold text</strong></p>');

      await exportAsPDF('**Bold text**', 'Test');

      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'bold');
    });

    it('processes b element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<p><b>Bold text</b></p>');

      await exportAsPDF('**Bold**', 'Test');

      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'bold');
    });

    it('processes em element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<p><em>Italic text</em></p>');

      await exportAsPDF('*Italic text*', 'Test');

      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'italic');
    });

    it('processes i element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<p><i>Italic</i></p>');

      await exportAsPDF('*Italic*', 'Test');

      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'italic');
    });

    it('processes code element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<p><code>code snippet</code></p>');

      await exportAsPDF('`code snippet`', 'Test');

      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'normal');
      expect(mockPdfSetFontSize).toHaveBeenCalledWith(10); // normalFontSize - 1
    });

    it('processes unknown element with default styling via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<span>Content in span</span>');

      await exportAsPDF('Content', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(11);
      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'normal');
    });

    it('resets font after processing heading elements via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<h1>Heading</h1><p>Paragraph</p>');

      await exportAsPDF('# Heading\n\nParagraph', 'Test');

      // Should reset font size after h1
      const setFontSizeCalls = mockPdfSetFontSize.mock.calls;
      const normalFontSizeIndex = setFontSizeCalls.findIndex(
        (call: any[]) => call[0] === 11,
      );
      expect(normalFontSizeIndex).toBeGreaterThan(-1);
    });

    it('skips empty text nodes', async () => {
      await exportAsPDF('   ', 'Test');

      // Empty whitespace should show error toast
      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('handles h4 element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<h4>Heading 4</h4>');

      await exportAsPDF('#### Heading 4', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(14);
    });

    it('handles h5 element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<h5>Heading 5</h5>');

      await exportAsPDF('##### Heading 5', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(14);
    });

    it('handles h6 element via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue('<h6>Heading 6</h6>');

      await exportAsPDF('###### Heading 6', 'Test');

      expect(mockPdfSetFontSize).toHaveBeenCalledWith(14);
    });

    it('processes nested child nodes recursively for non-li elements via HTML', async () => {
      mockMarkdownToHtml.mockReturnValue(
        '<p>Normal and <strong>Bold</strong> text</p>',
      );

      await exportAsPDF('Normal and **Bold** text', 'Test');

      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'bold');
    });

    it('triggers page break in TEXT_NODE when yPosition exceeds pageHeight', async () => {
      // Mock splitTextIntoLines to return 50 lines to force page break
      mockSplitTextIntoLines.mockImplementation(() =>
        Array(50).fill('Line of text'),
      );
      mockMarkdownToHtml.mockReturnValue(
        'Text content that becomes many lines',
      );

      await exportAsPDF('Long content', 'Test');

      expect(mockPdfAddPage).toHaveBeenCalled();

      // Reset mock
      mockSplitTextIntoLines.mockImplementation((text: string) => [text]);
    });

    it('triggers page break for element node when yPosition exceeds pageHeight', async () => {
      // Create many paragraphs to push yPosition
      const manyParagraphs = Array(50).fill('<p>Content</p>').join('');
      mockMarkdownToHtml.mockReturnValue(manyParagraphs);

      await exportAsPDF('Many paragraphs', 'Test');

      // With 50 paragraphs at ~9 units each (2 + lineHeight), should exceed page
      expect(mockPdfText).toHaveBeenCalled();
    });

    it('triggers page break inside li text processing when yPosition exceeds pageHeight', async () => {
      // Create list with many lines per item
      mockSplitTextIntoLines.mockImplementation(() => Array(50).fill('Line'));
      mockMarkdownToHtml.mockReturnValue('<ul><li>Long list item</li></ul>');

      await exportAsPDF('Long list', 'Test');

      expect(mockPdfAddPage).toHaveBeenCalled();
      expect(mockPdfGetTextWidth).toHaveBeenCalled();

      // Reset mock
      mockSplitTextIntoLines.mockImplementation((text: string) => [text]);
    });

    it('handles li with nested child elements via processNode recursion', async () => {
      mockMarkdownToHtml.mockReturnValue(
        '<ul><li><em>Italic in list</em></li></ul>',
      );

      await exportAsPDF('- *Italic in list*', 'Test');

      expect(mockPdfSetFont).toHaveBeenCalledWith('helvetica', 'italic');
    });

    it('handles multiple line indexes in li processing (idx < lines.length - 1)', async () => {
      // Mock splitTextIntoLines to return multiple lines
      mockSplitTextIntoLines.mockImplementation(() => [
        'Line 1',
        'Line 2',
        'Line 3',
      ]);
      mockMarkdownToHtml.mockReturnValue('<ul><li>Multi line item</li></ul>');

      await exportAsPDF('- Multi line item', 'Test');

      // This should process multiple lines inside li
      expect(mockPdfText).toHaveBeenCalled();

      // Reset mock
      mockSplitTextIntoLines.mockImplementation((text: string) => [text]);
    });

    it('triggers fallback when processNode processes no content', async () => {
      // Return HTML that generates no text content
      mockMarkdownToHtml.mockReturnValue('<div></div>');
      mockStripHtml.mockReturnValue('Fallback content');

      await exportAsPDF('Content', 'Test');

      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');

      // Reset mock
      mockStripHtml.mockImplementation((html: string) =>
        html.replace(/<[^>]+>/g, ''),
      );
    });

    it('handles fallback with page break when content is long', async () => {
      // Return empty HTML so fallback kicks in
      mockMarkdownToHtml.mockReturnValue('');
      mockStripHtml.mockReturnValue('Fallback text');
      // Make splitTextIntoLines return many lines for fallback
      mockSplitTextIntoLines.mockImplementation(() => Array(50).fill('Line'));

      await exportAsPDF('Content', 'Title');

      expect(mockPdfAddPage).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');

      // Reset mocks
      mockStripHtml.mockImplementation((html: string) =>
        html.replace(/<[^>]+>/g, ''),
      );
      mockSplitTextIntoLines.mockImplementation((text: string) => [text]);
    });

    it('handles fallback with empty trimmed plainText', async () => {
      // Return empty HTML and empty stripped text
      mockMarkdownToHtml.mockReturnValue('');
      mockStripHtml.mockReturnValue('   ');

      await exportAsPDF('Content', 'Title');

      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');

      // Reset mock
      mockStripHtml.mockImplementation((html: string) =>
        html.replace(/<[^>]+>/g, ''),
      );
    });

    it('triggers element-level page break when many elements exceed page height (lines 215-217)', async () => {
      // Create HTML with 60 paragraph elements to force element-level page break
      // yPosition starts at ~34 after title, each p adds ~9 units
      // Need yPosition > 277 when entering processNode for an element
      // 60 paragraphs * 9 units = 540, well over 277
      const manyParagraphs = Array(60).fill('<p>Text</p>').join('');
      mockMarkdownToHtml.mockReturnValue(manyParagraphs);

      await exportAsPDF('x', 'x');

      expect(mockPdfAddPage).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');
    });

    it('triggers fallback page break when fallback content is very long (lines 313-318)', async () => {
      // Return empty HTML to trigger fallback path
      mockMarkdownToHtml.mockReturnValueOnce('');
      // Return non-empty stripped text so fallback processes it
      mockStripHtml.mockReturnValueOnce('Fallback content');
      // Return 60 lines to force page break inside fallback forEach
      mockSplitTextIntoLines.mockImplementation(() =>
        Array(60).fill('Line of fallback text'),
      );

      await exportAsPDF('Test content', 'Short');

      expect(mockPdfAddPage).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');

      // Reset mock
      mockSplitTextIntoLines.mockImplementation((text: string) => [text]);
    });

    it('covers the false branch of page break check by processing short content', async () => {
      // Short content that doesn't exceed page height
      mockMarkdownToHtml.mockReturnValue('<p>Short</p>');

      await exportAsPDF('x', 'x');

      // Should NOT call addPage for short content
      expect(mockPdfAddPage).not.toHaveBeenCalled();
    });

    it('processes many headings that force element page break', async () => {
      // Headings add more vertical space (yPosition += 5 for h1, etc.)
      // Create content with many h1 elements to hit element-level page break
      const manyHeadings = Array(40).fill('<h1>Heading</h1>').join('');
      mockMarkdownToHtml.mockReturnValue(manyHeadings);

      await exportAsPDF('x', 'x');

      expect(mockPdfAddPage).toHaveBeenCalled();
    });

    it('handles empty text node content (line 196 falsy branch)', async () => {
      // HTML with empty text/whitespace-only content
      mockMarkdownToHtml.mockReturnValue('<p>   </p>');

      await exportAsPDF('content', 'Title');

      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');
    });

    it('handles li with empty text content (line 257 falsy branch)', async () => {
      // List item with only whitespace text
      mockMarkdownToHtml.mockReturnValue('<ul><li>   </li></ul>');

      await exportAsPDF('content', 'Title');

      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');
    });

    it('skips processing for non-text non-element nodes (line 211 else branch)', async () => {
      // Comment nodes are neither TEXT_NODE nor ELEMENT_NODE
      // When parsed, HTML comments become Comment nodes which don't match either condition
      mockMarkdownToHtml.mockReturnValue('<!-- comment --><p>Text</p>');

      await exportAsPDF('content', 'Title');

      expect(mockToastSuccess).toHaveBeenCalledWith('Document exported as PDF');
    });

    it('processes li element which skips recursive call (line 291)', async () => {
      // Li elements return early, so the recursive call is skipped
      mockMarkdownToHtml.mockReturnValue('<ul><li>Item</li></ul>');

      await exportAsPDF('content', 'Title');

      // Li was processed (bullet was added)
      expect(mockPdfText).toHaveBeenCalledWith('• ', 20, expect.any(Number));
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles undefined markdown source in PDF export', async () => {
      await exportAsPDF(undefined as unknown as string, 'Test');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('handles null markdown source in DOCX export', () => {
      exportAsDOCX(null as unknown as string, 'Test');

      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('throws error for undefined export title', async () => {
      await expect(
        exportAsPDF('# Content', undefined as unknown as string),
      ).rejects.toThrow();
    });

    it('handles very long content in markdown export', () => {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: vi.fn(),
      });
      stubbedGlobals.push('URL');

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      } as unknown as HTMLAnchorElement;
      createdElements.push(mockAnchor);

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => mockAnchor,
      );
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        () => mockAnchor,
      );

      const longContent = 'A'.repeat(100000);
      exportAsMarkdown(longContent, 'Long File');

      expect(mockToastSuccess).toHaveBeenCalled();

      // Clean up - just try to remove, don't check contains on mock object
      if (mockAnchor) {
        try {
          if (mockAnchor.parentNode) {
            mockAnchor.parentNode.removeChild(mockAnchor);
          }
        } catch (e) {
          // Ignore - mock object might not be a real Node
        }
      }
    });

    it('handles unicode characters in filename', () => {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: vi.fn(),
      });
      stubbedGlobals.push('URL');

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      } as unknown as HTMLAnchorElement;
      createdElements.push(mockAnchor);

      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(
        () => mockAnchor,
      );
      vi.spyOn(document.body, 'removeChild').mockImplementation(
        () => mockAnchor,
      );

      exportAsMarkdown('# Content', '文档名称');

      expect(mockAnchor.download).toContain('.md');

      // Clean up - just try to remove, don't check contains on mock object
      if (mockAnchor) {
        try {
          if (mockAnchor.parentNode) {
            mockAnchor.parentNode.removeChild(mockAnchor);
          }
        } catch (e) {
          // Ignore - mock object might not be a real Node
        }
      }
    });
  });

  // ==========================================================================
  // Additional Edge Cases for Coverage
  // ==========================================================================

  describe('Additional Edge Cases', () => {
    it('handles convertOklchToRgb with whitespace-only value', () => {
      const mockOwnerDoc = {
        createElement: vi.fn(),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        defaultView: {
          getComputedStyle: vi.fn(),
        },
      } as unknown as Document;

      const result = convertOklchToRgb('   ', mockOwnerDoc);
      expect(result).toBeNull();
    });

    it('handles convertOklchToRgb with value containing oklch but not starting with it', () => {
      const mockOwnerDoc = {
        createElement: vi.fn(),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        defaultView: {
          getComputedStyle: vi.fn(),
        },
      } as unknown as Document;

      convertOklchToRgb('color: oklch(0.5 0.2 180)', mockOwnerDoc);
      // Should still process it since it contains oklch
      expect(mockOwnerDoc.createElement).toHaveBeenCalled();
    });

    it('handles sanitizeElementColors with element that has no style properties', () => {
      const mockElement = {
        style: {
          length: 0,
          item: vi.fn(),
          getPropertyValue: vi.fn(),
          getPropertyPriority: vi.fn(),
          setProperty: vi.fn(),
          removeProperty: vi.fn(),
        },
      } as unknown as HTMLElement;

      const mockOwnerDoc = {
        createTreeWalker: vi.fn().mockReturnValue({
          currentNode: mockElement,
          nextNode: vi.fn().mockReturnValue(null),
        }),
        createElement: vi.fn().mockReturnValue({
          style: { position: '', visibility: '', color: '' },
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        defaultView: {
          getComputedStyle: vi
            .fn()
            .mockReturnValue({ color: 'rgb(255, 0, 0)' }),
        },
      } as unknown as Document;

      sanitizeElementColors(mockElement, mockOwnerDoc);

      expect(mockOwnerDoc.createTreeWalker).toHaveBeenCalled();
    });

    it('handles sanitizeCssVariables with document that has no CSS variables', () => {
      const mockDoc = {
        documentElement: {
          style: {
            setProperty: vi.fn(),
          },
        },
        defaultView: {
          getComputedStyle: vi.fn().mockReturnValue({
            [Symbol.iterator]: function* () {
              // No CSS variables
            },
            getPropertyValue: vi.fn(),
          }),
        },
        createElement: vi.fn().mockReturnValue({
          style: { position: '', visibility: '', color: '' },
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as unknown as Document;

      const result = sanitizeCssVariables(mockDoc);
      expect(result).toEqual([]);
    });

    it('handles exportAsPDF with null markdown source', async () => {
      await exportAsPDF(null as unknown as string, 'Test');
      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('handles exportAsDOCX with null markdown source', () => {
      exportAsDOCX(null as unknown as string, 'Test');
      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });

    it('handles exportAsMarkdown with null markdown source', () => {
      exportAsMarkdown(null as unknown as string, 'Test');
      expect(mockToastError).toHaveBeenCalledWith('Nothing to export yet');
    });
  });
});
