import { Page, Locator } from '@playwright/test';

/**
 * HOST-owned pieces of the Edit Agent → Skills tab only: the tab heading /
 * description and the info box rendered by
 * `components/modals/edit-mentor-modal/tabs/skills-tab.tsx`.
 *
 * Everything inside the skills SECTION (sub-tabs, rows, toggles, the
 * New/Edit Skill dialogs, resources) is the SDK's `<AgentSkills/>` component
 * and is driven through the dedicated helpers in `@iblai/iblai-js/playwright`
 * (`verifySkillsTabVisible`, `switchToAgentSkillsSubTab`, `createSkill`,
 * `editSkill`, `deleteSkill`, `toggleSkill`, …) — the skills helpers were
 * split out of the sandbox helpers when Agent Skills stopped depending on a
 * wired sandbox. Do not re-grow SDK-UI locators here.
 *
 * Tab VISIBILITY (the segment only mounts for Base Agent mentors —
 * `resolveIsBaseAgentMentor` in `hooks/use-mentor-segments.ts`) is covered
 * by journey 67 (`e2e/journeys/67-agent-skills.spec.ts`).
 */
export class SkillsTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Host info box under the heading (data-testid="skills-info-box"). */
  readonly infoBox: Locator;
  /** Host tab description line under the "Skills" heading. */
  readonly description: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.infoBox = dialog.getByTestId('skills-info-box');
    this.description = dialog.getByText(
      'Reusable playbooks this Base Agent can discover and follow.',
    );
  }
}
