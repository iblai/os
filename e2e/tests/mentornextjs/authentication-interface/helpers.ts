import { Page, Locator, expect } from '@playwright/test';
import { navigateToAccountComponent } from '../../shared';

/**
 * Fill the Auth SPA customization form in the dialog.
 */
export async function fillAuthCustomizationForm(
  dialog: Locator,
  data: {
    displayTitle: string;
    title: string;
    description: string;
    logoUrl: string;
    faviconUrl: string;
    displayImageUrl: string;
    displayImageAlt: string;
    privacyPolicyUrl: string;
    termsOfUseUrl: string;
    slidePanelLogoUrl?: string;
    ssoLogin?: boolean;
  }
) {
  // Fill display title
  await dialog
    .getByLabel('Display title for auth page')
    .fill(data.displayTitle);

  // Fill display meta title
  await dialog.getByLabel('Display meta title for auth page').fill(data.title);

  // Fill display description
  await dialog
    .getByLabel('Display description for auth page')
    .fill(data.description);

  // Fill logo URL
  await dialog.getByLabel('Logo URL', { exact: true }).fill(data.logoUrl);

  // Fill favicon URL
  await dialog.getByLabel('Favicon URL').fill(data.faviconUrl);

  // Fill slide panel logo URL if provided
  if (data.slidePanelLogoUrl) {
    await dialog
      .getByLabel('Slide panel logo URL')
      .fill(data.slidePanelLogoUrl);
  }

  // Toggle authorize only password login if provided
  if (data.ssoLogin !== undefined) {
    const switchElement = dialog.getByLabel(
      'Toggle only password login method'
    );
    const isChecked = await switchElement.isChecked();
    if (isChecked) {
      await switchElement.click();
    }
  }

  //Fill privacy policy
  await dialog.getByLabel('Privacy policy URL').fill(data.privacyPolicyUrl);

  //Fill terms of use
  await dialog.getByLabel('Terms of use URL').fill(data.termsOfUseUrl);

  // Delete existing display images
  let deleteDisplayImageButtons = dialog.locator(
    'button[aria-label^="Remove display image"]'
  );
  let count = await deleteDisplayImageButtons.count();

  while (count > 0) {
    await deleteDisplayImageButtons.first().click();
    await dialog.page().waitForTimeout(300);
    deleteDisplayImageButtons = dialog.locator(
      'button[aria-label^="Remove display image"]'
    );
    count = await deleteDisplayImageButtons.count();
  }

  // Add display image
  const addDisplayImageButton = dialog.getByRole('button', {
    name: 'Add display image',
  });
  await expect(addDisplayImageButton).toBeVisible();
  await addDisplayImageButton.click();

  // Fill display image URL and alt text
  await dialog.getByLabel('Image 1 URL').fill(data.displayImageUrl);
  await dialog.getByLabel('Image 1 alt text').fill(data.displayImageAlt);

  // Save form
  const saveButton = dialog.getByRole('button', {
    name: 'Save auth SPA customization',
  });
  await expect(saveButton).not.toBeDisabled();
  await saveButton.click();

  // Wait a short time to ensure the save completes
  await dialog.page().waitForTimeout(5000);

  // Ensure the save button is now disabled
  await expect(saveButton).toBeDisabled();
}

/**
 * Verify that an image is loaded properly with correct src and alt attributes.
 */
export async function verifyImageLoaded(
  page: Page,
  selector: string,
  expectedSrc: string,
  expectedAlt: string
) {
  const image = page.locator(selector);
  await expect(image).toBeVisible();

  // Verify src
  const src = await image.getAttribute('src');
  expect(src).toBe(expectedSrc);

  // Verify alt
  const alt = await image.getAttribute('alt');
  expect(alt).toBe(expectedAlt);

  // Verify image bounding box exists and width/height > 0
  const box = await image.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
}

export async function navigateToTenantSettings(page: Page) {
  const profileBtn = page.locator('nav button[aria-haspopup="menu"]').last();
  const tenantDialog = await navigateToAccountComponent(page, profileBtn);

  const advancedBtn = tenantDialog.getByRole('button', { name: 'Advanced' });
  await advancedBtn.click();

  return tenantDialog;
}

export async function verifyDOMCustomization(
  page: Page,
  authCustomizationData: {
    title: string;
    faviconUrl: string;
    displayTitle: string;
    description: string;
    termsOfUseUrl: string;
    privacyPolicyUrl: string;
    logoUrl: string;
    displayImageUrl: string;
    displayImageAlt: string;
    slidePanelLogoUrl: string;
    ssoLogin: boolean;
  },
  hasCustomHeaderInfos: boolean = false
) {
  // Verify meta title
  await expect(page).toHaveTitle(authCustomizationData.title);

  // Verify favicon
  const favicon = page.locator('link[rel="icon"]');
  await expect(favicon.first()).toHaveAttribute(
    'href',
    authCustomizationData.faviconUrl
  );

  if (!hasCustomHeaderInfos) {
    // Verify heading text
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const headingText = await heading.innerText();
    expect(headingText.trim()).toBe(authCustomizationData.displayTitle);

    // Verify description paragraph
    const paragraph = page.locator('p').first();
    await expect(paragraph).toBeVisible();
    const paragraphText = (await paragraph.innerText()).trim();
    expect(paragraphText).toBe(authCustomizationData.description);
  }

  // verify terms of use
  const termsOFUseLink = page.locator('a', { hasText: 'Terms of Use' });
  await expect(termsOFUseLink).toBeVisible();
  await expect(termsOFUseLink).toHaveAttribute(
    'href',
    authCustomizationData.termsOfUseUrl
  );

  // verify privacy policy
  const privacyLink = page.locator('a', { hasText: 'Privacy Policy' });
  await expect(privacyLink).toBeVisible();
  await expect(privacyLink).toHaveAttribute(
    'href',
    authCustomizationData.privacyPolicyUrl
  );

  // Verify logo image
  await verifyImageLoaded(
    page,
    'img[alt="mentorai Logo"]',
    authCustomizationData.logoUrl,
    'mentorai Logo'
  );

  // Verify display image
  await verifyImageLoaded(
    page,
    `img[alt="${authCustomizationData.displayImageAlt}"]`,
    authCustomizationData.displayImageUrl,
    authCustomizationData.displayImageAlt
  );

  // Verify slide panel logo (only visible on xl screens, check if element exists)
  const slidePanelLogo = page.locator('img[alt="MentorAI Logo"]').filter({
    hasText: '',
  });
  // The slide panel logo may not be visible on smaller screens, so we check if it exists in the DOM
  const slidePanelLogoCount = await slidePanelLogo.count();
  if (slidePanelLogoCount > 0) {
    // If the element exists, verify it has the correct src
    const slidePanelLogoSrc = await slidePanelLogo.first().getAttribute('src');
    expect(slidePanelLogoSrc).toContain(
      authCustomizationData.slidePanelLogoUrl
    );
  }
}
