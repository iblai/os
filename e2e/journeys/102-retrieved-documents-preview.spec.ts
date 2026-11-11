import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 102 — Retrieved Documents previews (iblai/iblai-platform#2855).
 *
 * After an answer the chat lists the sources it used under "Retrieved
 * Documents"; a row's preview toggle opens them in a dialog. The sources come
 * from `GET **\/clean-vector-results/**`, which the backend may answer with
 * nothing for a throwaway agent, so each test answers it with its own list.
 *
 * - A dataset file is served from a DM media link that 302s to an S3 presigned
 *   URL, and CSP checks every redirect hop, so the OS `frame-src` must allow
 *   `https://*.s3.amazonaws.com` (middleware.ts). The browser applies CSP
 *   before the request leaves, so test 1 frames a stubbed bucket URL: a real
 *   upload would wait on the backend's training queue.
 * - A plain web page is never framed (sites refuse it): the preview offers an
 *   "Open Page" link instead.
 * - A YouTube link is framed as a `youtube-nocookie.com/embed` player with
 *   `strict-origin-when-cross-origin` (no-referrer gave YouTube "Error 153").
 */

const QUESTION = 'What do my documents say about object-oriented programming?';
const SNIPPET = 'Retrieved passage used to answer the question.';
const BUCKET_FILE =
  'https://e2e-retrieved-documents.s3.amazonaws.com/private/mentor-documents/notes.txt';
const BUCKET_TEXT = 'Object-oriented programming groups data and behaviour.';

test.describe('Journey 102: Retrieved Documents Preview', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    await waitForAdmin(page);
  });

  test('rdp-01: admin previews a dataset file stored in S3 and the browser lets the frame load it', async ({
    page,
    chatPage,
    createMentorPage,
  }) => {
    test.setTimeout(240_000);
    await createMentorPage.openAndCreate();
    let bucketHit = false;
    await page.route(`${BUCKET_FILE}*`, (route) => {
      bucketHit = true;
      return route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: BUCKET_TEXT,
      });
    });
    await chatPage.mockRetrievedDocuments([
      {
        title: 'Dataset notes',
        source: BUCKET_FILE,
        score: 0.9,
        snippet: SNIPPET,
      },
    ]);
    await chatPage.sendMessage(QUESTION);
    await expect(chatPage.retrievedDocumentsHeading).toBeVisible({
      timeout: 120_000,
    });

    await page.evaluate(() => {
      const w = window as unknown as { __cspFrameViolations: string[] };
      w.__cspFrameViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        if (e.effectiveDirective.startsWith('frame-src')) {
          w.__cspFrameViolations.push(e.blockedURI);
        }
      });
    });

    await chatPage.openRetrievedDocumentPreview('Dataset notes');
    const frame = chatPage.retrievedDocumentPreview.locator('iframe');
    await expect(frame).toHaveAttribute('src', BUCKET_FILE);
    await expect(
      chatPage.retrievedDocumentPreview
        .frameLocator('iframe')
        .getByText(BUCKET_TEXT),
    ).toBeVisible({ timeout: 15_000 });
    expect(bucketHit).toBe(true);
    const violations = await page.evaluate(
      () =>
        (window as unknown as { __cspFrameViolations: string[] })
          .__cspFrameViolations,
    );
    expect(violations).toEqual([]);
  });

  test('rdp-02: admin previews a web page source and gets an Open Page link instead of a frame', async ({
    page,
    chatPage,
    createMentorPage,
  }) => {
    test.setTimeout(240_000);
    await createMentorPage.openAndCreate();
    const url = 'https://www.ietf.org/rfc/rfc2119.html';
    await chatPage.mockRetrievedDocuments([
      { title: 'Web page source', source: url, score: 0.5, snippet: SNIPPET },
    ]);
    await chatPage.sendMessage(QUESTION);
    await expect(chatPage.retrievedDocumentsHeading).toBeVisible({
      timeout: 120_000,
    });
    await waitForPageReady(page);

    const row = chatPage.retrievedDocumentRow('Web page source');
    const link = row.getByTestId('retrieved-document-open-page');
    await expect(link).toBeVisible();
    // The link carries a text fragment that highlights the passage.
    await expect(link).toHaveAttribute(
      'href',
      new RegExp(`^${url.replace(/[.?]/g, '\\$&')}`),
    );
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
    await expect(
      row.getByTestId('retrieved-document-preview-toggle'),
    ).toHaveCount(0);
  });

  test('rdp-03: admin previews a YouTube source and gets a nocookie embed frame with a strict-origin-when-cross-origin referrer policy', async ({
    page,
    chatPage,
    createMentorPage,
  }) => {
    test.setTimeout(240_000);
    await createMentorPage.openAndCreate();
    await chatPage.mockRetrievedDocuments([
      {
        title: 'YouTube source',
        source: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        score: 0.5,
        snippet: SNIPPET,
      },
    ]);
    await chatPage.sendMessage(QUESTION);
    await expect(chatPage.retrievedDocumentsHeading).toBeVisible({
      timeout: 120_000,
    });
    await waitForPageReady(page);

    await chatPage.openRetrievedDocumentPreview('YouTube source');
    const frame = chatPage.retrievedDocumentPreview.locator('iframe');
    await expect(frame).toHaveAttribute(
      'src',
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
    );
    await expect(frame).toHaveAttribute(
      'referrerpolicy',
      'strict-origin-when-cross-origin',
    );
    await expect(
      chatPage.retrievedDocumentPreview.getByTestId(
        'retrieved-document-open-page',
      ),
    ).toHaveCount(0);
  });
});
