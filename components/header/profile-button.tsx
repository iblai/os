import { ChevronDown, LogOut, User } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { handleLogout } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { handleTenantSwitch } from '@/lib/utils';
import { TenantSwitcher } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUserTenants } from '@/hooks/use-user';
import { useState } from 'react';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';

interface ProfileButtonProps {
  userImage: string;
  userName: string;
  onClick: () => void;
  onProfileClick: () => void;
  isInstructor: boolean;
  setIsInstructor: (value: boolean) => void;
  isMobile?: boolean;
}

export function ProfileButton({
  userImage,
  userName,
  onProfileClick,
  isInstructor,
  setIsInstructor,
  isMobile = false,
}: ProfileButtonProps) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const { userTenants } = useUserTenants();
  const [hideTenantSwitcher, setHideTenantSwitcher] = useState<boolean>(false);
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="flex h-8 w-8 items-center overflow-hidden rounded-full"
          aria-label="User profile"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={userImage} alt={userName} />
            <AvatarFallback>{userName}</AvatarFallback>
          </Avatar>
          <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="space-y-2">
        <DropdownMenuItem onSelect={onProfileClick}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        {isMobile && (
          <div className="px-2 py-2">
            <div className="flex items-center justify-between">
              <span
                className={`text-sm ${isInstructor ? 'text-gray-500' : 'font-semibold'}`}
              >
                Learner
              </span>
              <Switch
                checked={isInstructor}
                onCheckedChange={setIsInstructor}
                className="data-[state=checked]:bg-blue-500"
              />
              <span
                className={`text-sm ${isInstructor ? 'font-semibold' : 'text-gray-500'}`}
              >
                Instructor
              </span>
            </div>
          </div>
        )}
        {!hideTenantSwitcher && (
          <>
            <TenantSwitcher
              currentTenantKey={tenantKey}
              tenants={userTenants}
              onTenantChange={handleTenantSwitch}
              setHideTenantSwitcher={setHideTenantSwitcher}
              rbacPermissions={rbacPermissions}
            />
          </>
        )}
        <DropdownMenuItem onClick={() => handleLogout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
