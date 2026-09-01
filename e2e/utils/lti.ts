import { Page } from '@playwright/test';
import {
  CANVAS_URL,
  CANVAS_EMAIL,
  CANVAS_PASSWORD,
} from '../fixtures/test-data';

const canvasLogin = async (page: Page) => {
  await page.goto(CANVAS_URL);
  await page.fill('input[name="username"]', CANVAS_EMAIL);
  await page.fill('input[name="password"]', CANVAS_PASSWORD);
  await page.click('button[type="submit"]');
};
