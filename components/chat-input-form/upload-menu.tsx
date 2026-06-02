'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus } from 'lucide-react';

import { UploadIcon } from '@/components/icons/svg-icons';
import { useShowAttachment } from '@/hooks/use-show-attachment';

interface UploadMenuProps {
  onFileInputTrigger: () => void;
  disabled?: boolean;
}

export const UploadMenu = ({
  onFileInputTrigger,
  disabled = false,
}: UploadMenuProps) => {
  const showAttachment = useShowAttachment();

  const uploadMenuItems = [
    // {
    //   name: 'Upload from phone',
    //   icon: <Smartphone className="h-5 w-5 text-gray-600" />,
    //   action: () => console.log('Upload from phone clicked'),
    // },
    {
      name: 'Upload File',
      icon: <UploadIcon className="h-5 w-5 text-gray-600" />,
      action: onFileInputTrigger,
    },
    // {
    //   name: 'Google Drive',
    //   icon: (
    //     <Image
    //       src="/icons/google-drive.svg"
    //       alt="Google Drive"
    //       width={20}
    //       height={20}
    //     />
    //   ),
    //   action: () => console.log('Google Drive clicked'),
    // },
    // {
    //   name: 'Microsoft OneDrive',
    //   icon: <OneDriveIcon className="h-5 w-5 text-gray-600" />,
    //   action: () => console.log('OneDrive clicked'),
    // },
    // {
    //   name: 'Website',
    //   icon: <Globe className="h-5 w-5 text-gray-600" />,
    //   action: () => console.log('Website clicked'),
    // },
  ];

  if (!showAttachment) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Attach file"
          className="h-8 w-8 rounded-lg text-gray-600 transition-all duration-200 hover:border hover:border-[#38A1E5] hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">Attach file</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-50 w-56 p-2">
        {uploadMenuItems.map((item) => (
          <DropdownMenuItem
            key={item.name}
            onClick={item.action}
            className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:border-[#38A1E5] hover:bg-gray-50"
          >
            {item.icon}
            <span className="text-gray-700">{item.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
