'use client';

import React from 'react';
import { cn, isLoggedIn } from '@/lib/utils';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AuthPopover } from '@/components/auth-popover';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';

interface Props {
  contentItems: any[];
  isUserTypeAllowed: (item: any) => boolean;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  executeWithTrialCheck: (fn: () => void) => void;
  updateNavItemsForStudentsInMainOrAdvertisingTenant: (item: any) => any;
  tenantKey: string;
}

export const AppSidebarContent: React.FC<Props> = ({
  contentItems,
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
      {contentItems
        .map(updateNavItemsForStudentsInMainOrAdvertisingTenant)
        .filter(isUserTypeAllowed)
        .filter((item) => {
          // Skip RBAC check if user is not logged in or item has no rbacResource
          if (!userIsLoggedIn || !item.rbacResource) return true;
          return checkRbacPermission(rbacPermissions, item.rbacResource(0));
        })
        .map((item) => (
          <SidebarMenuItem
            key={item.label}
            className={cn('font-medium', {
              'grid place-content-center': !open && !openMobile,
            })}
          >
            {isMobile || open ? (
              <>
                {userIsLoggedIn ? (
                  <SidebarMenuButton
                    className={cn('cursor-pointer space-x-1 mb-1 text-gray-700', {
                      'border border-[#c9d8f8] flex items-center justify-center py-4 h-9':
                        item.hasBorder,
                      'hover:bg-[#c9d8f8]': !item.hasBorder,
                    })}
                    onClick={() => {
                      setOpenMobile(false);
                      if (item.isAnAdminAction) {
                        executeWithTrialCheck(() => item.onClick());
                        return;
                      }
                      item.onClick();
                    }}
                  >
                    <item.icon className="h-5 w-5 text-gray-500" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                ) : (
                  <>
                    {item.isAnAdminAction ? (
                      <AuthPopover tenantKey={tenantKey}>
                        <SidebarMenuButton
                          className={cn('cursor-pointer space-x-1 mb-1 text-gray-700', {
                            'border border-[#c9d8f8] flex items-center justify-center py-4 h-9':
                              item.hasBorder,
                            'hover:bg-[#c9d8f8]': !item.hasBorder,
                          })}
                        >
                          <item.icon className="h-5 w-5 text-gray-500" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </AuthPopover>
                    ) : (
                      <SidebarMenuButton
                        className={cn('cursor-pointer space-x-1 mb-1 text-gray-700', {
                          'border border-[#c9d8f8] flex items-center justify-center py-4 h-9':
                            item.hasBorder,
                          'hover:bg-[#c9d8f8]': !item.hasBorder,
                        })}
                        onClick={() => {
                          setOpenMobile(false);
                          item.onClick();
                        }}
                      >
                        <item.icon className="h-5 w-5 text-gray-500" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {userIsLoggedIn ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        className={cn('cursor-pointer text-gray-700 mb-0', {
                          'border border-[#c9d8f8]': item.hasBorder,
                          'hover:bg-[#c9d8f8]': !item.hasBorder,
                        })}
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
                  <>
                    {item.isAnAdminAction ? (
                      <Tooltip>
                        <AuthPopover tenantKey={tenantKey}>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              className={cn('cursor-pointer text-gray-700 mb-0', {
                                'border border-[#c9d8f8]': item.hasBorder,
                                'hover:bg-[#c9d8f8]': !item.hasBorder,
                              })}
                            >
                              <item.icon className="h-5 w-5" />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </TooltipTrigger>
                        </AuthPopover>
                        <TooltipContent className="ibl-tooltip-content" side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            className={cn('cursor-pointer text-gray-700 mb-0', {
                              'border border-[#c9d8f8]': item.hasBorder,
                              'hover:bg-[#c9d8f8]': !item.hasBorder,
                            })}
                            onClick={() => {
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
                    )}
                  </>
                )}
              </>
            )}
          </SidebarMenuItem>
        ))}
    </>
  );
};
