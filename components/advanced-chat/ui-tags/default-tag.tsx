import {
  selectActiveTab,
  type AdvancedTab,
  type Prompt,
} from '@iblai/iblai-js/web-utils';
import { useSelector } from 'react-redux';
import Markdown from '@/components/markdown';

type Props = {
  onPromptSelect: (tab: AdvancedTab, prompt: string) => void;

  prompts: Prompt[];
};

export function DefaultTag({ onPromptSelect, prompts = [] }: Props) {
  const activeTab = useSelector(selectActiveTab);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-6 pt-6">
        {/* Suggested prompts for Chat tab */}
        <div className="space-y-3">
          {prompts.map((prompt, idx) => (
            <div
              key={idx}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
              onClick={() => {
                onPromptSelect(activeTab, prompt.content ?? '');
              }}
            >
              <div className="flex items-start gap-3">
                {/* {renderIcon({ icon: prompt.icon })} */}
                <Markdown className="text-sm leading-relaxed text-gray-700">
                  {prompt.content}
                </Markdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
