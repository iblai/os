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
 * Every mark a run has made and not yet taken back.
 *
 * Kept because the worker is the only thing that ungroups, and MV3 can kill it
 * mid-run: without a record, that tab stays in our group for good, and the next
 * run then finds it already grouped and — by the rule below, correctly — leaves
 * it alone, so the marker silently stops working from then on.
 *
 * In `local` rather than `session` storage because a restored window brings its
 * tab groups back with it, while session storage is already gone by then.
 */
const MARKS_KEY = 'tabMarks';

async function marks(): Promise<TabMark[]> {
  try {
    const stored = await chrome.storage.local.get(MARKS_KEY);
    const saved = stored[MARKS_KEY];
    return Array.isArray(saved) ? (saved as TabMark[]) : [];
  } catch {
    return [];
  }
}

async function writeMarks(next: TabMark[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [MARKS_KEY]: next });
  } catch {
    // Storage is a courtesy here too: a mark we cannot write is a group we
    // cannot sweep later, which is the old behaviour, not a reason to fail.
  }
}

/** One tab, one mark: a re-grouped tab replaces its own record rather than adding to it. */
async function remember(mark: TabMark): Promise<void> {
  const others = (await marks()).filter((m) => m.tabId !== mark.tabId);
  await writeMarks([...others, mark]);
}

async function forget(tabId: number): Promise<void> {
  await writeMarks((await marks()).filter((m) => m.tabId !== tabId));
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
  if (!chrome.tabGroups || typeof chrome.tabs.group !== 'function') {
    // Said out loud because the alternative is indistinguishable from a run
    // that never started: an extension whose tabGroups permission was not
    // granted on update silently never marks anything again.
    console.warn(
      '[ibl.ai panel] this Chrome does not offer tab groups to the extension, so the tab strip is left alone',
    );
    return null;
  }
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.groupId !== undefined && tab.groupId !== NO_GROUP) {
      console.info(
        `[ibl.ai panel] tab ${tabId} is already in a tab group, so this run leaves the tab strip as it is`,
      );
      return null;
    }
    const groupId = await chrome.tabs.group({ tabIds: [tabId] });
    await chrome.tabGroups.update(groupId, {
      title: t('appName'),
      color: 'blue',
    });
    const mark = { tabId, groupId };
    await remember(mark);
    return mark;
  } catch (err) {
    // Grouping is a courtesy, never a reason a run cannot start — but a
    // courtesy that quietly never happens is one nobody can report.
    console.warn(
      '[ibl.ai panel] could not mark the tab in the tab strip:',
      err,
    );
    return null;
  }
}

/**
 * Ungroups the tab if it is still in the group we put it in. The user may have
 * dragged it elsewhere, or dragged their own tabs in — ungrouping those would
 * be us rearranging their window.
 *
 * Throws what `chrome.tabs` throws, so a sweep can tell "left as it was" from
 * "could not be reached", and keep the record in the second case.
 */
async function ungroupIfOurs(mark: TabMark): Promise<void> {
  const tab = await chrome.tabs.get(mark.tabId);
  if (tab.groupId !== mark.groupId) return;
  await chrome.tabs.ungroup([mark.tabId]);
}

/** Puts the tab back where it was, and drops its record either way. */
export async function unmarkTab(mark: TabMark | null): Promise<void> {
  if (!mark || typeof chrome.tabs.ungroup !== 'function') return;
  try {
    await ungroupIfOurs(mark);
  } catch {
    // The tab or the group is already gone.
  }
  await forget(mark.tabId);
}

/**
 * Takes back the marks of runs that never ended — a worker killed mid-run
 * leaves the tab grouped, and nothing else will ever ungroup it.
 *
 * Runs once as the worker starts, which is the one moment no run can be live,
 * so it can never take the marker off a tab that is being driven right now.
 * A mark whose tab cannot be reached is kept for the next start rather than
 * dropped; one whose tab has moved to another group is not ours any more and
 * goes.
 */
export async function sweepStaleMarks(): Promise<void> {
  const stale = await marks();
  if (!stale.length || typeof chrome.tabs.ungroup !== 'function') return;
  const unreached: TabMark[] = [];
  for (const mark of stale) {
    try {
      await ungroupIfOurs(mark);
    } catch {
      if (await stillOpen(mark.tabId)) unreached.push(mark);
    }
  }
  await writeMarks(unreached);
}

/** A tab that has been closed takes its record with it; anything else is worth retrying. */
async function stillOpen(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}
