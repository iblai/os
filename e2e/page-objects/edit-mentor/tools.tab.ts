import { Page, Locator, expect } from '@playwright/test';

/**
 * Copy for the SDK's `AgentToolsTab` (`@iblai/web-containers` →
 * `@iblai/iblai-js/web-containers/next`), pinned here against the compiled
 * bundle's `AGENT_TOOLS_TAB_LABELS` / `toolsTabLabels` i18n catalog entry.
 * OS's `ToolsTab` wrapper (`components/modals/edit-mentor-modal/tabs/
 * tools-tab.tsx`) passes no `labels` override, so these are exactly what
 * renders. There is no OS-owned override for this tab (see the
 * `chore(i18n): drop the tabsToolsTab messages now owned by the SDK` commit)
 * — if OS ever adds one, update these constants to match (see the Settings
 * tab's override, tracked in the `project_settings_tab_label_override`
 * agent memory, for what that looks like).
 */
const LABELS = {
  header: {
    title: 'Tools',
    description: 'Configure tools and integrations for your agent.',
  },
  infoBox:
    'Give your agent hands. Tools let it do things beyond chatting — look something up, call an API, trigger an action — so it can actually get work done for people.',
  toasts: {
    toggleSuccess: 'Agent updated successfully',
    toggleError: 'Failed to update tool',
  },
};

/** Escapes a string for safe interpolation into a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ToolsTab {
  readonly page: Page;
  readonly dialog: Locator;

  static readonly LABELS = LABELS;

  readonly heading: Locator;
  readonly description: Locator;
  readonly infoBox: Locator;
  readonly toolToggles: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.heading = this.dialog.getByRole('heading', {
      name: LABELS.header.title,
      exact: true,
    });
    this.description = this.dialog.getByText(LABELS.header.description, {
      exact: true,
    });
    this.infoBox = this.dialog.getByTestId('tools-info-box');
    this.toolToggles = this.dialog.getByRole('switch');
    // Sonner toasts are portalled outside the dialog, hence page-scoped.
    this.successToast = this.page
      .getByText(LABELS.toasts.toggleSuccess)
      .first();
    this.errorToast = this.page.getByText(LABELS.toasts.toggleError).first();
  }

  /**
   * A tool's switch, matched by its full accessible name — the SDK always
   * renders it as "{displayName} enabled" or "{displayName} disabled" (see
   * `switchAriaLabel` in the SDK's `tools-tab/labels.ts`). Anchoring on the
   * full "name + state" string (rather than just `name`, which would never
   * match on an anchored regex — see the
   * `bugfix_anchored_toggle_regex_never_matches` agent memory) is what makes
   * this resilient across the ON/OFF label swap.
   */
  private getToolToggle(toolName: string): Locator {
    return this.dialog.getByRole('switch', {
      name: new RegExp(`^${escapeRegExp(toolName)} (enabled|disabled)$`, 'i'),
    });
  }

  /** The info ("i") icon button next to a tool's name; hover/focus reveals its description. */
  infoIcon(toolName: string): Locator {
    return this.dialog.getByRole('button', {
      name: `More info about ${toolName}`,
      exact: true,
    });
  }

  /**
   * The tooltip content panel for a specific tool, scoped via its info
   * icon's `aria-describedby` (Radix only sets this attribute — pointing at
   * the open tooltip's own id — while that specific tooltip is open; see
   * `@radix-ui/react-tooltip`'s `TooltipTrigger`). Scoping this way (rather
   * than a bare `page.getByRole('tooltip')`) matters because more than one
   * tool's tooltip can be open at once in this app — a live run showed
   * Radix's tooltip does not reliably close on a synthetic
   * `page.mouse.move` away from the trigger in a headless browser — so a
   * page-wide `role=tooltip` locator can resolve to multiple elements and
   * fail Playwright's strict-mode single-match requirement. Caller must
   * have already triggered the tooltip open (hover/focus) before calling
   * this. Radix portals `TooltipContent` to `document.body` (outside the
   * dialog), hence page-scoped rather than dialog-scoped.
   */
  async tooltipFor(toolName: string): Promise<Locator> {
    const icon = this.infoIcon(toolName);
    await expect(icon).toHaveAttribute('aria-describedby', /.+/, {
      timeout: 5_000,
    });
    const id = await icon.getAttribute('aria-describedby');
    return this.page.locator(`#${id}`);
  }

  async toggleTool(toolName: string): Promise<void> {
    const toggle = this.getToolToggle(toolName);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
  }

  /**
   * Enable a tool if it is not already enabled, and wait for the toggle to
   * settle (aria-checked flips, success toast fires) rather than sleeping a
   * fixed duration.
   */
  async enableTool(toolName: string): Promise<void> {
    const toggle = this.getToolToggle(toolName);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    const isChecked = (await toggle.getAttribute('aria-checked')) === 'true';
    if (isChecked) return;
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true', {
      timeout: 15_000,
    });
    await expect(this.successToast).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Disable a tool if it is currently enabled, and wait for the toggle to
   * settle (aria-checked flips, success toast fires) rather than sleeping a
   * fixed duration.
   */
  async disableTool(toolName: string): Promise<void> {
    const toggle = this.getToolToggle(toolName);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    const isChecked = (await toggle.getAttribute('aria-checked')) === 'true';
    if (!isChecked) return;
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false', {
      timeout: 15_000,
    });
    await expect(this.successToast).toBeVisible({ timeout: 15_000 });
  }

  async isToolEnabled(toolName: string): Promise<boolean> {
    const toggle = this.getToolToggle(toolName);
    return (await toggle.getAttribute('aria-checked')) === 'true';
  }

  /** Whether a tool's switch control is currently disabled (loading / read-only). */
  async isToolControlDisabled(toolName: string): Promise<boolean> {
    const toggle = this.getToolToggle(toolName);
    return toggle.isDisabled();
  }

  async getToolCount(): Promise<number> {
    return this.toolToggles.count();
  }

  /**
   * Every tool's display name, parsed off each switch's accessible name
   * (stripping the trailing " enabled"/" disabled" state suffix). There is
   * no dedicated test-id or role for a tool's name text alone, so the
   * switch's aria-label — which the SDK derives from the same
   * `display_name` — is the most stable source of truth.
   */
  async getToolNames(): Promise<string[]> {
    const count = await this.toolToggles.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const ariaLabel = await this.toolToggles
        .nth(i)
        .getAttribute('aria-label');
      if (!ariaLabel) continue;
      names.push(ariaLabel.replace(/ (enabled|disabled)$/i, ''));
    }
    return names;
  }
}
