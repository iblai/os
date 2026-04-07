import { BrowserContext, Page, expect } from '@playwright/test';

/**
 * Opens the mailnesia mailbox in a new page and polls for an email
 * containing a link with the given text.
 *
 * @returns The page opened on the mailnesia mailbox (caller should close it).
 */
export async function waitForMailnesiaEmail(
  context: BrowserContext,
  mailboxUrl: string,
  linkText: string,
  opts?: { maxRetries?: number; intervalMs?: number },
): Promise<Page> {
  const maxRetries = opts?.maxRetries ?? 12;
  const intervalMs = opts?.intervalMs ?? 5_000;

  const emailPage = await context.newPage();
  let found = false;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await emailPage.goto(mailboxUrl, { waitUntil: 'domcontentloaded' });
    try {
      await expect(emailPage.getByRole('link', { name: linkText })).toBeVisible(
        { timeout: 2_000 },
      );
      found = true;
      break;
    } catch {
      if (attempt + 1 >= maxRetries) {
        throw new Error(
          `Mailnesia email with link "${linkText}" not found after ${(maxRetries * intervalMs) / 1000}s`,
        );
      }
      await emailPage.waitForTimeout(intervalMs);
    }
  }

  if (!found) {
    throw new Error(`Mailnesia email with link "${linkText}" not found`);
  }

  return emailPage;
}

/**
 * Builds the mailnesia mailbox URL from an email address.
 * e.g. "test+123@mailnesia.com" → "https://mailnesia.com/mailbox/test+123"
 */
export function getMailnesiaMailboxUrl(email: string): string {
  const localPart = email.split('@')[0];
  return `https://mailnesia.com/mailbox/${localPart}`;
}
