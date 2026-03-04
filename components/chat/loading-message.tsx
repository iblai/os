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
      <div className="flex items-center ml-0">
        <div className="flex-shrink-0 mr-2 sm:mr-3 relative">
          <div className="absolute inset-0 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin"></div>
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-transparent p-[1px] rounded-full">
            <AvatarImage src={profileImage} alt={mentorName} />
            <AvatarFallback>
              {mentorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <span className="text-gray-700 text-sm">Just a sec...</span>
      </div>
    </div>
  );
}
