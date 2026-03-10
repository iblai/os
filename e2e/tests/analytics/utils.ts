import { expect, Locator, Page } from '@playwright/test';

export async function testPageGraphs(
  page: Page,
  graphs: string[],
  timeFilters: string[],
  defaultTimeFilter: string
) {
  for (const graph of graphs) {
    const currentGraph = page.getByLabel(graph, { exact: true });
    if (await currentGraph.isVisible()) {
      await expect(currentGraph).toBeVisible();
      await expect(
        currentGraph.getByRole('button', { name: defaultTimeFilter })
      ).toHaveAttribute('aria-pressed', 'true');
      for (const timeFilter of timeFilters) {
        const currentTimeFilter = currentGraph.getByRole('button', {
          name: timeFilter,
        });
        await expect(currentTimeFilter).toBeVisible();
        if (timeFilter !== defaultTimeFilter) {
          await expect(currentTimeFilter).toHaveAttribute(
            'aria-pressed',
            'false'
          );
        }
        await currentTimeFilter.click();
        await page.waitForTimeout(1000);
        await expect(currentTimeFilter).toHaveAttribute('aria-pressed', 'true');
      }
    }
  }
}
