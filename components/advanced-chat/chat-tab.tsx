import { advancedTabsProperties } from '@iblai/iblai-js/web-utils';

type Props = {
  onPromptSelect: (prompt: string) => void;
};

export function ChatTab({ onPromptSelect }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-6 pt-6">
        {/* Suggested prompts for Chat tab */}
        <div className="space-y-3">
          {advancedTabsProperties.chat.prompts.map((prompt) => (
            <div
              key={prompt.content}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
              onClick={() => {
                onPromptSelect(prompt.content);
              }}
            >
              <div className="flex items-start gap-3">
                {/* {renderIcon({ icon: prompt.icon })} */}
                <span className="text-sm leading-relaxed text-gray-700">
                  {prompt.summary}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
