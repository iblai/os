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

export const UploadMenu = ({ onFileInputTrigger, disabled = false }: UploadMenuProps) => {
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
          className="h-8 w-8 text-gray-600 hover:bg-[#F5F8FF] hover:border hover:border-[#38A1E5] rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">Attach File</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-2 z-50">
        {uploadMenuItems.map((item) => (
          <DropdownMenuItem
            key={item.name}
            onClick={item.action}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 hover:border-[#38A1E5] cursor-pointer"
          >
            {item.icon}
            <span className="text-gray-700">{item.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
