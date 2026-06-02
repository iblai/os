'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SettingsTab,
  LLMTab,
  PromptsTab,
  McpTab,
  ToolsTab,
  SafetyTab,
  PrivacyTab,
  // FlowTab,
  HistoryTab,
  DatasetsTab,
  ApiTab,
  EmbedTab,
  AccessTab,
  SandboxTab,
  SkillsTab,
  AuditLogTab,
} from './tabs';
import { useNavigate } from '@/hooks/user-navigate';
import { MODALS } from '@/lib/constants';
import { MemoryTab } from './tabs/memory-tab';
import { DisclaimersTab } from './tabs/disclaimers-tab';
import {
  useMentorSegments,
  MENTOR_SEGMENT_NAV_CATEGORIES,
  type MentorSegment,
  type MentorSegmentNavCategory,
} from '@/hooks/use-mentor-segments';
import { cn } from '@/lib/utils';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Maps a mentor segment value to the React component rendered inside its
 * tab panel. The keys MUST stay in sync with `MENTOR_SEGMENTS` in
 * `hooks/use-mentor-segments.ts`. The covering test in
 * `hooks/__tests__/use-mentor-segments.test.tsx` enforces this.
 */
export const EDIT_MENTOR_TAB_COMPONENTS: Record<string, ReactNode> = {
  [MODALS.EDIT_MENTOR.tabs.settings]: <SettingsTab />,
  [MODALS.EDIT_MENTOR.tabs.sandbox]: <SandboxTab />,
  [MODALS.EDIT_MENTOR.tabs.access]: <AccessTab />,
  [MODALS.EDIT_MENTOR.tabs.llm]: <LLMTab />,
  [MODALS.EDIT_MENTOR.tabs.prompts]: <PromptsTab />,
  [MODALS.EDIT_MENTOR.tabs.skills]: <SkillsTab />,
  [MODALS.EDIT_MENTOR.tabs.safety]: <SafetyTab />,
  [MODALS.EDIT_MENTOR.tabs.privacy]: <PrivacyTab />,
  [MODALS.EDIT_MENTOR.tabs.disclaimer]: <DisclaimersTab />,
  [MODALS.EDIT_MENTOR.tabs.tools]: <ToolsTab />,
  [MODALS.EDIT_MENTOR.tabs.mcp]: <McpTab />,
  [MODALS.EDIT_MENTOR.tabs.memory]: <MemoryTab />,
  [MODALS.EDIT_MENTOR.tabs.history]: <HistoryTab />,
  [MODALS.EDIT_MENTOR.tabs.audit_log]: <AuditLogTab />,
  [MODALS.EDIT_MENTOR.tabs.datasets]: <DatasetsTab />,
  [MODALS.EDIT_MENTOR.tabs.api]: <ApiTab />,
  [MODALS.EDIT_MENTOR.tabs.embed]: <EmbedTab />,
};

