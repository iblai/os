'use client';

import { cn } from '@/lib/utils';

/**
 * Temporary-chat status icon. Two states:
 *
 *  - `active === false` → dashed ring filled with brand teal `#28a8a0`.
 *    The "off" state — clicking the surrounding button will turn temporary
 *    chat on.
 *  - `active === true`  → dashed ring with an inset check, filled with
 *    brand blue `#6eabdf`. The "on" state — the conversation won't be
 *    saved to history.
 *
 * Paths are vendored verbatim from `temp.svg` (symbols `28a8a0` and
 * `6eabdf`). The fill is set on the `<svg>` element itself rather than
 * via `currentColor` because these brand hexes are fixed for the feature
 * and shouldn't shift with the surrounding text color.
 */
export function TempChatIcon({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      // Brand-fixed colors — driven by the `active` prop, not by theme.
      fill={active ? '#6eabdf' : '#28a8a0'}
      // Default to a clearly visible size; callers may override via className.
      className={cn('h-6 w-6', className)}
    >
      {active && (
        <path d="M11.73 7.352a.665.665 0 0 1 1.124.713l-3.175 5a.665.665 0 0 1-1.053.092l-1.825-2-.081-.109a.665.665 0 0 1 .963-.878l.1.09 1.238 1.357z" />
      )}
      <path d="M4.521 15.166a.665.665 0 0 0-1.24-.459l-.048.126a14 14 0 0 1-.372 1.196l-.148.4a.666.666 0 0 0 .661.902l.405-.03a14.5 14.5 0 0 0 2.455-.425c.613.303 1.27.534 1.96.682a.665.665 0 1 0 .279-1.3 7 7 0 0 1-1.85-.676.67.67 0 0 0-.37-.077l-.125.023q-.883.25-1.822.375.047-.147.092-.293z" />
      <path d="M15.8 14.537a.665.665 0 0 0-.833-.107l-.107.083a6.95 6.95 0 0 1-3.333 1.744.665.665 0 0 0 .279 1.301 8.3 8.3 0 0 0 3.765-1.893l.204-.188a.665.665 0 0 0 .025-.94" />
      <path d="M2.238 7.59a7.4 7.4 0 0 0-.092 4.533l.092.288a.665.665 0 0 0 1.288-.302l-.03-.132A6 6 0 0 1 3.164 10c0-.69.116-1.355.33-1.977a.665.665 0 0 0-1.257-.434" />
      <path d="M16.917 12.823a.665.665 0 0 0 .845-.412 7.388 7.388 0 0 0 0-4.821.665.665 0 1 0-1.257.433c.214.622.33 1.287.33 1.977s-.116 1.355-.33 1.977a.665.665 0 0 0 .412.846" />
      <path d="M8.983 2.953a.665.665 0 0 0-.789-.511A8.3 8.3 0 0 0 4.43 4.335l-.204.188a.665.665 0 0 0 .808 1.047l.107-.082a6.95 6.95 0 0 1 3.333-1.745.665.665 0 0 0 .51-.79" />
      <path d="M15.571 4.335a8.3 8.3 0 0 0-3.765-1.893.665.665 0 0 0-.279 1.3A6.97 6.97 0 0 1 14.69 5.33l.17.158.107.082a.665.665 0 0 0 .896-.945l-.088-.102z" />
    </svg>
  );
}
