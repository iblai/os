// The tab-strip half of "where is it working": while a run is live the driven
// tab sits in its own named, brand-coloured Chrome tab group, so the user can
// switch away and still see which tab the agent has.
import { t } from './i18n';

/** Chrome's "not in a group" sentinel, named here so the worker can be tested without it. */
export const NO_GROUP = -1;

/** What a run grouped, and must put back exactly as it was. */
export interface TabMark {
  tabId: number;
  groupId: number;
}

/**
 * Marks the tab, unless it is already in a group.
 *
 * A tab the user has grouped is theirs: moving it out — which is what grouping
 * it here would do — rearranges a window they arranged, and putting it back
 * afterwards is not something Chrome lets us do faithfully (the original
 * group's position is not ours to restore). So that tab is left alone and the
 * run simply has no strip marker.
 */
export async function markTab(tabId: number): Promise<TabMark | null> {
  if (!chrome.tabGroups || typeof chrome.tabs.group !== 'function') return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.groupId !== undefined && tab.groupId !== NO_GROUP) return null;
    const groupId = await chrome.tabs.group({ tabIds: [tabId] });
    await chrome.tabGroups.update(groupId, {
      title: t('appName'),
      color: 'blue',
    });
    return { tabId, groupId };
  } catch {
    // Grouping is a courtesy, never a reason a run cannot start.
    return null;
  }
}

/**
 * Puts the tab back where it was. Only our own tab, and only while it is still
 * in our own group: the user may have dragged it elsewhere, or dragged their
 * own tabs in — ungrouping those would be us rearranging their window.
 */
export async function unmarkTab(mark: TabMark | null): Promise<void> {
  if (!mark || typeof chrome.tabs.ungroup !== 'function') return;
  try {
    const tab = await chrome.tabs.get(mark.tabId);
    if (tab.groupId !== mark.groupId) return;
    await chrome.tabs.ungroup([mark.tabId]);
  } catch {
    // The tab or the group is already gone.
  }
}
