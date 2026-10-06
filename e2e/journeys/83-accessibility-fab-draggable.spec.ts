import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { AccessibilityFabPage } from '../page-objects/accessibility-fab.page';

/**
 * Journey 83: Draggable accessibility button (issue #2611)
 *
 * The floating accessibility button is the SDK's `AccessibilityFab`
 * (`@iblai/iblai-js/web-containers/next`) behind OS's thin wrapper
 * (`accessibility-fab/index.tsx`, gated on tenant `accessibility_menu`, hidden
 * on analytics + embed). The user can drag it (mouse + touch), nudge it with
 * the arrow keys, send it to a corner from the menu, and reset it; it snaps to
 * the nearest edge and the spot persists in localStorage
 * (`accessibility-fab-position:v2` => `{side, bottom}`).
 *
 * The tenant-metadata GET is route-mocked to force `accessibility_menu: true`
 * so the button is deterministic on any tenant. `reducedMotion: 'reduce'` makes
 * the edge snap instant for position assertions; one checkpoint (fab-05) runs
 * with normal motion to prove the overshoot easing is applied after release and
 * absent mid-drag. Touch drags go through CDP `Input.dispatchTouchEvent`
 * (Playwright's touchscreen only taps), so they run in Chromium only.
 */

const EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

async function setup(page: import('@playwright/test').Page) {
  const fab = new AccessibilityFabPage(page);
  await fab.enableAccessibilityMenu();
  await navigateToMentorApp(page);
  await waitForPageReady(page);
  await fab.expectVisible();
  return fab;
}

test.describe('Journey 83: Draggable accessibility button — desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('user clicks the accessibility button to open the menu, a drag does not open it, and a click after a drag does', async ({
    page,
  }) => {
    const fab = await setup(page);

    await fab.button.click();
    await expect(fab.menuHeading).toBeVisible();
    await fab.closeMenu();

    await fab.mouseDragBy(-40, -40);
    await expect(fab.menuHeading).toBeHidden();

    await fab.button.click();
    await expect(fab.menuHeading).toBeVisible();
  });

  test('user drags the button left of centre and it snaps to the left edge, then right of centre to the right edge, keeping its height, persisted across reload', async ({
    page,
  }) => {
    const fab = await setup(page);
    const vp = await fab.viewport();

    await fab.mouseDragTo(vp.width * 0.25, 300);
    await expect.poll(() => fab.stored().then((s) => s?.side)).toBe('left');
    let box = await fab.waitForSettled();
    expect(box.x).toBeCloseTo(8, 0);
    const centreY = box.y + box.height / 2;
    expect(Math.abs(centreY - 300)).toBeLessThanOrEqual(2);

    await fab.mouseDragTo(vp.width * 0.75, 300);
    await expect.poll(() => fab.stored().then((s) => s?.side)).toBe('right');
    box = await fab.waitForSettled();
    expect(box.x + box.width).toBeCloseTo(vp.width - 8, 0);
    expect(Math.abs(box.y + box.height / 2 - 300)).toBeLessThanOrEqual(2);

    await fab.mouseDragTo(vp.width * 0.2, 250);
    await expect.poll(() => fab.stored().then((s) => s?.side)).toBe('left');
    const before = await fab.waitForSettled();
    const storedBefore = await fab.stored();

    await page.reload();
    await waitForPageReady(page);
    await fab.expectVisible();
    await expect
      .poll(async () => (await fab.waitForSettled()).x)
      .toBeCloseTo(before.x, 0);
    const after = await fab.box();
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(await fab.stored()).toEqual(storedBefore);
  });

  test('user drags the button and no native drag events fire and the file-drop overlay never appears', async ({
    page,
  }) => {
    const fab = await setup(page);
    await fab.installDragEventCounter();
    const vp = await fab.viewport();

    const from = await fab.centre();
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const stops = Math.ceil((from.x - vp.width * 0.3) / 8);
    for (let i = 1; i <= stops; i++) {
      await page.mouse.move(from.x - 8 * i, from.y - i);
      await expect(fab.fileDropOverlay).toBeHidden({ timeout: 500 });
    }
    await page.mouse.up();

    expect(await fab.dragEvents()).toEqual([]);
    await expect(fab.fileDropOverlay).toBeHidden();
    await expect.poll(() => fab.stored().then((s) => s?.side)).toBe('left');
  });

  test('user focuses the button and moves it with the arrow keys and hears the new position announced', async ({
    page,
  }) => {
    const fab = await setup(page);
    await fab.button.focus();

    // First move re-anchors from the default offset (the default class's margin drops away).
    await page.keyboard.press('ArrowUp');
    await fab.waitForSettled();
    const base = await fab.bottomOffset();

    await page.keyboard.press('ArrowUp');
    await expect.poll(() => fab.bottomOffset()).toBe(base + 16);
    await page.keyboard.press('Shift+ArrowUp');
    await expect.poll(() => fab.bottomOffset()).toBe(base + 16 + 64);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => fab.bottomOffset()).toBe(base + 64);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(() => fab.bottomOffset()).toBe(base);

    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => fab.side()).toBe('left');
    const stored = await fab.stored();
    expect(stored?.side).toBe('left');
    await expect(fab.liveRegion).toHaveText(
      `Accessibility button moved to the left edge, ${Math.round(stored!.bottom)} pixels from the bottom.`,
    );

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => fab.side()).toBe('right');
    await expect(fab.liveRegion).toContainText('moved to the right edge');
  });

  test('user releases a drag with normal motion and the snap eases with an overshoot curve that is absent mid-drag', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const fab = await setup(page);
    const vp = await fab.viewport();
    const from = await fab.centre();

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(vp.width * 0.3, 300, {
      steps: fab.stepsFor(from, vp.width * 0.3, 300),
    });
    expect(await fab.inlineStyle('transition')).toBe('');
    await page.mouse.up();

    await expect.poll(() => fab.inlineStyle('transition')).toContain(EASING);
  });

  test('user shrinks the viewport and the button stays on screen on its side, and growing back restores it', async ({
    page,
  }) => {
    const fab = await setup(page);
    await fab.seedStored({ side: 'left', bottom: 500 });
    await page.reload();
    await waitForPageReady(page);
    await fab.expectVisible();
    await expect.poll(() => fab.side()).toBe('left');

    await page.setViewportSize({ width: 500, height: 400 });
    await expect
      .poll(async () => (await fab.bottomOffset()) <= 400 - 56 - 8 + 1)
      .toBe(true);
    await fab.expectOnScreen();
    expect(await fab.side()).toBe('left');

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(() => fab.bottomOffset()).toBe(500);
    expect(await fab.side()).toBe('left');
    await fab.expectOnScreen();
  });

  test('user loads the page with an off-screen stored position and the button is pulled back on screen', async ({
    page,
  }) => {
    const fab = await setup(page);
    await fab.seedStored({ side: 'left', bottom: 9000 });
    await page.reload();
    await waitForPageReady(page);
    await fab.expectVisible();
    await fab.expectOnScreen();
    expect(await fab.side()).toBe('left');
  });

  test('user moves the button to each corner from the menu', async ({
    page,
  }) => {
    const fab = await setup(page);
    const vp = await fab.viewport();
    await fab.openMenu();

    const margin = 8;
    for (const [corner, left, top] of [
      ['top left', true, true],
      ['top right', false, true],
      ['bottom left', true, false],
      ['bottom right', false, false],
    ] as const) {
      await fab.cornerButton(corner).click();
      const box = await fab.waitForSettled();
      if (left) expect(box.x).toBeCloseTo(margin, 0);
      else expect(box.x + box.width).toBeCloseTo(vp.width - margin, 0);
      if (top) expect(box.y).toBeCloseTo(margin, 0);
      else expect(box.y + box.height).toBeCloseTo(vp.height - margin, 0);
      await expect(fab.liveRegion).toContainText(
        `moved to the ${left ? 'left' : 'right'} edge`,
      );
    }
  });

  test('user sees Reset Button Position only after moving the button and it restores the default spot', async ({
    page,
  }) => {
    const fab = await setup(page);
    const initial = await fab.box();
    await fab.openMenu();
    await expect(fab.resetPositionButton).toBeHidden();

    await fab.cornerButton('top left').click();
    await expect(fab.resetPositionButton).toBeVisible();
    expect((await fab.stored())?.side).toBe('left');

    await fab.resetPositionButton.click();
    await expect(fab.resetPositionButton).toBeHidden();
    expect(await fab.stored()).toBeNull();
    expect(await fab.inlineStyle('right')).toBe('');
    expect(await fab.inlineStyle('bottom')).toBe('');
    const restored = await fab.waitForSettled();
    expect(restored.x).toBeCloseTo(initial.x, 0);
    expect(restored.y).toBeCloseTo(initial.y, 0);
  });

  test('user clicks Reset All Accessibility Settings and the button position is cleared too', async ({
    page,
  }) => {
    const fab = await setup(page);
    await fab.openMenu();
    await fab.cornerButton('bottom left').click();
    await expect.poll(() => fab.stored()).not.toBeNull();

    await fab.resetAllButton.click();
    expect(await fab.stored()).toBeNull();
    expect(await fab.inlineStyle('right')).toBe('');
    await expect(fab.resetPositionButton).toBeHidden();
  });
});

