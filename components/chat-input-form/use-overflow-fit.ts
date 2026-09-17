'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** `gap-1.5` between pills in the composer's tool row. */
export const OVERFLOW_ITEM_GAP = 6;
/** The `•••` overflow trigger is an `h-8 w-8` icon button. */
export const OVERFLOW_TRIGGER_WIDTH = 32;

/**
 * Width to assume for a pill that has never been rendered inline (so it
 * could not be measured yet): icon + horizontal padding + icon/label gap +
 * roughly 7px per label character, plus the ✕ affordance when active. Only
 * a first guess — once the pill is inline its real width replaces it.
 */
export function estimatePillWidth(label: string, active = false): number {
  return 16 + 16 + 6 + label.length * 7 + (active ? 16 : 0);
}

/**
 * How many leading items fit in `available` px. Items keep their order: the
 * first one that does not fit — and everything after it — goes to the
 * overflow menu, whose trigger needs room of its own whenever anything is
 * hidden. Returns 0..widths.length.
 */
export function fitInlineCount(
  available: number,
  widths: number[],
  { gap = OVERFLOW_ITEM_GAP, triggerWidth = OVERFLOW_TRIGGER_WIDTH } = {},
): number {
  const n = widths.length;
  for (let k = n; k >= 0; k--) {
    let itemsWidth = 0;
    for (let i = 0; i < k; i++) itemsWidth += widths[i];
    const hiddenAny = k < n;
    const slots = k + (hiddenAny ? 1 : 0);
    const total =
      itemsWidth +
      (hiddenAny ? triggerWidth : 0) +
      Math.max(0, slots - 1) * gap;
    if (total <= available) return k;
  }
  return 0;
}

export interface OverflowFitItem {
  key: string;
  /** Width to assume until the item has been measured inline. */
  estimate: number;
}

export interface OverflowFit {
  /** Attach to the row that owns the available space (`flex-1 min-w-0`). */
  rootRef: (node: HTMLElement | null) => void;
  /** Attach to every inline element that takes space in that row. */
  itemRef: (key: string) => (node: HTMLElement | null) => void;
  /**
   * Number of leading `items` that fit, or `null` while the row has not
   * been measured (before the first layout, or when it is not displayed).
   */
  visibleCount: number | null;
}

/**
 * Priority overflow for a row of pills: given the row's measured width and
 * every inline pill's measured width, decide how many of `items` (in order)
 * stay inline. `fixedKeys` are always-inline elements (registered through
 * `itemRef` too) whose width is subtracted first.
 *
 * Widths come from the DOM after each render, so a pill that changes shape
 * (a label appears, an active ✕ shows up) is re-fitted on the next frame.
 * Widths of items currently hidden are remembered from the last time they
 * were inline, which keeps the fit stable — an item is only pulled back
 * inline when it is known (or, before its first measurement, estimated) to
 * fit.
 */
export function useOverflowFit(
  items: OverflowFitItem[],
  fixedKeys: string[] = [],
): OverflowFit {
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const elsRef = useRef(new Map<string, HTMLElement>());
  const widthsRef = useRef(new Map<string, number>());
  // Bumped whenever a measured width changes so the fit is recomputed.
  const [, setTick] = useState(0);

  const rootRef = useCallback((node: HTMLElement | null) => {
    setRootEl(node);
  }, []);

  useEffect(() => {
    if (!rootEl) return;
    const read = () => {
      const width = Math.floor(rootEl.getBoundingClientRect().width);
      setAvailable((prev) => (prev === width ? prev : width));
    };
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const observer = new ResizeObserver(read);
    observer.observe(rootEl);
    return () => observer.disconnect();
  }, [rootEl]);

  const itemRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) elsRef.current.set(key, node);
      else elsRef.current.delete(key);
    },
    [],
  );

  // Measure every inline element after each render; re-render only when a
  // width actually changed so this cannot loop.
  useLayoutEffect(() => {
    let changed = false;
    for (const [key, el] of elsRef.current) {
      const width = Math.ceil(el.getBoundingClientRect().width);
      if (widthsRef.current.get(key) !== width) {
        widthsRef.current.set(key, width);
        changed = true;
      }
    }
    if (changed) setTick((t) => t + 1);
  });

  if (available === null || available <= 0) {
    return { rootRef, itemRef, visibleCount: null };
  }

  let fixedWidth = 0;
  let fixedCount = 0;
  for (const key of fixedKeys) {
    // Only elements that are actually mounted take space.
    if (!elsRef.current.has(key)) continue;
    fixedWidth += widthsRef.current.get(key) ?? 0;
    fixedCount += 1;
  }
  const usable = available - fixedWidth - fixedCount * OVERFLOW_ITEM_GAP;
  const widths = items.map(
    (item) => widthsRef.current.get(item.key) ?? item.estimate,
  );

  return { rootRef, itemRef, visibleCount: fitInlineCount(usable, widths) };
}
