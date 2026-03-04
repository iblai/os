import React from 'react';
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn, isLoggedIn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AuthPopover } from '@/components/auth-popover';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';

interface Props {
  embedMode: boolean;
  footerItems: any[];
  isUserTypeAllowed: (item: any) => boolean;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  executeWithTrialCheck: (fn: () => void) => void;
  updateNavItemsForStudentsInMainOrAdvertisingTenant: (item: any) => any;
  tenantKey: string;
}

export const AppSidebarFooter: React.FC<Props> = ({
  embedMode,
  footerItems,
  isUserTypeAllowed,
  isMobile,
  open,
  openMobile,
  setOpenMobile,
  executeWithTrialCheck,
  updateNavItemsForStudentsInMainOrAdvertisingTenant,
  tenantKey,
}) => {
  const userIsLoggedIn = isLoggedIn();
  const rbacPermissions = useAppSelector(selectRbacPermissions);

  return (
    <>
      {!embedMode && (
        <SidebarFooter className="flex-none px-0">
          <SidebarMenu
            className={cn('grid px-4', {
              'place-content-center': !open && !openMobile,
            })}
          >
            {footerItems
              .map(updateNavItemsForStudentsInMainOrAdvertisingTenant)
              .filter(isUserTypeAllowed)
              .filter((item) => {
                // Skip RBAC check if user is not logged in or item has no rbacResource
                if (!userIsLoggedIn || !item.rbacResource) return true;
                return checkRbacPermission(rbacPermissions, item.rbacResource(0));
              })
              .map((item) => (
                <SidebarMenuItem key={item.label} className="font-medium">
                  {isMobile || open ? (
                    <>
                      {userIsLoggedIn ? (
                        <SidebarMenuButton
                          className="cursor-pointer space-x-1 text-gray-700 hover:bg-[#c9d8f8]"
                          onClick={() => {
                            setOpenMobile(false);
                            if (item.isAnAdminAction) {
                              executeWithTrialCheck(() => item.onClick());
                              return;
                            }
                            item.onClick();
                          }}
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      ) : (
                        <AuthPopover tenantKey={tenantKey}>
                          <SidebarMenuButton className="cursor-pointer space-x-1 text-gray-700 hover:bg-[#c9d8f8]">
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </AuthPopover>
                      )}
                    </>
                  ) : (
                    <>
                      {userIsLoggedIn ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              className="cursor-pointer space-x-1 text-gray-700 hover:bg-[#c9d8f8]"
                              onClick={() => {
                                if (item.isAnAdminAction) {
                                  executeWithTrialCheck(() => item.onClick());
                                  return;
                                }
                                item.onClick();
                              }}
                            >
                              <item.icon className="h-5 w-5" />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content" side="right">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <AuthPopover tenantKey={tenantKey}>
                            <TooltipTrigger asChild>
                              <SidebarMenuButton className="cursor-pointer space-x-1 text-gray-700 hover:bg-[#c9d8f8]">
                                <item.icon className="h-5 w-5" />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                            </TooltipTrigger>
                          </AuthPopover>
                          <TooltipContent className="ibl-tooltip-content" side="right">
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarFooter>
      )}
    </>
  );
};
