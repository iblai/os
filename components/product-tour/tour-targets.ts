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

/**
 * The SDK chat composer carries no `data-tour` hook: anchor on the card that
 * wraps its textarea together with its action buttons (the layout differs
 * between the classic and redesigned composer, so no fixed depth is assumed).
 */
export function resolvePromptInputTarget(
  root: ParentNode = document,
): HTMLElement | null {
  const hooked = root.querySelector<HTMLElement>(
    tourSelector(TOUR_TARGET.promptInput),
  );
  if (hooked) return hooked;
  let node: HTMLElement | null =
    root.querySelector<HTMLTextAreaElement>('textarea')?.parentElement ?? null;
  while (node && !node.querySelector('button')) node = node.parentElement;
  return node;
}

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

/** Frames the targets must hold still before the move watch goes idle again. */
export const TARGET_SETTLE_FRAMES = 10;

const boxKey = (target: StepTarget): string => {
  const box = resolveTourTarget(target)?.getBoundingClientRect();
  return box ? `${box.top},${box.left},${box.width},${box.height}` : '';
};

/**
 * Calls `onMove` when content mounting around a target moves it, e.g. the
 * conversation starters loading under the chat input push it up. Joyride
 * re-measures its spotlight only on scroll, window resize or a size change of
 * the target itself, so a target that is merely pushed aside leaves the cutout
 * behind while the tooltip follows it. After a DOM change the boxes are
 * checked every frame until they settle, so a move that animates in is
 * followed to its end.
 */
export function watchTourTargetMoves(
  targets: StepTarget[],
  onMove: () => void,
): () => void {
  const snapshot = () => targets.map(boxKey).join('|');
  let last = snapshot();
  let frame = 0;
  let stillFrames = 0;

  const check = () => {
    const next = snapshot();
    if (next !== last) {
      last = next;
      stillFrames = 0;
      onMove();
    } else {
      stillFrames += 1;
    }
    frame =
      stillFrames < TARGET_SETTLE_FRAMES ? requestAnimationFrame(check) : 0;
  };

  const observer = new MutationObserver(() => {
    stillFrames = 0;
    if (!frame) frame = requestAnimationFrame(check);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
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