test.describe('Journey 83: Draggable accessibility button — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page, browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'Touch drag uses CDP Input.dispatchTouchEvent (Chromium only)',
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('mobile user taps the button to open the menu and a touch drag does not open it', async ({
    page,
  }) => {
    const fab = await setup(page);

    await fab.button.tap();
    await expect(fab.menuHeading).toBeVisible();
    await fab.closeMenu();

    const c = await fab.centre();
    await fab.touchDragTo(c.x - 60, c.y - 60);
    await expect(fab.menuHeading).toBeHidden();
    await fab.button.tap();
    await expect(fab.menuHeading).toBeVisible();
  });

  test('mobile user touch-drags the button to the left edge and it persists across reload', async ({
    page,
  }) => {
    const fab = await setup(page);
    const vp = await fab.viewport();

    await fab.touchDragTo(vp.width * 0.2, 400);
    await expect.poll(() => fab.stored().then((s) => s?.side)).toBe('left');
    const box = await fab.waitForSettled();
    expect(box.x).toBeCloseTo(8, 0);
    expect(Math.abs(box.y + box.height / 2 - 400)).toBeLessThanOrEqual(2);

    await page.reload();
    await waitForPageReady(page);
    await fab.expectVisible();
    await expect.poll(() => fab.side()).toBe('left');

    await fab.touchDragTo(vp.width * 0.8, 400);
    await expect.poll(() => fab.stored().then((s) => s?.side)).toBe('right');
  });

  test('mobile user sees the default button position not overlap the Send button', async ({
    page,
    chatPage,
  }) => {
    const fab = await setup(page);
    await expect(chatPage.sendButton).toBeVisible();

    const [fabBox, sendBox] = await Promise.all([
      fab.box(),
      chatPage.sendButton.boundingBox(),
    ]);
    expect(sendBox).not.toBeNull();
    const overlaps =
      fabBox.x < sendBox!.x + sendBox!.width &&
      fabBox.x + fabBox.width > sendBox!.x &&
      fabBox.y < sendBox!.y + sendBox!.height &&
      fabBox.y + fabBox.height > sendBox!.y;
    expect(overlaps).toBe(false);
  });
});
