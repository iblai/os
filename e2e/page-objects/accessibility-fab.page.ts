import type { CDPSession, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const POSITION_STORAGE_KEY = 'accessibility-fab-position:v2';

export interface StoredFabPosition {
  side: 'left' | 'right';
  bottom: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draggable accessibility button (issue #2611): wrapper `accessibility-fab`,
 * the round button inside it, its menu panel, and the polite live region that
 * announces position changes.
 */
export class AccessibilityFabPage {
  readonly fab: Locator;
  readonly button: Locator;
  readonly menuHeading: Locator;
  readonly liveRegion: Locator;
  readonly resetPositionButton: Locator;
  readonly resetAllButton: Locator;
  readonly fileDropOverlay: Locator;

  constructor(private readonly page: Page) {
    this.fab = page.getByTestId('accessibility-fab');
    this.button = page.getByRole('button', { name: 'Open Accessibility Menu' });
    this.menuHeading = page.getByText('Accessibility Menu', { exact: true });
    this.liveRegion = page
      .getByRole('status')
      .filter({ hasText: /Accessibility button moved/ });
    this.resetPositionButton = page.getByRole('button', {
      name: 'Reset Button Position',
    });
    this.resetAllButton = page.getByRole('button', {
      name: 'Reset All Accessibility Settings',
    });
    this.fileDropOverlay = page.getByText('Drop your files here');
  }

  /**
   * Forces `accessibility_menu: true` in the tenant metadata the SDK reads
   * from localStorage (`tenants` entry for the URL's tenant, and
   * `current_tenant`). Runs on every load, before app code. Call BEFORE navigating.
   *
   * The app re-saves `tenants` from the platforms list after load, which would
   * drop the seeded flag on a tenant that has it off, so that response is
   * patched too.
   */
  async enableAccessibilityMenu(): Promise<void> {
    await this.page.route('**/api/core/users/platforms/**', async (route) => {
      const response = await route.fetch();
      const tenants = await response.json().catch(() => null);
      if (!Array.isArray(tenants)) return route.fulfill({ response });
      const org = /\/platform\/([^/]+)/.exec(
        new URL(this.page.url()).pathname,
      )?.[1];
      for (const t of tenants) {
        if (t && (!org || t.key === org)) {
          t.metadata = { ...(t.metadata ?? {}), accessibility_menu: true };
        }
      }
      await route.fulfill({ response, json: tenants });
    });

    await this.page.addInitScript(() => {
      const parse = (raw: string | null): unknown => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      };
      const patch = (t: unknown): boolean => {
        if (!t || typeof t !== 'object') return false;
        const tenant = t as { metadata?: Record<string, unknown> };
        tenant.metadata = {
          ...(tenant.metadata ?? {}),
          accessibility_menu: true,
        };
        return true;
      };
      try {
        const org = /\/platform\/([^/]+)/.exec(window.location.pathname)?.[1];
        const tenants = parse(window.localStorage.getItem('tenants'));
        if (Array.isArray(tenants)) {
          let changed = false;
          for (const t of tenants) {
            if (t && (!org || t.key === org)) changed = patch(t) || changed;
          }
          if (changed)
            window.localStorage.setItem('tenants', JSON.stringify(tenants));
        }
        const current = parse(
          window.localStorage.getItem('current_tenant'),
        ) as {
          key?: string;
        } | null;
        if (current && (!org || current.key === org) && patch(current))
          window.localStorage.setItem(
            'current_tenant',
            JSON.stringify(current),
          );
      } catch {
        // storage unavailable (e.g. about:blank) — nothing to patch
      }
    });
  }

  async expectVisible(): Promise<void> {
    await expect(this.button).toBeVisible({ timeout: 30_000 });
  }

  async box(): Promise<Box> {
    const box = await this.fab.boundingBox();
    if (!box) throw new Error('accessibility-fab has no bounding box');
    return box;
  }

  async viewport(): Promise<{ width: number; height: number }> {
    return this.page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  }

  async side(): Promise<'left' | 'right'> {
    const [box, vp] = await Promise.all([this.box(), this.viewport()]);
    return box.x + box.width / 2 < vp.width / 2 ? 'left' : 'right';
  }

  async bottomOffset(): Promise<number> {
    const [box, vp] = await Promise.all([this.box(), this.viewport()]);
    return vp.height - (box.y + box.height);
  }

  async inlineStyle(prop: 'right' | 'bottom' | 'transition'): Promise<string> {
    return this.fab.evaluate(
      (el, p) => (el as HTMLElement).style.getPropertyValue(p),
      prop,
    );
  }

  async stored(): Promise<StoredFabPosition | null> {
    return this.page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, POSITION_STORAGE_KEY);
  }

  async seedStored(value: StoredFabPosition): Promise<void> {
    await this.page.evaluate(
      ([key, v]) =>
        window.localStorage.setItem(key as string, JSON.stringify(v)),
      [POSITION_STORAGE_KEY, value] as const,
    );
  }

  async clearStored(): Promise<void> {
    await this.page.evaluate(
      (key) => window.localStorage.removeItem(key),
      POSITION_STORAGE_KEY,
    );
  }

  /** Waits until the box stops moving (covers the snap animation). */
  async waitForSettled(): Promise<Box> {
    let prev = await this.box();
    for (let i = 0; i < 40; i++) {
      await this.page.waitForTimeout(100);
      const next = await this.box();
      if (next.x === prev.x && next.y === prev.y) return next;
      prev = next;
    }
    return prev;
  }

  async centre(): Promise<{ x: number; y: number }> {
    const box = await this.box();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /** Mouse drag in small steps; the button's centre ends up at (toX, toY). */
  async mouseDragTo(toX: number, toY: number): Promise<void> {
    const from = await this.centre();
    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(toX, toY, {
      steps: this.stepsFor(from, toX, toY),
    });
    await this.page.mouse.up();
  }

  /**
   * Mouse capture only starts once the pointer has moved 5px *over the
   * button*, so a single mouse event that jumps off it loses the drag. Real
   * mice emit events every few px; keep each synthetic step small (<= 8px).
   */
  stepsFor(from: { x: number; y: number }, toX: number, toY: number): number {
    return Math.max(10, Math.ceil(Math.hypot(toX - from.x, toY - from.y) / 8));
  }

  async mouseDragBy(dx: number, dy: number): Promise<void> {
    const from = await this.centre();
    await this.mouseDragTo(from.x + dx, from.y + dy);
  }

  /** Touch drag via CDP (Playwright's touchscreen only taps). Chromium only. */
  async touchDragTo(toX: number, toY: number): Promise<void> {
    const cdp: CDPSession = await this.page.context().newCDPSession(this.page);
    const from = await this.centre();
    const steps = 20;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x, y: from.y }],
    });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: from.x + ((toX - from.x) * i) / steps,
            y: from.y + ((toY - from.y) * i) / steps,
          },
        ],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
  }

  async installDragEventCounter(): Promise<void> {
    await this.page.evaluate(() => {
      const w = window as unknown as { __dragEvents: string[] };
      w.__dragEvents = [];
      for (const type of ['dragstart', 'dragenter', 'dragover']) {
        document.addEventListener(type, () => w.__dragEvents.push(type), true);
      }
    });
  }

  async dragEvents(): Promise<string[]> {
    return this.page.evaluate(
      () => (window as unknown as { __dragEvents: string[] }).__dragEvents,
    );
  }

  async openMenu(): Promise<void> {
    await this.button.click();
    await expect(this.menuHeading).toBeVisible();
  }

  /** The panel covers the button when the button sits on the right edge, so close via its header X. */
  async closeMenu(): Promise<void> {
    await this.menuHeading.locator('xpath=..').getByRole('button').click();
    await expect(this.menuHeading).toBeHidden();
  }

  cornerButton(
    corner: 'top left' | 'top right' | 'bottom left' | 'bottom right',
  ): Locator {
    return this.page.getByRole('button', {
      name: `Move button to ${corner} corner`,
    });
  }

  async expectOnScreen(): Promise<void> {
    const [box, vp] = await Promise.all([this.box(), this.viewport()]);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  }
}
