import type { Page } from '@playwright/test';
import { test as base, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import { deleteMcpServer } from '../utils/mcp-servers';
import { ChatMcpMenuPage } from '../page-objects/chat-mcp-menu.page';
import { McpTab } from '../page-objects/edit-mentor/mcp.tab';
import type { CreateMentorPage } from '../page-objects/create-mentor.page';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';

/**
 * Journey 25 — the agent settings MCP tab (iblai/iblai-platform#2725).
 *
 * The tab lists the connectors as compact cards, under Featured / Directory
 * sub-tabs when the organization features any (one Connectors list
 * otherwise). Each card is a group named after its connector, with one
 * switch (on/off for this agent) and two icon buttons: Configure (gear),
 * which opens the "Configure MCP Connector" form, and Delete (bin), which
 * asks in "Remove Connector" first. Add Connector opens the same form as
 * "Add MCP Connector"; a connector added there is turned on for the agent
 * at once. Turning a connector on adds the agent's `mcp` tool, and taking
 * the last one off removes it again.
 *
 * Every test that changes anything runs on its own fresh agent (tests
 * otherwise share the most recently opened agent), with a connector created
 * by API and scoped to that agent (`ChatMcpMenuPage.createServer`), and the
 * `mcp` fixture deletes every connector a test created, including the ones
 * added through the form. The list is narrowed to the connector's unique name
 * through the tab's search box, so its card is on the first page however
 * many connectors the organization has.
 */

const test = base.extend<{ mcp: ChatMcpMenuPage }>({
  // Fixture teardown, unlike a `finally` in the test body, still runs after
  // a test timeout.
  mcp: [
    async ({ page, request }, use) => {
      const mcp = new ChatMcpMenuPage(page);
      await use(mcp);
      for (const server of mcp.createdServers) {
        await deleteMcpServer(request, server);
      }
    },
    { scope: 'test' },
  ],
});

const serverUrl = (name: string) => `https://${name}.example.com/mcp`;

interface AdminFixtures {
  page: Page;
  mcp: ChatMcpMenuPage;
  createMentorPage: CreateMentorPage;
  editMentorPage: EditMentorPage;
}

/**
 * A fresh agent with one connector created by API for it (not yet on for the
 * agent), and the MCP tab open with that connector's card found.
 */
const freshAgentWithCard = async ({
  mcp,
  createMentorPage,
  editMentorPage,
}: AdminFixtures): Promise<{ serverId: number; name: string }> => {
  await createMentorPage.openAndCreate();
  const name = ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex);
  const serverId = await mcp.createServer(name);
  await editMentorPage.open('MCP');
  await editMentorPage.mcp.findCard(serverId, name);
  return { serverId, name };
};

