import { useState } from 'react';

import { Archive, X } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { MemoryMenu } from './memory-menu';

export function MemoryButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Popover open={isOpen} onOpenChange={() => setIsOpen(!isOpen)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className={`h-8 px-2 text-sm rounded-lg flex items-center gap-1.5 transition-all duration-200 ${
              isOpen
                ? 'text-[#38A1E5] bg-[#F5F8FF] border border-[#D0E0FF]'
                : 'text-gray-600 hover:bg-[#F5F8FF] hover:border hover:border-[#D0E0FF]'
            }`}
            onClick={() => {
              setIsOpen(true);
            }}
          >
            <span className={isOpen ? 'text-[#38A1E5]' : 'text-gray-600'}>
              <Archive />
            </span>
            Memory
            {isOpen && (
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => {
                  setIsOpen(false);
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-0">
          <MemoryMenu
            onClose={() => setIsOpen(false)}
            onSelectMemory={() => {}}
            selectedMemories={[]}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
