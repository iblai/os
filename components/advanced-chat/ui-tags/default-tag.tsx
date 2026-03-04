import {
  selectActiveTab,
  type AdvancedTab,
  type Prompt,
} from '@iblai/iblai-js/web-utils';
import { useSelector } from 'react-redux';

type Props = {
  onPromptSelect: (tab: AdvancedTab, prompt: string) => void;

  prompts: Prompt[];
};

export function DefaultTag({ onPromptSelect, prompts = [] }: Props) {
  const activeTab = useSelector(selectActiveTab);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-6 pt-6">
        {/* Suggested prompts for Chat tab */}
        <div className="space-y-3">
          {prompts.map((prompt, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => {
                onPromptSelect(activeTab, prompt.content ?? '');
              }}
            >
              <div className="flex items-start gap-3">
                {/* {renderIcon({ icon: prompt.icon })} */}
                <span className="text-gray-700 text-sm leading-relaxed">
                  {prompt.content}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
