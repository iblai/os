import { Page, Locator, expect } from '@playwright/test';
import { waitForDialogReady } from '../utils/resilient';

/**
 * Page object for the "Chat Search Dialog" (issue #2053).
 *
 * Source: `app/platform/[tenantKey]/[mentorId]/_components/app-sidebar/
 * chats/chat-search-dialog.tsx`, opened from two mutually-exclusive
 * trigger buttons in `app-sidebar/index.tsx` — an icon-only "rail" button
 * (sidebar collapsed) and a text-label button (sidebar expanded). Both
 * share the exact same accessible name ("Search chats"), so a single
 * locator scoped to the sidebar `<aside>` resolves whichever one is
 * currently rendered.
 */
export class ChatSearchDialogPage {
  readonly page: Page;
  readonly sidebar: Locator;

  /** Resolves to whichever of the rail/expanded triggers is mounted. */
  readonly searchChatsButton: Locator;

  readonly dialog: Locator;
  readonly searchbox: Locator;
  readonly newChatRow: Locator;
  /** All row buttons across every recency group's `<ul role="list">`. */
  readonly rows: Locator;
  /** The "Loading more chats" pagination spinner (`role="status"`). */
  readonly spinner: Locator;
  /** Infinite-scroll sentinel div observed by `IntersectionObserver`. */
  readonly sentinel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('aside').first();

    this.searchChatsButton = this.sidebar.getByRole('button', {
      name: 'Search chats',
    });

    this.dialog = page.getByRole('dialog', { name: 'Search chats' });
    this.searchbox = this.dialog.getByRole('searchbox');
    this.newChatRow = this.dialog.getByRole('button', {
      name: 'New Chat',
      exact: true,
    });
    this.rows = this.dialog.getByRole('list').getByRole('button');
    this.spinner = this.dialog.getByRole('status');
    this.sentinel = this.dialog.locator(
      '[data-testid="chat-search-scroll-sentinel"]',
    );
  }

  /**
   * Open the dialog via the EXPANDED sidebar's text-label trigger.
   * Caller must ensure the sidebar is expanded first (it is by default).
   */
  async openFromSidebar(): Promise<void> {
    await expect(this.searchChatsButton).toBeVisible({ timeout: 10_000 });
    await this.searchChatsButton.click();
    await waitForDialogReady(this.page, this.dialog);
  }

  /**
   * Open the dialog via the COLLAPSED "rail" icon-only trigger. This is
   * the SAME underlying `searchChatsButton` locator — the rail and
   * expanded triggers are mutually exclusive in the DOM (gated on the
   * sidebar's `railCollapsed` boolean) — kept as a distinct method name
   * so journey specs read as intent, not implementation.
   */
  async openFromRail(): Promise<void> {
    await this.openFromSidebar();
  }

  /**
   * Returns a locator for the recency group header text (e.g.
   * "Previous 7 Days", "Previous 30 Days", "Older"), scoped to the dialog.
   */
  groupHeader(text: string): Locator {
    return this.dialog.getByText(text, { exact: true });
  }

  /**
   * Returns a locator for a result row whose accessible name contains
   * `text` (substring, case-insensitive — matches `getByRole`'s default
   * name-matching behavior, same convention as `SidebarPage.getRecentChatRow`).
   */
  rowByText(text: string): Locator {
    return this.dialog.getByRole('list').getByRole('button', { name: text });
  }

  /**
   * Fill the searchbox and wait for the debounced (300ms) server-side
   * search request to round-trip. The debounce/query wiring lives in
   * `use-recent-chats.ts` (`useDebounce(searchInput, 300)` feeding
   * `useGetRecentMessagesInfiniteQuery({ ..., search: debouncedSearch })`),
   * which hits `GET .../recent-messages/?limit=...&offset=...&mentor=...
   * &search=<term>` — the SDK only appends the `search` param when the
   * trimmed term is non-empty (see `@iblai/data-layer`'s
   * `buildRecentMessagesUrl`), so clearing the box produces a request with
   * NO `search=` param rather than `search=`.
   *
   * We opportunistically wait for a matching network response as a speed
   * optimization; the real correctness guarantee for callers comes from
   * asserting on visible rows afterwards via `expect.poll`/`waitFor`
   * (never from this method alone), since network-response matching by
   * URL substring is best-effort and must not be treated as authoritative.
   */
  async search(term: string): Promise<void> {
    const trimmed = term.trim();
    // Mirrors the SDK's own `URLSearchParams` encoding (spaces → `+`) so
    // the substring we look for matches the real request byte-for-byte.
    const searchParam =
      trimmed === ''
        ? null
        : new URLSearchParams({ search: trimmed }).toString();

    const responseWait = this.page
      .waitForResponse(
        (response) => {
          if (response.request().method() !== 'GET') return false;
          if (!response.url().includes('/recent-messages/')) return false;
          return searchParam === null
            ? !response.url().includes('search=')
            : response.url().includes(searchParam);
        },
        { timeout: 10_000 },
      )
      .catch(() => null);
    await this.searchbox.fill(term);
    await responseWait;
  }

  async selectRow(text: string): Promise<void> {
    await this.rowByText(text).click();
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).not.toBeVisible({ timeout: 10_000 });
  }
}
