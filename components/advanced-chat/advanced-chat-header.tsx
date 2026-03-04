import { toast } from 'sonner';

import { type AdvancedTab } from '@iblai/iblai-js/web-utils';

type Props = {
  mentorName: string;
  profileImage: string;
  isTyping: boolean;
  activeTab: AdvancedTab;
  tabs: AdvancedTab[];
  setActiveTab: (tab: AdvancedTab) => void;
};

export function AdvancedChatHeader({ tabs, activeTab, setActiveTab, isTyping }: Props) {
  return (
    <>
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (isTyping) {
                toast.error('You cannot switch tabs while streaming');
                return;
              }
              setActiveTab(tab);
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </>
  );
}
