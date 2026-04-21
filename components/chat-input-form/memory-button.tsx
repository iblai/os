'use client';

import { useState } from 'react';
import { Archive, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { MemoryMenu } from './memory-menu';

interface MemoryButtonProps {
  tenantKey?: string;
  username?: string;
}

export function MemoryButton({ tenantKey, username }: MemoryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-all duration-200 ${
            isOpen
              ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]'
              : 'text-gray-600 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
          }`}
        >
          <span className={isOpen ? 'text-[#38A1E5]' : 'text-gray-600'}>
            <Archive className="h-4 w-4" />
          </span>
          Memory
          {isOpen && (
            <X
              className="ml-1 h-3 w-3 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 rounded-lg border border-gray-200 bg-white p-0 shadow-xl">
        <MemoryMenu
          onClose={() => setIsOpen(false)}
          tenantKey={tenantKey}
          username={username}
        />
      </PopoverContent>
    </Popover>
  );
}