export function EditMentorModal({ isOpen, onClose }: Props) {
  const { changeModalTab, getEditMentorTab } = useNavigate();
  const { filteredSegments } = useMentorSegments({ preferModalMentorId: true });
  const activeTab = getEditMentorTab() || MODALS.EDIT_MENTOR.tabs.settings;

  // Bucket the visible segments by their nav category. Segments without a
  // category (e.g. hidden tabs) are silently dropped here — the sidebar
  // intentionally only surfaces categorized tabs.
  const itemsByCategory = useMemo(() => {
    const map = new Map<MentorSegmentNavCategory, MentorSegment[]>();
    for (const item of filteredSegments) {
      if (!item.navCategory) continue;
      const bucket = map.get(item.navCategory) ?? [];
      bucket.push(item);
      map.set(item.navCategory, bucket);
    }
    return map;
  }, [filteredSegments]);

  const activeSegment = filteredSegments.find((s) => s.value === activeTab);

  // Only categories that actually have items get a column / pill. If
  // RBAC removes every Integrations or Analytics segment for a user,
  // the whole category disappears from the strip — no greyed-out pills.
  const visibleCategories = useMemo(
    () =>
      MENTOR_SEGMENT_NAV_CATEGORIES.filter(
        (c) => (itemsByCategory.get(c.key)?.length ?? 0) > 0,
      ),
    [itemsByCategory],
  );

  const fallbackCategory =
    visibleCategories[0]?.key ?? ('configurations' as MentorSegmentNavCategory);

  // Track the active category for the sidebar tab strip. Defaults to the
  // category of the active segment so deep-linking to a tab opens the
  // correct category; falls back to the first non-empty category.
  const [activeCategory, setActiveCategory] =
    useState<MentorSegmentNavCategory>(
      activeSegment?.navCategory ?? fallbackCategory,
    );

  // Keep the category in sync if the active segment moves to a different
  // category (e.g. via URL/modal-stack navigation). The effect runs only
  // when activeTab actually points at a categorized segment, so manual
  // category switches aren't immediately overridden.
  useEffect(() => {
    if (activeSegment?.navCategory) {
      setActiveCategory(activeSegment.navCategory);
    }
  }, [activeSegment?.navCategory]);

  // Self-correct when the current category becomes empty (e.g. an
  // admin's Analytics tabs disappear after a permissions refresh). We
  // snap to the first visible category so the sidebar never gets stuck
  // pointing at an empty bucket.
  useEffect(() => {
    if (
      visibleCategories.length > 0 &&
      !visibleCategories.some((c) => c.key === activeCategory)
    ) {
      setActiveCategory(visibleCategories[0].key);
    }
  }, [visibleCategories, activeCategory]);

  const handleTabChange = (tabValue: string) => {
    changeModalTab(tabValue);
  };

  // When the user picks a category tab, pre-open the first segment in that
  // category — matches the nav-bar pattern where each section "opens" with
  // a sensible default selection instead of leaving the panel blank.
  const handleCategoryChange = (categoryKey: string) => {
    const next = categoryKey as MentorSegmentNavCategory;
    setActiveCategory(next);
    const firstItem = itemsByCategory.get(next)?.[0];
    if (firstItem && firstItem.value !== activeTab) {
      changeModalTab(firstItem.value);
    }
  };

  const visibleSidebarItems = itemsByCategory.get(activeCategory) ?? [];
  // Drop the category strip entirely when only one bucket has items —
  // no point in showing a single pill above the segment list.
  const showCategoryStrip = visibleCategories.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`mx-auto w-[85vw] max-w-7xl gap-0 overflow-hidden p-0 md:w-full`}
        style={{
          height: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <DialogDescription className="sr-only">
          Edit Agent settings, prompts, tools, safety, flow, history, datasets,
          and API keys
        </DialogDescription>
        <div className="scrollbar-none flex-1 overflow-y-auto lg:overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex h-full flex-col lg:flex-row"
          >
            {/* Mobile Header */}
            <div className="lg:hidden">
              <DialogHeader className="border-b border-gray-200 px-3 py-4">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Edit Agent
                </DialogTitle>
              </DialogHeader>
            </div>
            {/* Desktop Sidebar - 3-category tab strip + filtered segment list */}
            <div className="hidden w-80 min-w-0 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50 lg:flex dark:border-gray-800 dark:bg-gray-900">
              <DialogHeader className="flex h-[73px] flex-shrink-0 justify-start border-b border-gray-200 p-4 dark:border-gray-800">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Edit Agent
                </DialogTitle>
              </DialogHeader>
              <div className="scrollbar-none flex-1 overflow-y-auto p-2">
                {/* Standalone Tabs root just for the category strip — it
                    doesn't drive content, only filters the segment list
                    below. Hidden entirely when only one category has
                    items (no point showing a strip with a single pill).
                    Column count is dynamic so 2 visible buckets get a
                    2-col grid instead of 3 with an empty slot. */}
                {showCategoryStrip && (
                  <Tabs
                    value={activeCategory}
                    onValueChange={handleCategoryChange}
                    className="mb-2"
                  >
                    <TabsList
                      className="grid h-auto w-full gap-1 bg-gray-100 p-1 dark:bg-gray-800"
                      style={{
                        gridTemplateColumns: `repeat(${visibleCategories.length}, minmax(0, 1fr))`,
                      }}
                      aria-label="Agent settings categories"
                    >
                      {visibleCategories.map((category) => (
                        <TabsTrigger
                          key={category.key}
                          value={category.key}
                          className="px-2 py-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100"
                        >
                          {category.title}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}

                <TabsList
                  className="h-auto w-full flex-col space-y-1 bg-transparent p-0"
                  aria-label="Agent settings tabs"
                >
                  {visibleSidebarItems.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="w-full justify-start px-4 py-3 text-left text-sm text-gray-800 hover:bg-gray-100 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-400 data-[state=active]:font-medium data-[state=active]:text-white dark:text-gray-300 dark:hover:bg-gray-800"
                      id={`desktop-tab-${tab.value}`}
                      aria-controls={`panel-${tab.value}`}
                    >
                      <tab.icon
                        className="mr-3 h-4 w-4 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            {/* Mobile and Tablet — category tab strip + segment select */}
            <div className="border-b border-gray-200 lg:hidden">
              {showCategoryStrip && (
                <Tabs
                  value={activeCategory}
                  onValueChange={handleCategoryChange}
                  className="px-3 pt-2"
                >
                  <TabsList
                    className="grid h-auto w-full gap-1 bg-gray-100 p-1"
                    style={{
                      gridTemplateColumns: `repeat(${visibleCategories.length}, minmax(0, 1fr))`,
                    }}
                    aria-label="Agent settings categories"
                  >
                    {visibleCategories.map((category) => (
                      <TabsTrigger
                        key={category.key}
                        value={category.key}
                        className="px-2 py-1.5 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900"
                      >
                        {category.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
              <TabsList
                className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-white px-3 py-2"
                aria-label="Agent settings tabs"
              >
                {visibleSidebarItems.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'flex items-center gap-2 px-2 text-xs whitespace-nowrap data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 sm:px-3 sm:text-sm',
                    )}
                    id={`tab-${tab.value}`}
                    aria-controls={`panel-${tab.value}`}
                  >
                    <tab.icon
                      className="h-3 w-3 sm:h-4 sm:w-4"
                      aria-hidden="true"
                    />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {/* Main Content Area - Now takes up 2/3 of the width */}
            <div
              className="flex flex-1 flex-col overflow-hidden"
              style={{ height: '100%' }}
            >
              {filteredSegments.map((tab) => (
                <TabsContent
                  key={tab.value}
                  value={tab.value}
                  className="m-0 flex flex-1 flex-col overflow-hidden p-0 data-[state=inactive]:hidden"
                  style={{ height: '100%' }}
                  id={`panel-${tab.value}`}
                  aria-labelledby={`tab-${tab.value}`}
                >
                  {EDIT_MENTOR_TAB_COMPONENTS[tab.value]}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
