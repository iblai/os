import { test, devices } from '@playwright/test';
import { onTrainDataAndDelete, uploadDataOnTheDataSet } from '../utils';
import { navigateToMentorApp } from '../profile/helpers';

test.use(devices['Pixel 5']);
test.describe('dataset', () => {
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('upload data on the dataset', async ({ page }) => {
    await uploadDataOnTheDataSet(page);
  });

  test('user should be able to untrain and delete all documents', async ({
    page,
  }) => {
    // Check admin status
    await onTrainDataAndDelete(page);
  });
});
