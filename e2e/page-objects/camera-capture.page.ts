import { type Locator, type Page } from '@playwright/test';

/** The composer "+" -> Camera flow (SDK `CameraCaptureDialog`), desktop only. */
export class CameraCapturePage {
  readonly plusButton: Locator;
  readonly cameraMenuItem: Locator;
  readonly dialog: Locator;
  readonly video: Locator;
  readonly captureButton: Locator;
  readonly retakeButton: Locator;
  readonly usePhotoButton: Locator;

  constructor(private readonly page: Page) {
    this.plusButton = page.getByTestId('composer-plus-button');
    this.cameraMenuItem = page.getByRole('menuitem', { name: 'Camera' });
    this.dialog = page.getByRole('dialog');
    this.video = page.getByTestId('camera-video');
    this.captureButton = page.getByRole('button', { name: 'Capture photo' });
    this.retakeButton = page.getByRole('button', { name: 'Retake photo' });
    this.usePhotoButton = page.getByRole('button', { name: 'Use photo' });
  }

  async openFromPlusMenu(): Promise<void> {
    await this.plusButton.click();
    await this.cameraMenuItem.click();
  }

  /** Resolves once the live feed is actually decoding frames. */
  async waitForLiveFeed(): Promise<void> {
    await this.page.waitForFunction(() => {
      const v = document.querySelector<HTMLVideoElement>(
        '[data-testid=camera-video]',
      );
      return !!v && v.videoWidth > 0;
    });
  }

  async bodyPointerEvents(): Promise<string> {
    return this.page.evaluate(
      () => getComputedStyle(document.body).pointerEvents,
    );
  }
}
