import type { StepTarget } from 'react-joyride';

/**
 * `data-tour` hooks on the host-owned tour targets. SDK components that
 * render no data-* passthrough (the profile dropdown, the privacy toggle) are
 * wrapped in a host element that carries the hook.
 */
export const TOUR_TARGET = {
  profile: 'profile',
  privacyMode: 'privacy-mode',
  promptInput: 'prompt-input',
  conversationStarters: 'conversation-starters',
  agents: 'agents',
  account: 'account',
} as const;

export type TourTargetId = (typeof TOUR_TARGET)[keyof typeof TOUR_TARGET];

export const tourSelector = (id: TourTargetId): string => `[data-tour="${id}"]`;

/** Whether a modal dialog (Radix `Dialog` / `AlertDialog`) is open. */
export function isBlockingDialogOpen(root: ParentNode = document): boolean {
  return !!root.querySelector(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
  );
}

/** Resolve a joyride step target (selector, element, ref, or getter) to an element. */
export function resolveTourTarget(target: StepTarget): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector<HTMLElement>(target);
  }
  if (typeof target === 'function') {
    return target();
  }
  if (target instanceof HTMLElement) {
    return target;
  }
  return target.current;
}

/**
 * Whether a step target is mounted and has a visible box. A wrapper whose
 * SDK child rendered nothing still lays out at 0×0, so a box without area
 * counts as missing — otherwise the spotlight would point at nothing.
 */
export function isTourTargetVisible(target: StepTarget): boolean {
  const element = resolveTourTarget(target);
  if (!element) return false;
  return Array.from(element.getClientRects()).some(
    (rect) => rect.width > 0 && rect.height > 0,
  );
}
