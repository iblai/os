'use client';

import { ReactNode } from 'react';
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
  // FlowTab,
  HistoryTab,
  DatasetsTab,
  ApiTab,
  EmbedTab,
  AccessTab,
  SandboxTab,
  SkillsTab,
} from './tabs';
import { useNavigate } from '@/hooks/user-navigate';
import { MODALS } from '@/lib/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MemoryTab } from './tabs/memory-tab';
import { DisclaimersTab } from './tabs/disclaimers-tab';
import { useMentorSegments } from '@/hooks/use-mentor-segments';

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
  [MODALS.EDIT_MENTOR.tabs.disclaimer]: <DisclaimersTab />,
  [MODALS.EDIT_MENTOR.tabs.tools]: <ToolsTab />,
  [MODALS.EDIT_MENTOR.tabs.mcp]: <McpTab />,
  [MODALS.EDIT_MENTOR.tabs.memory]: <MemoryTab />,
  [MODALS.EDIT_MENTOR.tabs.history]: <HistoryTab />,
  [MODALS.EDIT_MENTOR.tabs.datasets]: <DatasetsTab />,
  [MODALS.EDIT_MENTOR.tabs.api]: <ApiTab />,
  [MODALS.EDIT_MENTOR.tabs.embed]: <EmbedTab />,
};

export function EditMentorModal({ isOpen, onClose }: Props) {
  const { changeModalTab, getEditMentorTab } = useNavigate();
  const { filteredSegments } = useMentorSegments({ preferModalMentorId: true });
  const activeTab = getEditMentorTab() || MODALS.EDIT_MENTOR.tabs.settings;

  const handleTabChange = (tabValue: string) => {
    changeModalTab(tabValue);
  };

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
          Edit Mentor settings, prompts, tools, safety, flow, history, datasets,
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
                  Edit Mentor
                </DialogTitle>
              </DialogHeader>
            </div>
            {/* Desktop Sidebar - Now takes up 1/3 of the width */}
            <div className="hidden w-80 min-w-0 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50 lg:flex dark:border-gray-800 dark:bg-gray-900">
              <DialogHeader className="flex h-[73px] flex-shrink-0 justify-start border-b border-gray-200 p-4 dark:border-gray-800">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Edit Mentor
                </DialogTitle>
              </DialogHeader>
              <div className="scrollbar-none flex-1 overflow-y-auto">
                <TabsList
                  className="h-auto w-full flex-col space-y-1 bg-transparent p-2"
                  aria-label="Mentor settings tabs"
                >
                  {filteredSegments.map((tab) => (
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

            {/* Mobile and Tablet Tabs */}
            <div className="lg:hidden">
              <TabsList
                className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-gray-200 bg-white px-3 py-2"
                aria-label="Mentor settings tabs"
              >
                {/* Show first 4 tabs on mobile, first 8 tabs on tablet */}
                {filteredSegments
                  .slice(0, window.innerWidth >= 768 ? 8 : 3)
                  .map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center gap-2 px-2 text-xs whitespace-nowrap data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 sm:px-3 sm:text-sm"
                      id={`tab-${tab.value}`}
                      aria-controls={`panel-${tab.value}`}
                    >
                      <tab.icon
                        className="h-3 w-3 sm:h-4 sm:w-4"
                        aria-hidden="true"
                      />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="text-xs sm:hidden">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                {/* Show dropdown for remaining tabs */}
                {filteredSegments.length >
                  (window.innerWidth >= 768 ? 8 : 3) && (
                  <>
                    <TabsTrigger
                      key={activeTab}
                      value={activeTab}
                      className="flex items-center gap-2 px-2 text-xs whitespace-nowrap data-[state=active]:shadow-none sm:text-sm"
                      id={`tab-${activeTab}`}
                      aria-controls={`panel-${activeTab}`}
                    >
                      <Select value={activeTab} onValueChange={handleTabChange}>
                        <SelectTrigger
                          className="w-auto border-none text-xs shadow-none sm:text-sm"
                          aria-label="More tabs"
                        >
                          <SelectValue placeholder="More..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredSegments
                            .slice(window.innerWidth >= 768 ? 8 : 3)
                            .map((tab) => (
                              <SelectItem key={tab.value} value={tab.value}>
                                <div className="flex items-center gap-2">
                                  <tab.icon
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  {tab.label}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TabsTrigger>
                  </>
                )}
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
