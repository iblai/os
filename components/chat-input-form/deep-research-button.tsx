import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DeepSearchIcon } from '../icons/svg-icons';
import { TOOLS } from '@iblai/iblai-js/web-utils';

type Props = {
  isActive: boolean;
  activeTools: string[];
  updateSessionTools: (tool: string) => Promise<void>;
};

export function DeepResearchButton({ isActive, updateSessionTools, activeTools }: Props) {
  const isActiveTool = activeTools.includes(TOOLS.DEEP_RESEARCH);

  if (!isActive) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className={`h-8 px-2 text-sm rounded-lg flex items-center gap-1.5 transition-all duration-200 ${
          isActiveTool
            ? 'text-[#38A1E5] bg-[#F5F8FF] border border-[#D0E0FF]'
            : 'text-gray-600 hover:bg-[#F5F8FF] hover:border hover:border-[#D0E0FF]'
        }`}
        onClick={() => {
          updateSessionTools(TOOLS.DEEP_RESEARCH);
        }}
      >
        <span className={isActiveTool ? 'text-[#38A1E5]' : 'text-gray-600'}>
          <DeepSearchIcon />
        </span>
        Deep Research
        {isActiveTool && (
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              updateSessionTools(TOOLS.DEEP_RESEARCH);
            }}
          >
            <X className="h-3 w-3 ml-1 cursor-pointer" />
          </span>
        )}
      </Button>
    </>
  );
}
