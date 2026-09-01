'use client';

import { ReactNode } from 'react';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface CapabilityGateProps {
  /** Short, human title for the capability (e.g. "Long-term memory"). */
  title: string;
  /**
   * Plain-language explanation of what turning this on actually does — written
   * for a non-technical admin, not a spec. Rendered under the title.
   */
  description: string;
  /** Current on/off state of the capability. */
  enabled: boolean;
  /** Called with the new value when the admin flips the switch. */
  onToggle: (checked: boolean) => void;
  /**
   * Disables the switch itself (RBAC read-only, in-flight save, etc.). The
   * gate stays rendered so the admin can still see the current state.
   */
  disabled?: boolean;
  /** Accessible label for the switch. Defaults to `title`. */
  ariaLabel?: string;
  /** Optional hint shown just above the gated content while the capability is off. */
  offHint?: string;
  /** test-id forwarded to the switch for e2e/unit hooks. */
  toggleTestId?: string;
  /** The capability's configuration UI. Grayed out + inert while `enabled` is false. */
  children: ReactNode;
}

/**
 * App-side twin of the web-containers `CapabilityGate`. Renders a capability's
 * on/off toggle (previously buried in Settings → Capabilities) directly at the
 * top of the tab that configures it, with a naive-friendly explanation. The
 * configuration UI below stays visible but grayed out + inert until the
 * capability is switched on.
 *
 * Kept as a local copy (rather than importing the SDK one) so the app doesn't
 * depend on a rebuilt web-containers dist to compile.
 */
export function CapabilityGate({
  title,
  description,
  enabled,
  onToggle,
  disabled = false,
  ariaLabel,
  offHint,
  toggleTestId,
  children,
}: CapabilityGateProps) {
  return (
    <div className="space-y-4">
      <div
        className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
        data-testid="capability-gate-header"
      >
        <div className="min-w-0">
          <p className="text-xs leading-relaxed text-gray-600">
            {description}
            {!enabled && offHint && (
              <span
                className="font-medium text-gray-500"
                data-testid="capability-gate-off-hint"
              >
                {' '}
                {offHint}
              </span>
            )}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
          aria-label={ariaLabel ?? title}
          aria-checked={enabled}
          data-testid={toggleTestId}
          className="mt-0.5 flex-shrink-0"
        />
      </div>

      <div
        className={cn(
          'transition-opacity',
          !enabled && 'pointer-events-none opacity-50 select-none',
        )}
        aria-hidden={!enabled}
        inert={!enabled}
        data-testid="capability-gate-content"
        data-enabled={enabled}
      >
        {children}
      </div>
    </div>
  );
}
