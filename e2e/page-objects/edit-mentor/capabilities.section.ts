import { Page, Locator, expect } from '@playwright/test';
import type { SettingsTab } from './settings.tab';

export const CAPABILITY_SLUGS = [
  'web-search',
  'image-generation',
  'video-generation',
  'code-interpreter',
  'subagents',
] as const;

export type CapabilitySlug = (typeof CAPABILITY_SLUGS)[number];

export const CAPABILITY_LABELS: Record<CapabilitySlug, string> = {
  'web-search': 'Web Search',
  'image-generation': 'Image Generation',
  'video-generation': 'Video Generation',
  'code-interpreter': 'Code Interpreter',
  subagents: 'Plan',
};

export function capabilityField(slug: string): string {
  return `capability_${slug.replace(/-/g, '_')}`;
}

/**
 * Reads one flag out of a settings save body. The settings save is multipart
 * (`name="capability_x"` followed by "true"/"false"), but a JSON body is
 * accepted too. Returns undefined when the flag is not in the body.
 */
export function readCapabilityFlag(
  body: string,
  field: string,
): boolean | undefined {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.[field] === 'boolean') return parsed[field];
  } catch {
    // not JSON — fall through to multipart
  }
  const match = new RegExp(`name="${field}"\\r?\\n\\r?\\n(true|false)`).exec(
    body,
  );
  return match ? match[1] === 'true' : undefined;
}

export interface CapabilitySave {
  body: string;
  url: string;
  ok: boolean;
}

/**
 * The "Agent Capabilities" block at the top of Settings > Capabilities.
 * Each switch saves on the click (one settings PUT per switch, no Save
 * button). Switches are found by `capability-toggle-<slug>`; the Edit Agent
 * dialog is resolved by `EditMentorPage` (role + name) and passed in, so
 * every locator here is dialog-scoped.
 */
export class CapabilitiesSection {
  readonly page: Page;
  readonly dialog: Locator;
  readonly section: Locator;
  readonly banner: Locator;

  constructor(
    page: Page,
    dialog: Locator,
    private readonly settings: SettingsTab,
  ) {
    this.page = page;
    this.dialog = dialog;
    this.section = dialog.getByTestId('agent-capabilities-section');
    this.banner = dialog.getByTestId('agent-capabilities-banner');
  }

  /** Opens Settings > Capabilities and waits for the block to render. */
  async open(): Promise<void> {
    await this.settings.selectSubTab('Capabilities');
    await expect(this.section).toBeVisible({ timeout: 15_000 });
  }

  row(slug: CapabilitySlug): Locator {
    return this.dialog.getByTestId(`capability-row-${slug}`);
  }

  toggle(slug: CapabilitySlug): Locator {
    return this.dialog.getByTestId(`capability-toggle-${slug}`);
  }

  errorLine(slug: CapabilitySlug): Locator {
    return this.dialog.getByTestId(`capability-error-${slug}`);
  }

  reasonLine(slug: CapabilitySlug): Locator {
    return this.dialog.getByTestId(`capability-reason-${slug}`);
  }

  infoButton(slug: CapabilitySlug): Locator {
    return this.row(slug).getByRole('button', {
      name: `More info about ${CAPABILITY_LABELS[slug]}`,
      exact: true,
    });
  }

  /**
   * The open tooltip of a row's info button. The button carries
   * `aria-describedby` only while its own tooltip is open, so this never
   * matches another row's tooltip that is still open (a hover-opened one
   * does not reliably close in a headless browser). Hover or focus first.
   */
  async tooltipFor(slug: CapabilitySlug): Promise<Locator> {
    const button = this.infoButton(slug);
    await expect(button).toHaveAttribute('aria-describedby', /.+/, {
      timeout: 5_000,
    });
    const id = await button.getAttribute('aria-describedby');
    return this.page.locator(`[id="${id}"]`);
  }

  async isEnabled(slug: CapabilitySlug): Promise<boolean> {
    await expect(this.toggle(slug)).toBeVisible({ timeout: 10_000 });
    return (await this.toggle(slug).getAttribute('aria-checked')) === 'true';
  }

  /**
   * Sets one switch and waits for its save: the settings PUT that carries the
   * flag, the "<Label> turned on/off" toast and the switch's `aria-checked`.
   * Returns the PUT, or null when the switch already had the target state.
   */
  async setEnabled(
    slug: CapabilitySlug,
    target: boolean,
  ): Promise<CapabilitySave | null> {
    if ((await this.isEnabled(slug)) === target) return null;
    const toggle = this.toggle(slug);
    await expect(toggle).toBeEnabled({ timeout: 10_000 });
    const field = capabilityField(slug);
    const [request] = await Promise.all([
      this.page.waitForRequest(
        (req) =>
          ['PUT', 'PATCH'].includes(req.method()) &&
          readCapabilityFlag(req.postData() ?? '', field) !== undefined,
        { timeout: 30_000 },
      ),
      toggle.click(),
    ]);
    const response = await request.response();
    await expect(
      this.page
        .getByText(`${CAPABILITY_LABELS[slug]} turned ${target ? 'on' : 'off'}`)
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute('aria-checked', String(target), {
      timeout: 10_000,
    });
    return {
      body: request.postData() ?? '',
      url: request.url(),
      ok: !!response && response.ok(),
    };
  }

  /** Opens Settings > Capabilities and sets one switch. */
  async openAndSet(
    slug: CapabilitySlug,
    target: boolean,
  ): Promise<CapabilitySave | null> {
    await this.open();
    return this.setEnabled(slug, target);
  }
}
