import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import path from 'path';
import fs from 'fs';

class VideoReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    const videoAttachment = result.attachments.find(
      (a) => a.name === 'video' && a.path,
    );
    if (!videoAttachment?.path) return;

    const specName = path.basename(test.location.file, '.spec.ts');
    const testTitle = test.title.replace(/[^a-zA-Z0-9-_]/g, '_');
    const ext = path.extname(videoAttachment.path);
    const videoDir = path.join(__dirname, 'playwright-report', 'videos');

    fs.mkdirSync(videoDir, { recursive: true });
    fs.copyFileSync(
      videoAttachment.path,
      path.join(videoDir, `${specName}-${testTitle}${ext}`),
    );
  }
}

export default VideoReporter;
