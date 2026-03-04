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
        'w-full flex items-center gap-2 px-2 py-1 h-8 hover:bg-[#c9d8f8] rounded-md pl-4',
        isActive && 'bg-[#c9d8f8] hover:bg-[#c9d8f8]',
      )}
      onClick={onClick}
    >
      <Avatar className="h-4 w-4">
        <AvatarImage src={avatar} alt={title} />
        <AvatarFallback className="text-[0.625rem]">{title.substring(0, 2)}</AvatarFallback>
      </Avatar>
      <span className="text-sm text-gray-700 text-left flex-1 pr-8 overflow-hidden text-ellipsis whitespace-nowrap">
        {title}
      </span>
    </Button>
  );
}
