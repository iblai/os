import { advancedTabsProperties } from '@iblai/iblai-js/web-utils';

type Props = {
  onPromptSelect: (prompt: string) => void;
};

export function ChatTab({ onPromptSelect }: Props) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-6 pt-6">
        {/* Suggested prompts for Chat tab */}
        <div className="space-y-3">
          {advancedTabsProperties.chat.prompts.map((prompt) => (
            <div
              key={prompt.content}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => {
                onPromptSelect(prompt.content);
              }}
            >
              <div className="flex items-start gap-3">
                {/* {renderIcon({ icon: prompt.icon })} */}
                <span className="text-gray-700 text-sm leading-relaxed">{prompt.summary}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
