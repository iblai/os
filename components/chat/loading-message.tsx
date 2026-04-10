'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface LoadingMessageProps {
  mentorName: string;
  profileImage: string;
}

export function LoadingMessage({
  mentorName,
  profileImage,
}: LoadingMessageProps) {
  return (
    <div className="mb-4">
      <div className="ml-0 flex items-center">
        <div className="relative mr-2 flex-shrink-0 sm:mr-3">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
          <Avatar className="h-7 w-7 rounded-full border border-transparent p-[1px] sm:h-8 sm:w-8">
            <AvatarImage src={profileImage} alt={mentorName} />
            <AvatarFallback>
              {mentorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <span className="text-sm text-gray-700">Just a sec...</span>
      </div>
    </div>
  );
}
