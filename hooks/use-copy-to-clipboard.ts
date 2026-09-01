import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';

type CopyFn = (text: string) => Promise<void>;

type CopyStatus = 'idle' | 'success' | 'error';

type UseCopyToClipboardReturn = {
  copy: CopyFn;
  status: CopyStatus;
};

/**
 * Copies via a temporary selection + `document.execCommand('copy')`.
 *
 * The async Clipboard API is gated by the `clipboard-write` Permissions Policy,
 * which a cross-origin embedder (an LMS iframing the mentor, say) has to
 * delegate explicitly — most do not, so `navigator.clipboard` rejects and the
 * copy button silently does nothing. `execCommand` is not gated by Permissions
 * Policy; it only needs the user activation the click already provides.
 */
function copyWithExecCommand(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = 'none';
  textarea.style.opacity = '0';

  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  // `select()` pulls focus onto the throwaway textarea. Left unrestored that
  // breaks a dialog's focus trap and drops the caret out of whatever the user
  // was editing.
  const previouslyFocused = document.activeElement as HTMLElement | null;

  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
    if (selection && previousRange) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
    if (typeof previouslyFocused?.focus === 'function') {
      previouslyFocused.focus();
    }
  }

  return copied;
}

/**
 * Whether the Clipboard API is usable in this document.
 *
 * Calling `writeText()` where the policy forbids it makes Chrome log a
 * `[Violation] Permissions policy violation` to the console before rejecting —
 * noise no `catch` can suppress. Asking first keeps the console clean, and
 * skipping the rejected await also preserves the user activation that the
 * `execCommand` fallback depends on.
 *
 * `document.featurePolicy` is non-standard and Chromium-only; it may well
 * disappear when Permissions Policy finishes replacing Feature Policy. That is
 * survivable and must stay that way: saying `true` when we cannot tell costs
 * only the console-noise suppression, because `writeText()` still rejects and
 * the fallback still runs. Do not let this become load-bearing.
 */
function clipboardWriteAllowed(): boolean {
  const featurePolicy = (
    document as Document & {
      featurePolicy?: { allowsFeature?: (feature: string) => boolean };
    }
  ).featurePolicy;

  if (typeof featurePolicy?.allowsFeature !== 'function') return true;

  try {
    return featurePolicy.allowsFeature('clipboard-write');
  } catch {
    return true;
  }
}

export function useCopyToClipboard(
  timeout: number = 500,
): UseCopyToClipboardReturn {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const { tenantKey } = useParams<TenantKeyMentorIdParams>() ?? {};
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const copy: CopyFn = useCallback(
    async (text) => {
      // Both outcomes decay back to `idle`, and each copy cancels the previous
      // timer — otherwise a second copy inherits the first one's deadline and
      // the indicator clears while it is still meant to be showing.
      const settle = (next: Exclude<CopyStatus, 'idle'>) => {
        clearTimeout(resetTimerRef.current);
        setStatus(next);
        resetTimerRef.current = setTimeout(() => {
          setStatus('idle');
        }, timeout);
      };

      if (navigator?.clipboard && clipboardWriteAllowed()) {
        try {
          await navigator.clipboard.writeText(text);
          settle('success');
          return;
        } catch (error) {
          console.warn(
            JSON.stringify({
              tenant: tenantKey,
              message: 'clipboard write blocked, falling back to execCommand',
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }

      if (copyWithExecCommand(text)) {
        settle('success');
        return;
      }

      console.error(
        JSON.stringify({
          tenant: tenantKey,
          message: 'copy to clipboard failed',
        }),
      );
      settle('error');
    },
    [timeout, tenantKey],
  );

  return { copy, status };
}
