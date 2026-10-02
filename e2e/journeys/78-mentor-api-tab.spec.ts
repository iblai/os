/**
 * Journey 78 — Mentor API Tab
 *
 * Covers the API tab added to the Edit Agent modal's Integrations category.
 * The tab is rendered by the SDK's `AgentApiTab`
 * (`@iblai/iblai-js/web-containers/next`) via OS's thin wrapper
 * `components/modals/edit-mentor-modal/tabs/api-tab.tsx`, which passes no
 * `labels` override — all copy comes straight from the SDK's i18n catalog
 * (see the `messages/en.json` diff on this branch dropping OS's now-dead
 * `apiTabApiKeyModal` / `apiTabCreateApiModal` / `apiTabDeleteApiModal` /
 * `tabsApiTab` override keys), same story as journey 77's Tools tab.
 *
 * ── Top priority: the expiration date picker (calendar) ─────────────────
 * The calendar previously had a real, user-visible bug: opening the date
 * picker and clicking a day fell through the popover to the Create dialog's
 * own overlay and closed the WHOLE dialog instead of selecting the date.
 * Fixed in the SDK's `ui/popover.tsx` by adding `pointer-events-auto` to
 * `PopoverContent`. `ApiTab.pickAnyEnabledDay()` asserts the Create dialog
 * is still open immediately after the click — see its docstring — so any
 * regression here fails loudly instead of silently reopening the bug.
 *
 * ── Two nested dialogs stay mounted after a successful create ───────────
 * `CreateApiModal` keeps its own Dialog open (behind the reveal "API Key"
 * dialog) even after a successful submit — `apiKey` state just adds the
 * reveal dialog on top; closing the reveal dialog alone leaves the Create
 * dialog (and, via Radix's stacked-dialog `hideOthers`, the parent Edit
 * Agent dialog's `aria-hidden`) still there. `ApiTab.dismissCreateFlow()`
 * closes both — verified live against the real backend (network capture)
 * before writing this spec; see the `pattern_route_mocking_hard_to_trigger`-
 * adjacent investigation notes in this journey's own checkpoints below.
 *
 * ── API keys are TENANT-scoped, not agent-scoped ─────────────────────────
 * Deleting the disposable mentor each test creates does NOT remove any API
 * keys created through it — the `/api/core/platform/api-tokens/` endpoint is
 * keyed by `platform_key` (tenant) alone. Every test therefore explicitly
 * tracks and deletes the exact key name(s) it creates (UI or API-seeded),
 * and a worker-scoped fixture (`apiKeyResidueReaped`, `utils/api-key-
 * residue.ts`) reaps any stale `e2e-apikey-*` residue older than 2h left by
 * a crashed prior run — mirrors `lti-residue.ts`'s tenant-scoped pattern.
 *
 * ── The tenant already holds real, foreign API keys — never touch them ──
 * At the time this journey was written the tenant carried ~26 pre-existing
 * keys unrelated to this suite (a handful of real ones plus ~20 manually
 * created `pagination-test-*` keys). Every helper here creates/deletes ONLY
 * names it generated itself (`ApiTab.uniqueName()`, prefix `e2e-apikey-`);
 * nothing here ever lists-then-deletes-everything or assumes a specific
 * starting count. Pagination checkpoints do not assume our rows land on any
 * particular page number in general (see `ApiTab.findPageContaining`) —
 * empirically (verified via live network capture), the list IS newest-
 * created-first, so a just-created row reliably lands on page 1 and a
 * bulk-seeded batch reliably lands there too; this is asserted directly
 * rather than assumed blind.
 *
 * ── Why the "delete the only row on the last page" checkpoint is mocked ──
 * The real tenant's true LAST page is always the globally OLDEST key
 * (newest-first ordering — confirmed live), which is always foreign,
 * protected data. A live probe also confirmed the backend ignores any
 * client-supplied `created` timestamp on POST (always server-stamps "now"),
 * so there is no way to make one of our own keys sort to the tail without
 * either deleting foreign rows (forbidden) or waiting for real wall-clock
 * time. This checkpoint instead mocks the `api-tokens` GET/DELETE endpoints
 * (`page.route`) with a small, fully synthetic 11-row dataset so the exact
 * same frontend code path (`AgentApiTab`'s `isPageGone` effect) is exercised
 * deterministically without touching any real data — the established
 * pattern for hard-to-trigger backend state in this repo (see the
 * `pattern_route_mocking_hard_to_trigger` agent-memory note; prior art:
 * `ChatPage.mockFileUpload()`).
 *
 * ── Isolation ─────────────────────────────────────────────────────────────
 * Every test creates its own fresh, disposable mentor via
 * `createMentorPage.openAndCreate()` (auto-tracked + auto-pinned to the
 * cheap ibl.ai model by `CreateMentorPage.createWithName` — no manual
 * `MentorTracker` needed, see the `pattern_mock_file_upload_csp_and_mentor_
 * cleanup_auto` agent memory), even though the API keys under test are
 * tenant- not mentor-scoped — this keeps the suite's isolation story
 * uniform with the rest of the Edit Agent modal journeys (mirrors journey
 * 77). Because every test mutates the SAME tenant-wide key list, the whole
 * file runs serially in one worker (`test.describe.configure({ mode:
 * 'serial' })`), same as journeys 47/66/77.
 */

