import test, { expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../../utils';
import { testPageGraphs } from './utils';
import { navigateToMentorApp } from '../profile/helpers';
import { safeWaitForURL } from '@iblai/iblai-js/playwright';

const pageURL = MENTOR_NEXTJS_HOST;

const OVERVIEW_MINI_CARDS = [
  'Messages mini card',
  'Active Users mini card',
  'Topics mini card',
  'Conversations mini card',
];

const OVERVIEW_PAGE_GRAPHS = [
  'Sessions chart card',
  'Topics chart card',
  'Active Users chart card',
];

const USERS_PAGE_MINI_CARDS = [
  'Users logged in right now mini card',
  'Users logged in past 30 days mini card',
  'Total registered users mini card',
];

const USERS_PAGE_GRAPHS = [
  'Active Users chart card',
  'Access Times chart card',
  'User Details chart card',
];

const TOPICS_PAGE_MINI_CARDS = [
  'Topics mini card',
  'Conversations mini card',
  'Messages mini card',
];

const TOPICS_PAGE_GRAPHS = [
  'Conversations chart card',
  'Average Rating chart card',
  'Topics Details chart card',
];

const TRANSCRIPTS_PAGE_MINI_CARDS = [
  'Average number of messages per conversation mini card',
  'Average cost per conversation mini card',
  'Average rating mini card',
];

const FINANCIAL_PAGE_MINI_CARDS = [
  'Weekly Costs mini card',
  'Monthly Costs mini card',
  'Total Costs mini card',
];

const FINANCIAL_PAGE_GRAPHS = [
  'Cost per Day chart card',
  'Cost by Provider chart card',
  'Cost by LLM chart card',
  'Cost per User chart card',
];

const TIME_FILTERS = ['Today', '7D', '30D', '90D'];

const DEFAULT_TIME_FILTER = '30D';

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    // Wait for analytics button to be visible indicating page is ready
    await expect(page.getByRole('button', { name: 'Analytics' })).toBeVisible({
      timeout: 60_000,
    });
  });

  test('should load analytics overview page', async ({ page }) => {
    if (await page.getByRole('button', { name: 'Analytics' }).isVisible()) {
      await page.getByRole('button', { name: 'Analytics' }).click();

      // Wait for URL to change to analytics page
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      // expect all graphs to be visible
      for (const miniCard of OVERVIEW_MINI_CARDS) {
        if (await page.getByLabel(`${miniCard} loading`).isVisible()) {
          await page
            .getByLabel(`${miniCard} loading`)
            .waitFor({ state: 'hidden', timeout: 120_000 });
        }
        await expect(page.getByLabel(`${miniCard} value`)).toBeVisible({
          timeout: 120000,
        });
      }
      await testPageGraphs(
        page,
        OVERVIEW_PAGE_GRAPHS,
        TIME_FILTERS,
        DEFAULT_TIME_FILTER
      );
    } else {
      test.skip();
    }
  });

  test('should load analytics users page', async ({ page }) => {
    if (await page.getByRole('button', { name: 'Analytics' }).isVisible()) {
      await page.getByRole('button', { name: 'Analytics' }).click();

      // Wait for URL to change to analytics page
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await page.getByRole('tab', { name: 'Users' }).click({ timeout: 15_000 });

      // Wait for Users tab content to load
      await expect(
        page.getByLabel(USERS_PAGE_MINI_CARDS[0], { exact: true })
      ).toBeVisible({ timeout: 60_000 });

      for (const miniCard of USERS_PAGE_MINI_CARDS) {
        if (await page.getByLabel(`${miniCard} loading`).isVisible()) {
          await page
            .getByLabel(`${miniCard} loading`)
            .waitFor({ state: 'hidden', timeout: 120_000 });
        }
        await expect(page.getByLabel(miniCard, { exact: true })).toBeVisible({
          timeout: 60000,
        });
        await expect(page.getByLabel(`${miniCard} value`)).toBeVisible();
      }
      await testPageGraphs(
        page,
        USERS_PAGE_GRAPHS,
        TIME_FILTERS,
        DEFAULT_TIME_FILTER
      );
    }
  });

  test('should load analytics topics page', async ({ page }) => {
    if (await page.getByRole('button', { name: 'Analytics' }).isVisible()) {
      await page.getByRole('button', { name: 'Analytics' }).click();

      // Wait for URL to change to analytics page
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await page.getByRole('tab', { name: 'Topics' }).click();

      // Wait for Topics tab content to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/topics'), {
        timeout: 60_000,
      });

      for (const miniCard of TOPICS_PAGE_MINI_CARDS) {
        if (await page.getByLabel(`${miniCard} loading`).isVisible()) {
          await page
            .getByLabel(`${miniCard} loading`)
            .waitFor({ state: 'hidden', timeout: 120_000 });
        }
        await expect(page.getByLabel(miniCard, { exact: true })).toBeVisible({
          timeout: 60000,
        });
        await expect(page.getByLabel(`${miniCard} value`)).toBeVisible();
      }
      await testPageGraphs(
        page,
        TOPICS_PAGE_GRAPHS,
        TIME_FILTERS,
        DEFAULT_TIME_FILTER
      );
    }
  });

  test('should load analytics transcripts page', async ({ page }) => {
    if (await page.getByRole('button', { name: 'Analytics' }).isVisible()) {
      await page.getByRole('button', { name: 'Analytics' }).click();

      // Wait for URL to change to analytics page
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await page.getByRole('tab', { name: 'Transcripts' }).click();

      // Wait for Transcripts tab content to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/transcripts'), {
        timeout: 60_000,
      });

      for (const miniCard of TRANSCRIPTS_PAGE_MINI_CARDS) {
        if (await page.getByLabel(`${miniCard} loading`).isVisible()) {
          await page
            .getByLabel(`${miniCard} loading`)
            .waitFor({ state: 'hidden', timeout: 120_000 });
        }
        await expect(page.getByLabel(miniCard, { exact: true })).toBeVisible({
          timeout: 60000,
        });
        await expect(page.getByLabel(`${miniCard} value`)).toBeVisible();
      }
    }
  });

  test('should load analytics financial page', async ({ page }) => {
    if (await page.getByRole('button', { name: 'Analytics' }).isVisible()) {
      await page.getByRole('button', { name: 'Analytics' }).click();

      // Wait for URL to change to analytics page
      await safeWaitForURL(page, (url) => url.href.endsWith('/analytics'), {
        timeout: 60_000,
      });

      await page.getByRole('tab', { name: 'Financial' }).click();

      // Wait for Financial tab content to load
      await safeWaitForURL(page, (url) => url.href.endsWith('/financial'), {
        timeout: 60_000,
      });

      for (const miniCard of FINANCIAL_PAGE_MINI_CARDS) {
        if (await page.getByLabel(`${miniCard} loading`).isVisible()) {
          await page
            .getByLabel(`${miniCard} loading`)
            .waitFor({ state: 'hidden', timeout: 120_000 });
        }
        await expect(page.getByLabel(miniCard, { exact: true })).toBeVisible({
          timeout: 60000,
        });
        await expect(page.getByLabel(`${miniCard} value`)).toBeVisible();
      }
      await testPageGraphs(
        page,
        FINANCIAL_PAGE_GRAPHS,
        TIME_FILTERS,
        DEFAULT_TIME_FILTER
      );
    }
  });
});
