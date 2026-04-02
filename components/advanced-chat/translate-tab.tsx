import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type Props = {
  mentorName: string;
  profileImage: string;
  onLanguageSelect: (language: string) => void;
};

const languages = [
  {
    name: 'English',
    value: 'English',
  },
  {
    name: 'French (France)',
    value: 'French',
  },
  {
    name: 'Spanish (Español)',
    value: 'Spanish',
  },
];

export function TranslateTab({
  mentorName,
  profileImage,
  onLanguageSelect,
}: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-6 pt-6">
        <h2 className="mb-6 text-sm font-medium text-gray-800">Translate</h2>

        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-blue-500">
              <AvatarImage src={profileImage} alt={mentorName} />
              <AvatarFallback className="bg-blue-400 text-white">
                {mentorName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-600">
              Would you like me to translate?
            </span>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-medium text-gray-700">
            Suggested Languages:
          </h3>
          <div className="space-y-3 text-sm">
            {languages.map((language) => (
              <button
                key={language.value}
                className="w-full rounded-lg bg-blue-100 px-4 py-3 text-left font-medium text-blue-700 transition-colors hover:bg-blue-200"
                onClick={() => onLanguageSelect(language.value)}
              >
                {language.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
