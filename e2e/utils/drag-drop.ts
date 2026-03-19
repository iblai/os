import { Page } from '@playwright/test';

export interface FakeFile {
  name: string;
  type: string;
  content?: string;
}

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
    ({ eventType, files }) => {
      const dt = new DataTransfer();
      for (const f of files) {
        const blob = new File([f.content ?? ''], f.name, { type: f.type });
        dt.items.add(blob);
      }
      const target =
        document.querySelector('[class*="chat"]') ??
        document.querySelector('main') ??
        document.body;
      target.dispatchEvent(
        new DragEvent(eventType, { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
    },
    { eventType, files },
  );
}

/**
 * Simulates a file drop on the chat area by dispatching a synthetic `drop`
 * event with a DataTransfer that contains the specified files.
 */
export async function dragAndDropFiles(
  page: Page,
  files: FakeFile[],
): Promise<void> {
  await dispatchDragEvent(page, 'drop', files);
}
