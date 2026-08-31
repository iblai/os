import '@testing-library/jest-dom';
import { expect, vi } from 'vitest';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';

expect.extend(matchers);

// next-intl requires a NextIntlClientProvider at runtime; the test environment
// renders components in isolation without one, so `useTranslations` would throw.
// Provide a real English translator (full ICU support via the actual
// createTranslator over messages/en.json) so migrated components render their
// English strings — matching the assertions in pre-existing component tests.
vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  const enMessages = (await import('../messages/en.json')).default;
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: 'en',
        messages: enMessages as Record<string, unknown>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        namespace: namespace as any,
      }),
    useLocale: () => 'en',
    useMessages: () => enMessages,
    // Passthrough provider — components are rendered directly in tests.
    NextIntlClientProvider: ({ children }: { children: unknown }) => children,
  };
});

// Mock URL.createObjectURL and URL.revokeObjectURL for tests that use blob URLs
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = vi.fn();
}

// Mock localStorage for tests that need it
// Use a class to allow proper prototype access for spying
class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
});

// Per-tab authStorage passthrough for `vi.mock('@iblai/iblai-js/web-utils')`
// factories. mentorai now imports getAuthItem/setAuthItem/removeAuthItem/
// clearPerTabSession/isPerTabAuthEnabled from the SDK; the many hand-listed
// web-utils mocks would otherwise throw "No <fn> export is defined on the mock"
// wherever that code runs. This object reproduces the flag-OFF behavior
// (plain localStorage passthrough). Factories spread it first, so any explicit
// per-test override still wins. Exposed as a runtime global because a hoisted
// vi.mock factory cannot reference a module-level import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__iblAuthStorageMock = {
  getAuthItem: (key: string) => window.localStorage.getItem(key),
  setAuthItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
  removeAuthItem: (key: string) => window.localStorage.removeItem(key),
  clearPerTabSession: () => {},
  isPerTabAuthEnabled: () => false,
};

// Mock pointer capture methods required by Radix UI in jsdom
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture === 'undefined') {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture === 'undefined') {
  Element.prototype.releasePointerCapture = () => {};
}

// Mock scrollIntoView
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}

// Mock ResizeObserver
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Mock DOM methods required by ProseMirror/TipTap
if (typeof document !== 'undefined') {
  // Mock document.elementFromPoint
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }

  // Mock getClientRects for all elements
  Element.prototype.getClientRects = function () {
    const rect = {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
    };
    return {
      length: 1,
      item: () => rect,
      [0]: rect,
      [Symbol.iterator]: function* () {
        yield rect;
      },
    } as unknown as DOMRectList;
  };

  Element.prototype.getBoundingClientRect = function () {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  };

  // Mock Range.prototype.getClientRects
  Range.prototype.getClientRects = function () {
    const rect = {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
    };
    return {
      length: 1,
      item: () => rect,
      [0]: rect,
      [Symbol.iterator]: function* () {
        yield rect;
      },
    } as unknown as DOMRectList;
  };

  Range.prototype.getBoundingClientRect = function () {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  };
}
