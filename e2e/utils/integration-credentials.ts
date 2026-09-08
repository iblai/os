import type { Page } from '@playwright/test';

/** Credential names the Add Resources modal looks up, one per cloud provider. */
export type CloudProviderCredential = 'drive' | 'onedrive' | 'dropbox';

const INTEGRATION_CREDENTIAL_PATH_RE = /\/integration-credential\/?$/;

/**
 * Observes the credential lookups the Add Resources modal performs on mount —
 * `GET .../orgs/<org>/integration-credential/?name=<provider>` — and reports
 * whether the tenant actually has a credential for a given provider.
 *
 * ── Why a spec needs this ────────────────────────────────────────────────
 * The cloud picker buttons only do anything when the tenant has OAuth
 * credentials for that provider. Without them the app now disables the
 * button and says so; with them, clicking opens the provider's popup. Which
 * of those two is correct is a property of the TENANT the suite happens to
 * run against, not of the code under test:
 *
 *   - the tenant these tests were written against has all three configured
 *   - `spa-tests-chrome-two` (stg1/stg2 CI) has none — every lookup returns
 *     an empty array
 *
 * A spec that assumes either one fails on half the environments for reasons
 * that have nothing to do with a regression. So journey 74 reads the live
 * answer here and asserts the branch that answer selects — the same approach
 * journey 72 takes for tenant metadata.
 *
 * ── Never skips ──────────────────────────────────────────────────────────
 * If the lookup is never observed this THROWS rather than assuming a default.
 * The modal issues it unconditionally on mount, so not seeing it means the
 * modal did not mount or the endpoint moved — both real failures.
 *
 * Install this BEFORE the Add Resources modal opens; the returned reader can
 * then be awaited at any later point.
 */
export function observeIntegrationCredentials(
  page: Page,
): (name: CloudProviderCredential, timeout?: number) => Promise<boolean> {
  const configured = new Map<string, boolean>();

  page.on('response', async (response) => {
    if (response.request().method() !== 'GET' || !response.ok()) return;
    let url: URL;
    try {
      url = new URL(response.url());
    } catch {
      return;
    }
    if (!INTEGRATION_CREDENTIAL_PATH_RE.test(url.pathname)) return;

    const name = url.searchParams.get('name');
    if (!name) return;

    try {
      const body = (await response.json()) as unknown;
      configured.set(name, Array.isArray(body) && body.length > 0);
    } catch {
      // A non-JSON body is not a credential answer; leave the name unset so
      // the reader keeps waiting for a real one rather than guessing.
    }
  });

  return async (name, timeout = 20_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const seen = configured.get(name);
      if (seen !== undefined) return seen;
      await page.waitForTimeout(250);
    }
    throw new Error(
      `Never observed the '${name}' integration-credential GET that the Add ` +
        'Resources modal fires on mount ' +
        '(.../orgs/<org>/integration-credential/?name=' +
        `${name}). This must FAIL rather than assume a default — the modal ` +
        'issues it unconditionally, so its absence means the modal did not ' +
        'mount or the endpoint moved.',
    );
  };
}
