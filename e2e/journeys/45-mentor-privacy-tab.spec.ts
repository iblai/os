import type { Route } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import type { PrivacyActionLabel } from '../page-objects/edit-mentor/privacy.tab';
import { deleteMentorById } from '../utils/mentor-cleanup';
import { generateMentorName } from '../fixtures/test-data';

/**
 * Journey 45 — Mentor Privacy Tab (#2539 Privacy Log, #2095 PHI Filtering).
 *
 * The tab is the SDK's `AgentPrivacyTab`: two accordion cards (PII Filtering,
 * PHI Filtering), each with its own switch, one open at a time; an
 * "Also Filter AI Responses" switch; and a Privacy Log row opening a modal.
 * There is no master toggle and no PII sub-tab any more. Saves are NOT
 * optimistic (PUT + refetch), so the page object waits for each switch to
 * repaint and re-enable.
 *
 * Tests that change settings create their own agent (starting state is
 * deterministic: router off, all filters off) and delete it in `finally`.
 * The Privacy Log test only reads, so it runs on the default agent with the
 * `privacy-flags` endpoint mocked (real tenants rarely have rows).
 */
test.describe('Journey 45: Mentor Privacy Tab', () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Privacy tab requires admin access');
  });

  // PR-01..PR-04: structure and defaults of a fresh agent
  test('admin opens the Privacy tab on a new agent and sees both filters off', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await createMentorPage.openAndCreate(generateMentorName());
    const mentorId = new URL(page.url()).pathname.split('/').filter(Boolean)[2];
    try {
      await editMentorPage.open('Privacy');
      await waitForPageReady(page);
      const privacy = editMentorPage.privacy;
      await privacy.waitUntilReady();

      // PR-01 / PR-02
      await expect(
        editMentorPage.dialog.getByRole('tab', {
          name: 'Privacy',
          exact: true,
        }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(privacy.heading).toBeVisible({ timeout: 10_000 });
      await expect(privacy.description).toBeVisible({ timeout: 5_000 });

      // PR-03: no master toggle / PII sub-tab; filtering content is not
      // wrapped in a sub-tab strip unless Incognito is also readable
      await expect(
        editMentorPage.dialog.getByTestId('privacy-capability-toggle'),
      ).toHaveCount(0);
      await expect(
        editMentorPage.dialog.getByTestId('privacy-sub-tab-pii'),
      ).toHaveCount(0);

      // PR-04: two cards, both off, summaries read "Off."
      for (const kind of ['pii', 'phi'] as const) {
        await expect(privacy.card(kind)).toBeVisible();
        await expect(privacy.toggle(kind)).toHaveAttribute(
          'aria-checked',
          'false',
        );
        await expect(privacy.toggle(kind)).toHaveAttribute('title', 'Off');
        await expect(privacy.summary(kind)).toHaveText('Off.');
      }
      await expect(privacy.toggle('pii')).toHaveAccessibleName('PII Filtering');
      await expect(privacy.toggle('phi')).toHaveAccessibleName('PHI Filtering');

      // Opening a card of an off kind shows only the off hint
      await privacy.expand('phi').click();
      await expect(privacy.expand('phi')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(privacy.offHint('phi')).toBeVisible();
      await expect(privacy.actionSelect('phi')).toHaveCount(0);

      await editMentorPage.close();
    } finally {
      await deleteMentorById(page, mentorId);
    }
  });

  // PR-05..PR-09: PII card — switch, accordion, action, block message, chips
  test('admin turns PII filtering on, configures it, and the setting persists', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await createMentorPage.openAndCreate(generateMentorName());
    const mentorId = new URL(page.url()).pathname.split('/').filter(Boolean)[2];
    try {
      await editMentorPage.open('Privacy');
      await waitForPageReady(page);
      const privacy = editMentorPage.privacy;
      await privacy.waitUntilReady();

      // PR-05: turning the switch on saves and opens the card
      await privacy.setFilterEnabled('pii', true);
      await expect(privacy.expand('pii')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(privacy.summary('pii')).toContainText(/^On\./);
      await expect(privacy.toggle('phi')).toHaveAttribute(
        'aria-checked',
        'false',
      );

      // PR-06: action options order
      const initialAction = (
        (await privacy.actionSelect('pii').textContent()) ?? ''
      ).trim() as PrivacyActionLabel;
      expect(await privacy.openActionOptions('pii')).toEqual([
        'Allow',
        'Redact',
        'Mask',
        'Block',
      ]);
      await privacy.closeActionSelect('pii', initialAction);

      // PR-07: block message only while Block
      await privacy.selectAction('pii', 'Block');
      await expect(privacy.blockMessage('pii')).toBeVisible({
        timeout: 10_000,
      });
      await expect(privacy.blockMessage('pii')).toBeEnabled();
      await expect(privacy.summary('pii')).toContainText('Block');
      await privacy.selectAction('pii', 'Redact');
      await expect(privacy.blockMessage('pii')).toHaveCount(0);

      // PR-08: entity chips flip, summary counts them, hint tracks "none = all"
      await expect(privacy.entitiesHint('pii')).toBeVisible();
      await privacy.setEntitySelected('pii', 'EMAIL_ADDRESS', true);
      await expect(privacy.entitiesHint('pii')).toHaveCount(0);
      await expect(privacy.summary('pii')).toContainText('1 kind selected');
      await privacy.setEntitySelected('pii', 'EMAIL_ADDRESS', false);
      await expect(privacy.entitiesHint('pii')).toBeVisible();
      await privacy.setEntitySelected('pii', 'EMAIL_ADDRESS', true);

      // PR-09: persists across closing and reopening the modal
      await editMentorPage.close();
      await editMentorPage.open('Privacy');
      await waitForPageReady(page);
      await privacy.waitUntilReady();
      await expect(privacy.toggle('pii')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(privacy.summary('pii')).toContainText('Redact');
      await expect(privacy.summary('pii')).toContainText('1 kind selected');

      // Turning the last kind off turns the whole filter off
      await privacy.setFilterEnabled('pii', false);
      await expect(privacy.summary('pii')).toHaveText('Off.');
      await editMentorPage.close();
    } finally {
      await deleteMentorById(page, mentorId);
    }
  });

  // PR-10..PR-13: PHI card, accordion exclusivity, AI-response filter
  test('admin turns PHI filtering on beside PII and filters AI responses', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await createMentorPage.openAndCreate(generateMentorName());
    const mentorId = new URL(page.url()).pathname.split('/').filter(Boolean)[2];
    try {
      await editMentorPage.open('Privacy');
      await waitForPageReady(page);
      const privacy = editMentorPage.privacy;
      await privacy.waitUntilReady();

      // PR-10: PHI exposes 12 entity kinds; none selected means all of them
      await privacy.setFilterEnabled('phi', true);
      await expect(privacy.expand('phi')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(privacy.toggle('pii')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      await expect(privacy.entityChips('phi')).toHaveCount(12);
      await expect(privacy.entitiesHint('phi')).toBeVisible();
      await expect(privacy.summary('phi')).toContainText('all 12 kinds');

      await privacy.selectAction('phi', 'Block');
      await expect(privacy.blockMessage('phi')).toBeVisible({
        timeout: 10_000,
      });
      await privacy.setEntitySelected('phi', 'DISEASE_DISORDER', true);
      await privacy.setEntitySelected('phi', 'MEDICATION', true);
      await expect(privacy.summary('phi')).toContainText('2 kinds selected');
      await expect(privacy.summary('phi')).toContainText('Block');

      // PR-11: one card open at a time; turning PII on opens PII, closes PHI
      await privacy.setFilterEnabled('pii', true);
      await expect(privacy.expand('pii')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(privacy.expand('phi')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await expect(privacy.toggle('phi')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await privacy.expand('phi').click();
      await expect(privacy.expand('phi')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(privacy.expand('pii')).toHaveAttribute(
        'aria-expanded',
        'false',
      );

      // PR-12: "Also Filter AI Responses" switch
      await expect(privacy.outputFilterSwitch).toHaveAccessibleName(
        'Also Filter AI Responses',
      );
      await privacy.setOutputFilterEnabled(true);
      await privacy.setOutputFilterEnabled(false);

      // PR-13: turning one kind off leaves the other on; the last one off
      // switches filtering off entirely
      await privacy.setFilterEnabled('phi', false);
      await expect(privacy.toggle('pii')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(privacy.summary('phi')).toHaveText('Off.');
      await privacy.setFilterEnabled('pii', false);
      await expect(privacy.summary('pii')).toHaveText('Off.');

      await editMentorPage.close();
    } finally {
      await deleteMentorById(page, mentorId);
    }
  });

  // PR-14..PR-16: Privacy Log (read only; endpoint mocked)
  test('admin opens the Privacy Log, filters it, and views a flag detail', async ({
    page,
    editMentorPage,
  }) => {
    const base = {
      platform_key: 'main',
      mentor: 1,
      file_name: '',
      file_content_type: '',
      file_size: null,
      file_reference: '',
      source: 'text_prompt',
      session_id: 'sess-e2e',
      user: 7,
      username: 'jdoe',
      email: 'jdoe@example.com',
      user_full_name: 'Jane Doe',
    };
    const ROWS = [
      {
        ...base,
        id: 101,
        rail: 'pii',
        action_taken: 'redact',
        detected_entities: ['EMAIL_ADDRESS', 'PHONE_NUMBER'],
        date_created: '2026-10-30T14:12:00Z',
      },
      {
        ...base,
        id: 102,
        rail: 'phi',
        action_taken: 'block',
        detected_entities: ['DISEASE_DISORDER', 'MEDICATION'],
        date_created: '2026-10-29T16:20:00Z',
      },
    ];
    await page.route('**/privacy-flags/**', async (route: Route) => {
      const url = new URL(route.request().url());
      const detail = url.pathname.match(/privacy-flags\/(\d+)\/?$/);
      if (detail) {
        return route.fulfill({
          json: ROWS.find((r) => r.id === Number(detail[1])),
        });
      }
      const rail = url.searchParams.get('rail');
      const rows = ROWS.filter((r) => !rail || r.rail === rail);
      return route.fulfill({
        json: { count: rows.length, next: null, previous: null, results: rows },
      });
    });

    await editMentorPage.open('Privacy');
    await waitForPageReady(page);
    const privacy = editMentorPage.privacy;
    await privacy.waitUntilReady();

    // PR-14: admin (with view_privacy_flags) sees the row and button
    await expect(privacy.privacyLogRow).toBeVisible({ timeout: 15_000 });
    await privacy.viewPrivacyLogButton.click();
    await expect(privacy.auditLogModal).toBeVisible({ timeout: 30_000 });
    await expect(
      privacy.auditLogModal.getByTestId('privacy-audit-log-loading'),
    ).toBeHidden({ timeout: 30_000 });
    const rows = privacy.auditLogModal.getByTestId('privacy-audit-log-row');
    await expect(rows).toHaveCount(2);

    // PR-15: rail filter narrows the list
    await privacy.auditLogModal
      .getByTestId('privacy-audit-log-filter-rail')
      .click();
    await page.getByRole('option', { name: 'PHI', exact: true }).click();
    await expect(rows).toHaveCount(1, { timeout: 15_000 });
    await expect(
      rows.first().getByTestId('privacy-audit-log-rail'),
    ).toHaveAttribute('data-rail', 'phi');

    // PR-16: row action opens the flag detail
    await privacy.auditLogModal
      .getByTestId('privacy-audit-log-view')
      .first()
      .click();
    await expect(page.getByTestId('privacy-flag-detail').first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
