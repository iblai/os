'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProjectChatItemProps {
  title: string;
  avatar: string;
  onClick: () => void;
  isActive?: boolean;
}

export function ProjectChatItem({
  title,
  avatar,
  onClick,
  isActive = false,
}: ProjectChatItemProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-md px-2 py-1 pl-4 hover:bg-[#c9d8f8]',
        isActive && 'bg-[#c9d8f8] hover:bg-[#c9d8f8]',
      )}
      onClick={onClick}
    >
      <Avatar className="h-4 w-4">
        <AvatarImage src={avatar} alt={title} />
        <AvatarFallback className="text-[0.625rem]">
          {title.substring(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 overflow-hidden pr-8 text-left text-sm text-ellipsis whitespace-nowrap text-gray-700">
        {title}
      </span>
    </Button>
  );
}
