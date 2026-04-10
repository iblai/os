import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { selectActiveTab, type Prompt } from '@iblai/iblai-js/web-utils';
import { useSelector } from 'react-redux';

type Props = {
  title: string;
  description: string;
  metaDescription: string;
  options: Prompt[];
  onOptionSelect: (tab: any, option: string) => void;
  profileImage: string;
  mentorName: string;
};

export function OptionsTag({
  title,
  description,
  metaDescription,
  options,
  onOptionSelect,
  profileImage,
  mentorName,
}: Props) {
  const activeTab = useSelector(selectActiveTab);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-6 pt-6">
        <h2 className="mb-6 text-sm font-medium text-gray-800">{title}</h2>

        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-blue-500">
              <AvatarImage src={profileImage} alt={mentorName} />
              <AvatarFallback className="bg-blue-400 text-white">
                {mentorName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-600">{description}</span>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-medium text-gray-700">
            {metaDescription}
          </h3>
          <div className="space-y-3 text-sm">
            {options.map((option, idx) => (
              <button
                key={idx}
                className="w-full rounded-lg bg-blue-100 px-4 py-3 text-left font-medium text-blue-700 transition-colors hover:bg-blue-200"
                onClick={() => onOptionSelect(activeTab, option.content ?? '')}
              >
                {option.summary}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
