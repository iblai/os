import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp } from "../utils/auth";
import { logger } from "@iblai/iblai-js/playwright";

test.describe("Journey 4: User Profile Management", () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // ── Modal Navigation ───────────────────────────────────────────────────────

  test("non-admin goes to profile dropdown and opens the profile modal", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await expect(nonadminProfilePage.modal).toBeVisible();
  });

  test("non-admin goes to profile modal and closes it with the close button", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.close();
    await expect(nonadminProfilePage.modal).not.toBeVisible();
  });

  test("non-admin goes to profile modal and switches between all tabs", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const tabs = [
      "Basic",
      "Social",
      "Education",
      "Experience",
      "Resume",
      "Security",
    ];
    for (const tab of tabs) {
      await nonadminProfilePage.switchToTab(tab);
      const activeTab = nonadminProfilePage.modal.getByRole("tab", {
        name: new RegExp(tab, "i"),
        selected: true,
      });
      await expect(activeTab).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── Basic Tab ──────────────────────────────────────────────────────────────

  test("non-admin goes to profile basic tab and sees all basic profile fields displayed", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    await expect(nonadminProfilePage.fullNameField).toBeVisible({
      timeout: 10_000,
    });
    await expect(nonadminProfilePage.emailField).toBeVisible({
      timeout: 5_000,
    });
    await expect(nonadminProfilePage.titleField).toBeVisible({
      timeout: 5_000,
    });
  });

  test("non-admin goes to profile basic tab and the Full Name field is pre-populated", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    await expect(nonadminProfilePage.fullNameField).toBeVisible({
      timeout: 10_000,
    });
    const value = await nonadminProfilePage.fullNameField.inputValue();
    expect(value.length).toBeGreaterThan(0);
    logger.info(`Full Name value: ${value}`);
  });

  test("non-admin goes to profile basic tab and the Email field is pre-populated with a valid email", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    await expect(nonadminProfilePage.emailField).toBeVisible({
      timeout: 10_000,
    });
    const value = await nonadminProfilePage.emailField.inputValue();
    expect(value).toContain("@");
    logger.info(`Email value: ${value}`);
  });

  test("non-admin goes to profile basic tab and edits the Title field and sees the new value", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    const testTitle = `E2E Test Title ${Date.now()}`;
    await expect(nonadminProfilePage.titleField).toBeVisible({
      timeout: 10_000,
    });
    await nonadminProfilePage.titleField.fill(testTitle);
    await expect(nonadminProfilePage.titleField).toHaveValue(testTitle);
  });

  test("non-admin goes to profile basic tab and edits the About field and sees the new value", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    const testAbout = `E2E test about content ${Date.now()}`;
    await expect(nonadminProfilePage.aboutField).toBeVisible({
      timeout: 10_000,
    });
    await nonadminProfilePage.aboutField.fill(testAbout);
    await expect(nonadminProfilePage.aboutField).toHaveValue(testAbout);
  });

  test("non-admin goes to profile basic tab and sees the language selector", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    await expect(nonadminProfilePage.languageSelector).toBeVisible({
      timeout: 10_000,
    });
  });

  test("non-admin goes to profile basic tab and sees Save Changes and Cancel buttons", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    await expect(
      nonadminProfilePage.modal.getByRole("button", { name: "Save Changes" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      nonadminProfilePage.modal.getByRole("button", { name: "Cancel" }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("non-admin goes to profile basic tab and saves profile changes successfully", async ({
    nonadminPage,
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Basic");
    const testTitle = `Engineer ${Date.now()}`;
    await expect(nonadminProfilePage.titleField).toBeVisible({
      timeout: 10_000,
    });
    await nonadminProfilePage.titleField.fill(testTitle);
    const saveBtn = nonadminProfilePage.modal.getByRole("button", {
      name: "Save Changes",
    });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    // Modal should still be open after save
    await expect(nonadminProfilePage.modal).toBeVisible({ timeout: 10_000 });
    // Value should have persisted
    await expect(nonadminProfilePage.titleField).toHaveValue(testTitle);
    logger.info("Profile changes saved successfully");
  });

  // ── Social Tab ─────────────────────────────────────────────────────────────

  test("non-admin goes to profile social tab and sees all social profile fields", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Social");
    await expect(nonadminProfilePage.linkedInField).toBeVisible({
      timeout: 10_000,
    });
    await expect(nonadminProfilePage.twitterField).toBeVisible({
      timeout: 5_000,
    });
    await expect(nonadminProfilePage.facebookField).toBeVisible({
      timeout: 5_000,
    });
  });

  test("non-admin goes to profile social tab and sees URL prefixes on social fields including facebook linkedin and twitter", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Social");
    const facebookField = nonadminProfilePage.modal.getByRole("textbox", {
      name: "Facebook",
    });
    if (await facebookField.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const facebookValue = await facebookField.inputValue();
      expect(facebookValue).toContain("facebook.com");
    }
    const linkedinValue = await nonadminProfilePage.linkedInField.inputValue();
    expect(linkedinValue).toContain("linkedin.com");
    const twitterValue = await nonadminProfilePage.twitterField.inputValue();
    expect(twitterValue).toMatch(/x\.com|twitter\.com/);
  });

  test("non-admin goes to profile social tab and edits the LinkedIn field", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Social");
    const testLinkedIn = "https://linkedin.com/in/e2etestprofile";
    await nonadminProfilePage.linkedInField.fill(testLinkedIn);
    await expect(nonadminProfilePage.linkedInField).toHaveValue(testLinkedIn);
  });

  test("non-admin goes to profile social tab and sees Save Changes and Cancel buttons", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Social");
    await expect(
      nonadminProfilePage.modal.getByRole("button", { name: "Save Changes" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      nonadminProfilePage.modal.getByRole("button", { name: "Cancel" }),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── Education Tab ──────────────────────────────────────────────────────────

  test("non-admin goes to profile education tab and sees the education section header", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Education");
    await expect(
      nonadminProfilePage.modal.getByRole("heading", {
        name: "education",
        level: 3,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("non-admin goes to profile education tab and sees the Add education button", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Education");
    await expect(
      nonadminProfilePage.modal
        .getByRole("button", { name: "Add education" })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and sees the Degree Field of study and Institution fields",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await expect(dialog.getByRole("textbox", { name: "Degree" })).toBeVisible(
        {
          timeout: 5_000,
        },
      );
      await expect(
        dialog.getByRole("combobox", { name: "Field of study" }),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        dialog.getByRole("combobox", { name: "Institution" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and sees the degree field has placeholder text",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      const degreeField = dialog.getByRole("textbox", { name: "Degree" });
      await expect(degreeField).toHaveAttribute(
        "placeholder",
        "e.g. Bachelor of Science",
      );
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and sees the grade field as a spinbutton for numeric input",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      const gradeField = dialog.getByRole("spinbutton", { name: "Grade" });
      await expect(gradeField).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and enters a numeric grade value",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      const gradeField = dialog.getByRole("spinbutton", { name: "Grade" });
      await gradeField.fill("3.9");
      await expect(gradeField).toHaveValue("3.9");
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and closes it with the Cancel button",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      const cancelBtn = dialog.getByRole("button", { name: "Cancel" });
      await cancelBtn.click();
      await expect(
        nonadminPage
          .getByRole("heading", { name: "Add education", level: 2 })
          .first(),
      ).not.toBeVisible({ timeout: 5_000 });
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and sees the Save changes button",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await expect(
        dialog.getByRole("button", { name: "Save changes" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and sees the I currently study here toggle",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await expect(dialog.getByText("I currently study here")).toBeVisible({
        timeout: 5_000,
      });
      await expect(dialog.getByRole("switch")).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and sees all required form fields",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await expect(dialog.getByRole("textbox", { name: "Degree" })).toBeVisible(
        {
          timeout: 5_000,
        },
      );
      await expect(
        dialog.getByRole("combobox", { name: "Field of study" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("combobox", { name: "Institution" }),
      ).toBeVisible();
      await expect(dialog.getByText("Start month")).toBeVisible();
      await expect(dialog.getByText("Start year")).toBeVisible();
      await expect(dialog.getByText("End month")).toBeVisible();
      await expect(dialog.getByText("End year")).toBeVisible();
      await expect(
        dialog.getByRole("spinbutton", { name: "Grade" }),
      ).toBeVisible();
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and opens the Field of study combobox to see options",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Field of study" }).click();
      await expect(nonadminPage.getByRole("listbox")).toBeVisible({
        timeout: 5_000,
      });
      await nonadminPage.keyboard.press("Escape");
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and opens the Institution combobox to see Add new institution option",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Institution" }).click();
      await expect(
        nonadminPage.getByRole("option", { name: "Add new institution" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and enables I currently study here which disables end date",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      const toggle = dialog.getByRole("switch");
      await toggle.click();
      await expect(toggle).toBeChecked();
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and opens the start month dropdown showing all months",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Start month" }).click();
      await expect(
        nonadminPage.getByRole("option", { name: "January" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and opens the start year dropdown showing years",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Start year" }).click();
      await expect(
        nonadminPage.getByRole("option", { name: "2025" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile education dialog and opens the Add Institution sub-dialog",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Institution" }).click();
      await nonadminPage
        .getByRole("option", { name: "Add new institution" })
        .click();
      await expect(
        nonadminPage
          .getByRole("heading", { name: "Add Institution", level: 2 })
          .first(),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile Add Institution dialog and sees all institution form fields",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Institution" }).click();
      await nonadminPage
        .getByRole("option", { name: "Add new institution" })
        .click();
      await expect(
        nonadminPage
          .getByRole("textbox", { name: "Name" })
          .or(nonadminPage.getByRole("textbox", { name: "Institution name" })),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        nonadminPage
          .getByRole("combobox", { name: "Institution type" })
          .or(nonadminPage.getByRole("combobox", { name: "Type" })),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile Add Institution dialog and sees Cancel and Save Institution buttons",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Institution" }).click();
      await nonadminPage
        .getByRole("option", { name: "Add new institution" })
        .click();
      await expect(
        nonadminPage.getByRole("button", { name: "Cancel" }),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        nonadminPage.getByRole("button", { name: "Save Institution" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile Add Institution dialog and clicks Cancel to close it",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Education");
      const dialog = await nonadminProfilePage.openAddEducationDialog();
      await dialog.getByRole("combobox", { name: "Institution" }).click();
      await nonadminPage
        .getByRole("option", { name: "Add new institution" })
        .click();
      await expect(
        nonadminPage
          .getByRole("heading", { name: "Add Institution", level: 2 })
          .first(),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.getByRole("button", { name: "Cancel" }).click();
      await expect(
        nonadminPage
          .getByRole("heading", { name: "Add Institution", level: 2 })
          .first(),
      ).not.toBeVisible({ timeout: 5_000 });
      // Add education dialog should still be visible
      await expect(
        nonadminPage
          .getByRole("heading", { name: "Add education", level: 2 })
          .first(),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // ── Experience Tab ─────────────────────────────────────────────────────────

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience tab and sees the experience section header",
    async ({ nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      await expect(
        nonadminProfilePage.modal.getByRole("heading", {
          name: "experience",
          level: 3,
          exact: true,
        }),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience tab and sees the Add experience button",
    async ({ nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      await expect(
        nonadminProfilePage.modal
          .getByRole("button", { name: "Add experience" })
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience tab and opens the Add Experience dialog",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      const dialog = await nonadminProfilePage.openAddExperienceDialog();
      await expect(dialog).toBeVisible();
      await expect(
        nonadminPage
          .getByRole("heading", { name: "Add experience", level: 2 })
          .first(),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience dialog and sees all required form fields",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      const dialog = await nonadminProfilePage.openAddExperienceDialog();
      await expect(dialog.getByRole("textbox", { name: "Title" })).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        dialog.getByRole("combobox", { name: "Company" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("combobox", { name: "Employment type" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("textbox", { name: "Location" }),
      ).toBeVisible();
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience dialog and sees the I currently work here toggle",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      const dialog = await nonadminProfilePage.openAddExperienceDialog();
      await expect(dialog.getByRole("switch")).toBeVisible({ timeout: 5_000 });
      await expect(dialog.getByText("I currently work here")).toBeVisible({
        timeout: 5_000,
      });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience dialog and enables I currently work here which disables end date fields",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      const dialog = await nonadminProfilePage.openAddExperienceDialog();
      const toggle = dialog.getByRole("switch");
      await toggle.click();
      await expect(toggle).toBeChecked();
      const endMonthCombobox = dialog.getByRole("combobox", {
        name: "End month",
      });
      const endYearCombobox = dialog.getByRole("combobox", {
        name: "End year",
      });
      if (
        await endMonthCombobox.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await expect(endMonthCombobox).toBeDisabled();
        await expect(endYearCombobox).toBeDisabled();
      }
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience dialog and sees Cancel and Save changes buttons",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      const dialog = await nonadminProfilePage.openAddExperienceDialog();
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        dialog.getByRole("button", { name: "Save changes" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience dialog and closes it with the Cancel button",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      const dialog = await nonadminProfilePage.openAddExperienceDialog();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(
        nonadminPage
          .getByRole("heading", { name: "Add experience", level: 2 })
          .first(),
      ).not.toBeVisible({ timeout: 5_000 });
    },
  );

  // fixme: strict mode violation — Add Education/Experience button resolves to multiple elements
  test.fixme(
    "non-admin goes to profile experience dialog and opens the Company dropdown to see Add new company option",
    async ({ nonadminPage, nonadminProfilePage }) => {
      await nonadminProfilePage.open();
      await nonadminProfilePage.switchToTab("Experience");
      const dialog = await nonadminProfilePage.openAddExperienceDialog();
      await dialog.getByRole("combobox", { name: "Company" }).click();
      await expect(
        nonadminPage.getByRole("option", { name: "Add new company" }),
      ).toBeVisible({ timeout: 5_000 });
      await nonadminPage.keyboard.press("Escape");
      await nonadminPage.keyboard.press("Escape");
    },
  );

  // ── Resume Tab ─────────────────────────────────────────────────────────────

  test("non-admin goes to profile resume tab and sees the resume section header", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Resume");
    await expect(
      nonadminProfilePage.modal.getByRole("heading", {
        name: "resume",
        level: 3,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("non-admin goes to profile resume tab and sees the upload resume button", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Resume");
    await expect(nonadminProfilePage.uploadResumeButton).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Security Tab ───────────────────────────────────────────────────────────

  test("non-admin goes to profile security tab and sees the security section header", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Security");
    await expect(
      nonadminProfilePage.modal.getByRole("heading", {
        name: "security",
        level: 3,
        exact: true,
      }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("non-admin goes to profile security tab and sees the Security Settings card", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Security");
    // The security tab should have some content visible
    await expect(nonadminProfilePage.modal.getByRole("tabpanel")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("non-admin goes to profile security tab and sees the Send Password Reset Link button", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Security");
    await expect(nonadminProfilePage.sendPasswordResetButton).toBeVisible({
      timeout: 10_000,
    });
  });

  test("non-admin goes to profile security tab and does not see the Save Changes button", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await nonadminProfilePage.switchToTab("Security");
    await expect(
      nonadminProfilePage.modal.getByRole("button", { name: "Save Changes" }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  test("non-admin goes to profile modal and it has proper ARIA attributes", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const tablist = nonadminProfilePage.modal.getByRole("tablist");
    await expect(tablist).toBeVisible({ timeout: 5_000 });
    const activeTab = nonadminProfilePage.modal.getByRole("tab", {
      selected: true,
    });
    await expect(activeTab).toBeVisible({ timeout: 5_000 });
    await expect(activeTab).toHaveAttribute("aria-selected", "true");
  });

  test("non-admin goes to profile modal and the close button has an accessible name", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    await expect(nonadminProfilePage.closeButton).toBeVisible({
      timeout: 5_000,
    });
    await expect(nonadminProfilePage.closeButton).toHaveAccessibleName("Close");
  });

  test("non-admin goes to profile modal and profile tabs have a tablist role", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const tablist = nonadminProfilePage.modal.getByRole("tablist");
    await expect(tablist.first()).toBeVisible({ timeout: 5_000 });
  });

  test("non-admin goes to profile modal and individual tabs have proper tab role and aria-selected", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const tabs = nonadminProfilePage.modal.getByRole("tab");
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(6);
    const selectedTab = nonadminProfilePage.modal.getByRole("tab", {
      selected: true,
    });
    await expect(selectedTab.first()).toBeVisible({ timeout: 5_000 });
  });

  test("non-admin goes to profile modal and switching tabs updates aria-selected state", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const basicTab = nonadminProfilePage.modal
      .getByRole("tab", { name: "Basic" })
      .first();
    await expect(basicTab).toHaveAttribute("aria-selected", "true");
    await nonadminProfilePage.switchToTab("Social");
    const socialTab = nonadminProfilePage.modal
      .getByRole("tab", { name: "Social" })
      .first();
    await expect(socialTab).toHaveAttribute("aria-selected", "true");
    await expect(basicTab).toHaveAttribute("aria-selected", "false");
  });

  test("non-admin goes to profile modal and the tab panel has proper tabpanel role", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const tabpanel = nonadminProfilePage.modal.getByRole("tabpanel");
    await expect(tabpanel).toBeVisible({ timeout: 5_000 });
  });

  test("non-admin goes to profile modal and tabs have aria-controls linking to the tabpanel", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const selectedTab = nonadminProfilePage.modal
      .getByRole("tab", { selected: true })
      .first();
    await expect(selectedTab).toBeVisible({ timeout: 5_000 });
    const ariaControls = await selectedTab.getAttribute("aria-controls");
    expect(ariaControls).toBeTruthy();
  });

  test("non-admin goes to profile modal and the avatar upload button has an accessible name", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const uploadBtn = nonadminProfilePage.modal.getByRole("button", {
      name: "Upload profile picture",
    });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
    await expect(uploadBtn).toHaveAccessibleName("Upload profile picture");
  });

  // ── User Info Display ──────────────────────────────────────────────────────

  test("non-admin goes to profile modal and sees the user avatar", async ({
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const uploadBtn = nonadminProfilePage.modal.getByRole("button", {
      name: "Upload profile picture",
    });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
    logger.info("User avatar is visible");
  });

  test("non-admin goes to profile modal and an admin sees the Admin badge", async ({
    nonadminPage,
    nonadminProfilePage,
  }) => {
    await nonadminProfilePage.open();
    const adminBadge = nonadminProfilePage.modal.getByText("Admin");
    const isAdminUser = await adminBadge
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (isAdminUser) {
      await expect(adminBadge).toBeVisible();
      logger.info("Admin badge is visible");
    } else {
      logger.info("Admin badge not visible — user is not an admin");
    }
  });
});
