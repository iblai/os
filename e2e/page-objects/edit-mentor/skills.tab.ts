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
/**
 * The four mentor-scoped grants the SDK's `<AgentSkills/>` gates its UI on
 * (see `mentorDbId` in the component): `view_skill_assignments` gates the
 * assignment fetches, `create_skill_assignment` the whole Available Skills
 * catalog sub-tab + the New Skill button, `write_skill_assignment` the
 * enable Switch, `delete_skill_assignment` the row Remove button.
 */
export type SkillAssignmentGrants = {
  view_skill_assignments: boolean;
  create_skill_assignment: boolean;
  write_skill_assignment: boolean;
  delete_skill_assignment: boolean;
};

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

  /**
   * Intercepts the RBAC permissions-check POST (fired by the edit modal
   * itself when it opens — HOST-owned, so this mock belongs here despite
   * gating SDK UI) and fulfills it with the REAL response, mutated so every
   * requested mentor-scoped resource (`/mentors/{id}/`) carries exactly the
   * given skill-assignment grants — forcing both grant AND deny, so tests
   * are hermetic w.r.t. the backend's grant rollout in either direction.
   * Same technique as `ChatPage.grantSkillAssignmentsRead` (which grants
   * only the read the composer needs). Must be registered BEFORE
   * `editMentorPage.open()` — the modal runs the check on open.
   */
  async mockSkillAssignmentGrants(
    grants: SkillAssignmentGrants,
  ): Promise<void> {
    await this.page.route(
      (url) => url.pathname.includes('/api/core/rbac/permissions/check'),
      async (route) => {
        const response = await route.fetch();
        let json: Record<string, unknown>;
        try {
          json = await response.json();
        } catch {
          await route.fulfill({ response });
          return;
        }
        const requested: string[] =
          route.request().postDataJSON()?.resources ?? [];
        for (const resource of requested) {
          if (/^\/mentors\/[^/]+\/$/.test(resource)) {
            const entry = json[resource];
            json[resource] = {
              ...(entry && typeof entry === 'object' ? entry : {}),
              ...grants,
            };
          }
        }
        await route.fulfill({ response, json });
      },
    );
  }

  /**
   * Grants the FULL skill-assignment set — the deterministic "full admin
   * view" every management/gating assert of the complete SDK section
   * (both sub-tabs, New Skill, switches, Remove) must register first.
   */
  async grantAllSkillAssignmentPerms(): Promise<void> {
    await this.mockSkillAssignmentGrants({
      view_skill_assignments: true,
      create_skill_assignment: true,
      write_skill_assignment: true,
      delete_skill_assignment: true,
    });
  }
}
