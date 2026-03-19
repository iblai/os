import { expect, type Page } from "@playwright/test";
import { selectDropdownWorksCorrectly } from "../utils";
import { logger } from "@iblai/iblai-js/playwright";
import { waitForMentorResponse } from "../embedding-mentor/helpers";

const SHAREABLE_LINK_BUTTON_SELECTOR =
  ".inline-flex.items-center.justify-center.gap-2.whitespace-nowrap.rounded-md.text-sm.font-medium.transition-all.disabled\\:pointer-events-none.disabled\\:opacity-50.\\[\\&_svg\\]\\:pointer-events-none.\\[\\&_svg\\:not\\(\\[class\\*\\=\\'size-\\'\\]\\)\\]\\:size-4.shrink-0.\\[\\&_svg\\]\\:shrink-0.outline-none.focus-visible\\:border-ring.focus-visible\\:ring-ring\\/50.focus-visible\\:ring-\\[3px\\].aria-invalid\\:ring-destructive\\/20.dark\\:aria-invalid\\:ring-destructive\\/40.aria-invalid\\:border-destructive.hover\\:bg-accent.hover\\:text-accent-foreground.dark\\:hover\\:bg-accent\\/50.size-9.absolute";

export async function generateShareableLink({
  page,
  isPublic,
}: {
  page: Page;
  isPublic: boolean;
}): Promise<string> {
  await selectDropdownWorksCorrectly(page);

  // navigate to the embed tab
  const embedMenuItem = page.getByRole("menuitem", { name: "Embed" });
  await expect(embedMenuItem).toBeVisible();
  await embedMenuItem.click();

  // Wait for embed dialog to be visible
  const embedDialog = page
    .locator('div[role="dialog"]')
    .filter({ hasText: "Edit Mentor" });
  await expect(embedDialog).toBeVisible({ timeout: 60_000 });

  // Configure who can chat
  const whoCanChatSelect = embedDialog.getByRole("combobox", {
    name: "Select who can chat",
  });
  await expect(whoCanChatSelect).toBeVisible();
  await whoCanChatSelect.click();

  const chatAccessOption = page.getByRole("option", {
    name: isPublic ? "Anyone" : "Authenticated Users",
  });
  await expect(chatAccessOption).toBeVisible();
  await chatAccessOption.click();

  const shareableLinkSwitch = page.getByRole("switch", {
    name: "Generate / Revoke shareable",
  });
  await expect(shareableLinkSwitch).toBeVisible();
  const isShareableLinkSwitchChecked =
    await shareableLinkSwitch.getAttribute("aria-checked");
  if (isShareableLinkSwitchChecked === "false") {
    await shareableLinkSwitch.click();
    logger.info("✅ Shareable link switch turned ON");
  } else {
    logger.info("Shareable link switch already ON");
  }

  // read shareable link directly from the CopyCodeBlock <pre> element
  const shareableLinkPre = embedDialog.locator("pre").first();
  await expect(shareableLinkPre).toBeVisible({ timeout: 30_000 });
  const shareableLink = (await shareableLinkPre.textContent()) || "";

  return shareableLink;
}

export async function sendChatMessage(
  page: Page,
  text: string,
  maxRetries = 2,
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const textArea = page.locator(
        'textarea[placeholder]:not([placeholder=""])',
      );
      await textArea.fill("");
      await textArea.fill(text);

      const sendButton = page.getByRole("button", { name: /send message/i });
      await expect(sendButton).toBeEnabled({ timeout: 15000 });
      await sendButton.click();

      // Verify message appears
      const userMessage = page.locator(".chat-user-message-query", {
        hasText: text,
      });
      await expect(userMessage).toBeVisible({ timeout: 10_000 });

      logger.info(`✅ Message sent successfully on attempt ${i + 1}`);
      return; // Success
    } catch (error) {
      if (i === maxRetries - 1) {
        logger.error(`Failed to send message after ${maxRetries} attempts`);
        throw error;
      }
      logger.warn(`⚠️ Send attempt ${i + 1} failed, retrying...`);
    }
  }
}

export async function waitForMentorResponseToAppear(
  page: Page,
  timeout = 150000,
) {
  // Wait for any "thinking" or "typing" indicator first
  await page
    .locator('[data-ai-status="responding"]')
    .waitFor({
      state: "visible",
      timeout: 10000,
    })
    .catch(() => logger.info("No typing indicator found, continuing..."));

  // Now wait for actual response
  const mentorResponse = page
    .locator("div.flex.items-start >> div:has(p)")
    .last();
  await expect(mentorResponse).toBeVisible({ timeout });
  logger.info("✅ Mentor response to appear");

  return; // Success
}
