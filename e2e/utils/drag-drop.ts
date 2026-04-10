import { Page } from '@playwright/test';

export interface FakeFile {
  name: string;
  type: string;
  content?: string;
}

// H7 fix: use precise drop target matching original's selector
const DROP_TARGET_SELECTOR =
  'main div.relative.flex.h-full.flex-col, [class*="chat-area"], main, body';

/**
 * Dispatches a synthetic drag event (dragover / dragleave / drop) on the chat
 * area. Pass files to include them in the DataTransfer (required for dragover
 * and drop events that check file types).
 */
export async function dispatchDragEvent(
  page: Page,
  eventType: 'dragover' | 'dragleave' | 'drop',
  files: FakeFile[] = [],
): Promise<void> {
  await page.evaluate(
    ({ eventType, files, selector }) => {
      const dt = new DataTransfer();
      for (const f of files) {
        const blob = new File([f.content ?? ''], f.name, { type: f.type });
        dt.items.add(blob);
      }
      // Try selectors in priority order
      const selectors = selector.split(', ');
      let target: Element | null = null;
      for (const s of selectors) {
        target = document.querySelector(s);
        if (target) break;
      }
      if (!target) target = document.body;
      target.dispatchEvent(
        new DragEvent(eventType, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
    },
    { eventType, files, selector: DROP_TARGET_SELECTOR },
  );
}

/**
 * Simulates a file drop on the chat area by dispatching dragover first
 * (to trigger the drop overlay), then drop.
 *
 * H7 fix: Original dispatched dragover first, waited for the overlay, then drop.
 * Without dragover, the app never activates the drop zone and drop events are ignored.
 */
export async function dragAndDropFiles(
  page: Page,
  files: FakeFile[],
): Promise<void> {
  // Dispatch dragover first to activate the drop zone
  await dispatchDragEvent(page, 'dragover', files);
  await page.waitForTimeout(500);
  // Then dispatch the actual drop
  await dispatchDragEvent(page, 'drop', files);
}