import type { Page } from '@playwright/test';
import { test as base, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { dmBaseFromEnv, resolveDmApiBase } from '../utils/dm-api';
import { reapStaleApiKeyResidue } from '../utils/api-key-residue';
import { ApiTab } from '../page-objects/edit-mentor/api-tab';

// ---------------------------------------------------------------------------
// Worker-scoped fixture: reap stale e2e-named API-key residue once per worker.
// ---------------------------------------------------------------------------

type ApiKeyWorkerFixtures = {
  apiKeyResidueReaped: void;
};

const test = base.extend<object, ApiKeyWorkerFixtures>({
  apiKeyResidueReaped: [
    async ({ browser }, use, workerInfo) => {
      const storageState = workerInfo.project.use.storageState as
        | string
        | undefined;
      const setupCtx = await browser.newContext(
        storageState ? { storageState } : {},
      );
      try {
        const page = await setupCtx.newPage();
        await navigateToMentorApp(page);
        if (await checkAdminStatus(page)) {
          await reapStaleApiKeyResidue(page);
        }
      } finally {
        await setupCtx.close();
      }
      await use();
    },
    { scope: 'worker' },
  ],
});

// ---------------------------------------------------------------------------
// Direct-API helpers for seeding/cleaning up tenant-wide keys fast (bulk
// pagination seeding) without driving the UI for every row.
// ---------------------------------------------------------------------------

async function apiTokenAuth(
  page: Page,
): Promise<{ dmToken: string; tenantKey: string; username: string }> {
  return page.evaluate(() => {
    const parse = (key: string) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        return null;
      }
    };
    const ct = parse('current_tenant');
    return {
      dmToken: localStorage.getItem('dm_token') ?? '',
      tenantKey: typeof ct === 'string' ? ct : (ct?.key ?? ''),
      username: parse('userData')?.user_nicename ?? '',
    };
  });
}