test.describe('Journey 25: Mentor MCP Tab', () => {
  const { LABELS } = McpTab;

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    await waitForAdmin(page);
  });

  test('mcp-01: admin opens the MCP tab of the Edit Agent modal and finds its heading, its one-line description, Add Connector and the connector list', async ({
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    await editMentorPage.open('MCP');
    const tab = editMentorPage.mcp;

    await expect(
      editMentorPage.dialog.getByRole('tab', { name: LABELS.tab, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(tab.title).toBeVisible({ timeout: 30_000 });
    await expect(tab.description).toBeVisible();
    await expect(tab.addConnectorButton).toBeVisible();
    // Featured / Directory when something is featured, else the one list.
    await tab.showDirectory();

    await editMentorPage.close();
  });

  test('mcp-02: a connector created for a fresh agent shows as a card named after it, with its switch off and the Configure and Delete icon buttons', async ({
    page,
    mcp,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    const { serverId, name } = await freshAgentWithCard({
      page,
      mcp,
      createMentorPage,
      editMentorPage,
    });
    const tab = editMentorPage.mcp;

    await expect(tab.toggle(serverId)).toHaveAttribute('aria-checked', 'false');
    await expect(tab.toggle(serverId)).toHaveAccessibleName(
      `${name} ${LABELS.disabled}`,
    );
    await expect(tab.configureButton(serverId)).toHaveAccessibleName(
      LABELS.configure,
    );
    await expect(tab.deleteButton(serverId)).toHaveAccessibleName(
      LABELS.delete,
    );

    await editMentorPage.close();
  });

  test('mcp-03: admin adds a connector through the Add MCP Connector form, and it shows as a card already on for the agent, with the mcp tool', async ({
    mcp,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    await createMentorPage.openAndCreate();
    await editMentorPage.open('MCP');
    const tab = editMentorPage.mcp;
    await tab.showDirectory();

    const name = ChatMcpMenuPage.uniqueServerName(test.info().parallelIndex);
    const created = await tab.addConnector(name, serverUrl(name));
    mcp.createdServers.push(created);

    await tab.findCard(created.id, name);
    await expect(tab.toggle(created.id)).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 30_000 },
    );
    await expect(tab.toggle(created.id)).toHaveAccessibleName(
      `${name} ${LABELS.enabled}`,
    );
    const { ids, toolSlugs } = await mcp.agentAttachments();
    expect(ids).toContain(created.id);
    expect(toolSlugs).toContain('mcp');

    await editMentorPage.close();
  });

  test('mcp-04: the card switch turns the connector on for the agent (with the mcp tool) and off again (taking the mcp tool with it as the last one), saying so each time', async ({
    page,
    mcp,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    const { serverId, name } = await freshAgentWithCard({
      page,
      mcp,
      createMentorPage,
      editMentorPage,
    });
    const tab = editMentorPage.mcp;

    await tab.setEnabled(serverId, name, true);
    const on = await mcp.agentAttachments();
    expect(on.ids).toContain(serverId);
    expect(on.toolSlugs).toContain('mcp');

    await tab.setEnabled(serverId, name, false);
    const off = await mcp.agentAttachments();
    expect(off.ids).not.toContain(serverId);
    expect(off.toolSlugs).not.toContain('mcp');

    await editMentorPage.close();
  });

  test('mcp-05: the gear opens Configure MCP Connector with the connector filled in, and turning Allow Users to Turn Off off is kept after Update', async ({
    page,
    mcp,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    const { serverId, name } = await freshAgentWithCard({
      page,
      mcp,
      createMentorPage,
      editMentorPage,
    });
    const tab = editMentorPage.mcp;

    const dialog = await tab.openConfigure(serverId);
    await expect(dialog.getByPlaceholder(LABELS.namePlaceholder)).toHaveValue(
      name,
    );
    await expect(dialog.getByPlaceholder(LABELS.serverPlaceholder)).toHaveValue(
      serverUrl(name),
    );
    const userCanDisable = tab.userCanDisableSwitch(dialog);
    await expect(userCanDisable).toHaveAttribute('aria-checked', 'true');
    await expect(
      dialog.getByText(LABELS.userCanDisableOnHint, { exact: true }),
    ).toBeVisible();

    await userCanDisable.click();
    await expect(userCanDisable).toHaveAttribute('aria-checked', 'false');
    await expect(
      dialog.getByText(LABELS.userCanDisableOffHint, { exact: true }),
    ).toBeVisible();
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        new RegExp(`/mcp-servers/${serverId}/$`).test(
          new URL(res.url()).pathname,
        ),
      { timeout: 30_000 },
    );
    await dialog
      .getByRole('button', { name: LABELS.update, exact: true })
      .click();
    const response = await saved;
    expect(
      response.ok(),
      `updating the connector returned HTTP ${response.status()}`,
    ).toBe(true);
    expect(
      (response.request().postDataJSON() as { user_can_disable?: boolean })
        .user_can_disable,
    ).toBe(false);
    await tab.expectToast(LABELS.updatedToast(name));
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    // The form reopens on what was saved.
    const reopened = await tab.openConfigure(serverId);
    await expect(tab.userCanDisableSwitch(reopened)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.keyboard.press('Escape');
    await expect(reopened).toBeHidden({ timeout: 10_000 });

    await editMentorPage.close();
  });

  test('mcp-06: in the Add MCP Connector form Allow Users to Turn Off is on by default, and choosing OAuth shows Authentication Scope set to User with Organization, Agent and User to pick from', async ({
    page,
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    await editMentorPage.open('MCP');
    const tab = editMentorPage.mcp;
    const dialog = await tab.openAdd();

    await expect(tab.userCanDisableSwitch(dialog)).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(
      dialog.getByText(LABELS.userCanDisableOnHint, { exact: true }),
    ).toBeVisible();

    await tab.select(dialog, LABELS.noAuthentication).click();
    await page.getByRole('option', { name: LABELS.oauth, exact: true }).click();

    const scope = tab.select(dialog, LABELS.scopeUser);
    await expect(scope).toBeVisible({ timeout: 5_000 });
    await expect(
      dialog.getByText(LABELS.scopeUserHint, { exact: true }),
    ).toBeVisible();
    await scope.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    for (const option of [
      LABELS.scopeOrganization,
      LABELS.scopeAgent,
      LABELS.scopeUser,
    ]) {
      await expect(
        listbox.getByRole('option', { name: option, exact: true }),
      ).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden({ timeout: 5_000 });

    // Nothing is saved: the form is left as it was opened.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    await editMentorPage.close();
  });

  test('mcp-07: the bin asks in Remove Connector, naming the connector, and Delete removes its card and takes it off the agent', async ({
    page,
    mcp,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    const { serverId, name } = await freshAgentWithCard({
      page,
      mcp,
      createMentorPage,
      editMentorPage,
    });
    const tab = editMentorPage.mcp;
    await tab.setEnabled(serverId, name, true);

    await tab.remove(serverId, name);
    const { ids } = await mcp.agentAttachments();
    expect(ids).not.toContain(serverId);

    await editMentorPage.close();
  });
});