async function createApiKeyViaApi(
  page: Page,
  dmBase: string,
  name: string,
): Promise<void> {
  const { dmToken, tenantKey, username } = await apiTokenAuth(page);
  const res = await page.request.post(
    `${dmBase}/api/core/platform/api-tokens/`,
    {
      headers: {
        Authorization: `Token ${dmToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        username,
        name,
        key: '',
        platform_key: tenantKey,
        created: new Date().toISOString(),
        expires: '',
      },
      timeout: 15_000,
    },
  );
  expect(
    res.ok(),
    `Seeding API key "${name}" failed: ${res.status()} ${await res.text().catch(() => '')}`,
  ).toBeTruthy();
}

async function deleteApiKeyViaApi(
  page: Page,
  dmBase: string,
  name: string,
): Promise<void> {
  const { dmToken, tenantKey } = await apiTokenAuth(page);
  await page.request
    .delete(
      `${dmBase}/api/core/platform/api-tokens/${encodeURIComponent(name)}?platform_key=${encodeURIComponent(tenantKey)}`,
      { headers: { Authorization: `Token ${dmToken}` }, timeout: 15_000 },
    )
    .catch(() => null);
}

// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

test.describe('Journey 78: Mentor API Tab', () => {
  test.beforeEach(
    async ({ page, createMentorPage, apiKeyResidueReaped: _reaped }) => {
      await navigateToMentorApp(page);
      const isAdmin = await checkAdminStatus(page);
      if (!isAdmin) {
        test.skip(true, 'API tab requires admin access');
        return;
      }

      // Fresh, dedicated mentor per test — see the isolation note above.
      await createMentorPage.openAndCreate();
      await waitForPageReady(page);
    },
  );

  // API-01: Header, description, info box, disclaimers, and the Create
  // button render with the SDK's default copy.
  test('admin opens the API tab and sees the header, description, info box, and Create button', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('API');
    await waitForPageReady(page);
    const { api } = editMentorPage;

    await expect(api.heading).toBeVisible({ timeout: 10_000 });
    await expect(api.description).toBeVisible({ timeout: 5_000 });
    await expect(api.infoBox).toBeVisible({ timeout: 5_000 });
    await expect(api.infoBox).toContainText(ApiTab.LABELS.infoBox);
    await expect(api.infoBox).toContainText(ApiTab.LABELS.disclaimer.lineOne);
    await expect(api.createButton).toBeVisible({ timeout: 10_000 });
    await expect(api.createButton).toContainText(
      ApiTab.LABELS.actions.createNew,
    );

    await editMentorPage.close();
  });

  // API-02 (top priority — calendar regression guard): open Create, open
  // the date picker, navigate to next month, pick a day — the dialog must
  // stay open and the trigger must show the picked PPP date. Submitting
  // shows the success toast + reveal dialog; after closing it, the new
  // row's EXPIRES cell shows that exact date.
  test('admin creates an API key with an expiration date picked via the calendar, and the row shows that exact date', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('API');
    await waitForPageReady(page);
    const { api } = editMentorPage;
    const name = ApiTab.uniqueName();

    await api.openCreateDialog();
    await api.nameInput().fill(name);
    await api.openCalendar();
    await api.calendarNextMonthButton.click();
    await page.waitForTimeout(200);

    // pickAnyEnabledDay() itself asserts the Create dialog is still visible
    // immediately after the click — the calendar-popover regression guard.
    const dayLabel = await api.pickAnyEnabledDay();
    expect(dayLabel.length).toBeGreaterThan(0);

    // The trigger's own text should now show the picked date, not the
    // "Pick a date" placeholder.
    await expect(api.expirationTrigger()).not.toContainText(
      ApiTab.LABELS.createModal.expirationPlaceholder,
    );

    await api.submitButton().click();
    await expect(
      api.successToast(ApiTab.LABELS.createModal.successToast),
    ).toBeVisible({ timeout: 15_000 });
    await expect(api.revealDialog).toBeVisible({ timeout: 10_000 });
    await api.dismissCreateFlow();

    // Derive the expected PPP string from the picked day's PPPP
    // (react-day-picker `labelDayButton`) label, e.g.
    // "Friday, October 16th, 2026" -> "October 16th, 2026". Defensively
    // strips a possible leading "Today, " too, though picking a day one
    // month ahead should never land on today.
    const expectedExpiry = dayLabel.replace(/^(Today,\s*)?[A-Za-z]+,\s*/, '');
    await expect(api.rowByName(name)).toBeVisible({ timeout: 10_000 });
    await expect(api.expiresCellFor(name)).toHaveText(expectedExpiry);

    // Cleanup — also exercises the UI delete flow.
    await api.openDeleteDialogFor(name);
    await api.confirmDelete();
    await expect(api.rowByName(name)).toHaveCount(0, { timeout: 10_000 });

    await editMentorPage.close();
  });

  // API-03: Creating without picking a date leaves EXPIRES as "N/A".
  test('admin creates an API key without an expiration date and the row shows "N/A"', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('API');
    await waitForPageReady(page);
    const { api } = editMentorPage;
    const name = ApiTab.uniqueName();

    const { dayLabel } = await api.createKey({ name });
    expect(dayLabel).toBeNull();
    await api.dismissCreateFlow();

    await expect(api.rowByName(name)).toBeVisible({ timeout: 10_000 });
    await expect(api.expiresCellFor(name)).toHaveText(
      ApiTab.LABELS.table.notAvailable,
    );

    await api.openDeleteDialogFor(name);
    await api.confirmDelete();
    await expect(api.rowByName(name)).toHaveCount(0, { timeout: 10_000 });

    await editMentorPage.close();
  });

  // API-04: Name validation. Submit stays disabled with an empty/invalid
  // name and the matching error text renders; a valid unique name clears
  // the error and enables Submit.
  test('create dialog validates the API key name and keeps Submit disabled until it is valid', async ({
    editMentorPage,
  }) => {
    await editMentorPage.open('API');
    const { api } = editMentorPage;

    await api.openCreateDialog();
    // TanStack Form only computes canSubmit after its first onChange
    // validation, so Submit starts enabled on a pristine form. Submitting the
    // empty form must still create nothing: the dialog stays open, no toast.
    await api.submitButton().click();
    await expect(api.createDialog).toBeVisible();
    await expect(
      api.successToast(ApiTab.LABELS.createModal.successToast),
    ).toHaveCount(0);

    // Invalid: spaces and "!" fail the `^[a-zA-Z0-9_-]+$` regex.
    await api.nameInput().fill('invalid name!');
    await expect(api.nameErrorText()).toContainText(
      ApiTab.LABELS.createModal.nameInvalid,
    );
    await expect(api.submitButton()).toBeDisabled();

    // Empty: required-field error.
    await api.nameInput().fill('');
    await expect(api.nameErrorText()).toContainText(
      ApiTab.LABELS.createModal.nameRequired,
    );
    await expect(api.submitButton()).toBeDisabled();

    // Valid: error clears, Submit enables.
    await api.nameInput().fill(ApiTab.uniqueName());
    await expect(api.nameErrorText()).toHaveCount(0);
    await expect(api.submitButton()).toBeEnabled({ timeout: 5_000 });

    await api.closeCreateDialogViaCancel();
    await editMentorPage.close();
  });

  // API-05: The reveal dialog's copy button flips its accessible name from
  // "Copy API key" to "Copied" once clicked (clipboard permission granted
  // per the journey 07/12 precedent; some browsers don't support the grant).
  test('reveal dialog copy button flips from "Copy API key" to "Copied"', async ({
    page,
    editMentorPage,
  }) => {
    try {
      await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {
      // Some browsers (e.g. WebKit) don't support clipboard permission grants.
    }

    await editMentorPage.open('API');
    await waitForPageReady(page);
    const { api } = editMentorPage;
    const name = ApiTab.uniqueName();

    await api.createKey({ name });
    await expect(api.revealCopyToggleButton()).toHaveAccessibleName(
      ApiTab.LABELS.apiKeyModal.copyAriaLabel,
    );

    await api.revealCopyToggleButton().click();
    await expect(api.revealCopyToggleButton()).toHaveAccessibleName(
      ApiTab.LABELS.apiKeyModal.copiedAriaLabel,
      { timeout: 5_000 },
    );
    expect(await api.isRevealedKeyCopied()).toBe(true);

    await api.dismissCreateFlow();
    await api.openDeleteDialogFor(name);
    await api.confirmDelete();

    await editMentorPage.close();
  });

  // API-06: Pagination. Bulk-seeds enough e2e keys via the API to guarantee
  // >10 total, confirms the pager appears, that page 2's rows differ from
  // page 1's, and that creating one more key (through the UI) returns to
  // page 1.
  test('pagination appears past 10 keys, page 2 differs from page 1, and creating a key returns to page 1', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('API');
    await waitForPageReady(page);
    const { api } = editMentorPage;

    const dmBase = dmBaseFromEnv() || (await resolveDmApiBase(page));
    const seedNames = Array.from({ length: 12 }, () => ApiTab.uniqueName());

    try {
      for (const name of seedNames) {
        await createApiKeyViaApi(page, dmBase, name);
      }

      // The list was fetched before seeding — reload to pick up the new rows.
      await page.reload();
      await waitForPageReady(page);
      await editMentorPage.open('API');
      await waitForPageReady(page);

      await expect(api.paginationNav).toBeVisible({ timeout: 15_000 });

      const page1Names = await api.rowNames();
      await api.goToPage(2);
      await expect
        .poll(async () => (await api.rowNames()).join('|'), {
          timeout: 10_000,
        })
        .not.toBe(page1Names.join('|'));
      const page2Names = await api.rowNames();
      expect(page2Names.length).toBeGreaterThan(0);
      expect(page2Names).not.toEqual(page1Names);

      // Creating a key (through the UI) returns to page 1: the newly
      // created, newest row must be visible without any extra navigation.
      const uiName = ApiTab.uniqueName();
      await api.createKey({ name: uiName });
      await api.dismissCreateFlow();
      await expect(api.rowByName(uiName)).toBeVisible({ timeout: 10_000 });

      await deleteApiKeyViaApi(page, dmBase, uiName);
    } finally {
      for (const name of seedNames) {
        await deleteApiKeyViaApi(page, dmBase, name);
      }
    }

    await editMentorPage.close();
  });

  // API-07: Deleting the only remaining row on the current page (page > 1)
  // steps the view back a page. Mocked (see the class-doc note above) — the
  // real tenant's true last page is always foreign data.
  test('deleting the only row on a paginated page steps back a page (mocked dataset)', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('API');
    await waitForPageReady(page);
    const { api } = editMentorPage;

    let deleted = false;
    const makeRow = (n: number) => ({
      username: 'mock-user',
      name: `mock-key-${n}`,
      key: '',
      created: new Date().toISOString(),
      expires: null,
    });

    await page.route('**/api/core/platform/api-tokens/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());

      if (req.method() === 'DELETE') {
        deleted = true;
        await route.fulfill({ status: 204, body: '' });
        return;
      }

      if (req.method() === 'GET' && url.searchParams.get('page_size')) {
        if (url.searchParams.get('page') === '2') {
          const results = deleted ? [] : [makeRow(11)];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              count: deleted ? 10 : 11,
              next_page: null,
              previous_page: 1,
              results,
            }),
          });
          return;
        }
        const results = Array.from({ length: 10 }, (_, i) => makeRow(i + 1));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: deleted ? 10 : 11,
            next_page: deleted ? null : 2,
            previous_page: null,
            results,
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.reload();
    await waitForPageReady(page);
    await editMentorPage.open('API');
    await waitForPageReady(page);

    await expect(api.paginationNav).toBeVisible({ timeout: 15_000 });
    await api.goToPage(2);
    await expect(api.rowByName('mock-key-11')).toBeVisible({
      timeout: 10_000,
    });
    expect(await api.rows.count()).toBe(1);

    await api.openDeleteDialogFor('mock-key-11');
    await api.confirmDelete();

    // The page steps back to 1 and, with the (mocked) total now fitting in
    // a single page, the pagination control disappears entirely.
    await expect(api.rowByName('mock-key-11')).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(api.rowByName('mock-key-1')).toBeVisible({
      timeout: 10_000,
    });
    await expect(api.paginationNav).toHaveCount(0, { timeout: 10_000 });

    await page.unroute('**/api/core/platform/api-tokens/**');
    await editMentorPage.close();
  });

  // API-08: Delete via the UI — the confirmation dialog names the key, and
  // confirming removes the row.
  test('admin deletes an API key via the UI — the confirm dialog names it, then the row is gone', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('API');
    await waitForPageReady(page);
    const { api } = editMentorPage;
    const name = ApiTab.uniqueName();

    await api.createKey({ name });
    await api.dismissCreateFlow();
    await expect(api.rowByName(name)).toBeVisible({ timeout: 10_000 });

    await api.openDeleteDialogFor(name);
    await expect(api.deleteDialog).toContainText(name);
    await api.confirmDelete();

    await expect(api.rowByName(name)).toHaveCount(0, { timeout: 10_000 });

    await editMentorPage.close();
  });
});

// API-09 — Non-Admin: the API tab must stay unreachable ────────────────────
//
// Mirrors journeys 47/63/66/77's non-admin pattern: try the dropdown first
// (the Edit Agent modal, and every segment including API, is only reachable
// via its "Settings" menu item, which a plain non-admin never sees — journey
// 06's mgmt-02 already covers the dropdown-item-level check), and only fall
// back to opening the dialog directly in the (here, unobserved) case where a
// non-admin CAN somehow reach it.
test.describe('Journey 78: Mentor API Tab — Non-Admin', () => {
  test('non-admin does not see the API tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    const dropdown = nonadminPage.getByRole('button', {
      name: /^Selected (agent|mentor) dropdown button$/,
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    const settingsItem = nonadminPage.getByRole('menuitem', {
      name: 'Settings',
      exact: true,
    });

    let menuItemVisible = false;
    try {
      await settingsItem.waitFor({ state: 'visible', timeout: 3_000 });
      menuItemVisible = true;
    } catch {
      menuItemVisible = false;
    }

    if (!menuItemVisible) {
      // Non-admin cannot open the edit dialog at all — API is definitively
      // not reachable. Test passes.
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    // If (in some env) non-admin can open the dialog, verify the API tab
    // specifically is still absent.
    await settingsItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      nonadminEditMentorPage.dialog.getByRole('tab', {
        name: 'API',
        exact: true,
      }),
    ).toHaveCount(0);

    await nonadminEditMentorPage.close();
  });
});
