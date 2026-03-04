import React from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

import { Edit, Info } from 'lucide-react';
import {
  useEditMentorMutation,
  useGetDisclaimersQuery,
  useGetMentorSettingsQuery,
  useCreateDisclaimerMutation,
  useUpdateDisclaimerMutation,
} from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CopyButton } from '@/components/modals/edit-mentor-modal/tabs/prompts-tab/copy-button';
import WithFormPermissions, { WithPermissions } from '@/hoc/withPermissions';
import { parsePrompt } from '@/lib/utils';
import Markdown from '@/components/markdown';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { toast } from 'sonner';
import { useNavigate } from '@/hooks/user-navigate';
import { DEFAULT_DISCLAIMER_CONTENT } from '@/constants/disclaimer';

const EditDisclaimerModal = dynamic(
  () => import('./edit-disclaimer-modal').then((mod) => mod.EditDisclaimerModal),
  {
    ssr: false,
  },
);

const EditUserAgreementModal = dynamic(
  () => import('./edit-user-agreement-modal').then((mod) => mod.EditUserAgreementModal),
  {
    ssr: false,
  },
);

export function DisclaimersTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;
  const [editMentor, { isLoading: isEditMentorLoading }] = useEditMentorMutation();
  const [createDisclaimer, { isLoading: isCreateDisclaimerLoading }] =
    useCreateDisclaimerMutation();
  const [updateDisclaimer, { isLoading: isUpdateDisclaimerLoading }] =
    useUpdateDisclaimerMutation();
  const [isEditDisclaimerModalOpen, setIsEditDisclaimerModalOpen] = React.useState(false);
  const [isEditUserAgreementModalOpen, setIsEditUserAgreementModalOpen] = React.useState(false);

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? '',
    },
    {
      skip: !mentorId || !tenantKey || !username,
    },
  );

  const { data: disclaimers, isLoading: isDisclaimersLoading } = useGetDisclaimersQuery({
    org: tenantKey,
    userId: username ?? '',
    params: {
      mentor_id: mentorId,
      scope: 'mentor',
    },
  });

  // const isDisclaimerDisabled = isMentorSettingsLoading || isEditMentorLoading;
  const isUserAgreementDisabled =
    isDisclaimersLoading || isCreateDisclaimerLoading || isUpdateDisclaimerLoading;

  const userAgreementRecord =
    disclaimers?.results?.length && disclaimers?.results?.length > 0
      ? disclaimers?.results[0]
      : null;

  const userAgreement = userAgreementRecord ?? {
    content: DEFAULT_DISCLAIMER_CONTENT,
    active: false,
  };

  // const setSelectedPrompt = (props: any) => {};

  // async function toggleSafetyDisclaimer(value: boolean, callback?: () => void) {
  //   try {
  //     await executeWithTrialCheck(async () => {
  //       await editMentor({
  //         mentor: activeMentorId,
  //         org: tenantKey,
  //         // @ts-ignore
  //         userId: username ?? '',
  //         formData: { metadata: { safety_disclaimer: value } },
  //       }).unwrap();
  //       toast.success('Mentor updated successfully');
  //       callback?.();
  //     });
  //   } catch (error) {
  //     console.error(JSON.stringify(error));;
  //     toast.error('Failed to update mentor');
  //     Sentry.captureException(String(error));
  //   }
  // }

  async function handleSaveDisclaimer(content: string) {
    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        // @ts-ignore disclaimer not in type of MentorSettingsPublic
        formData: { disclaimer: content },
      }).unwrap();
      toast.success('Mentor updated successfully');
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to update mentor');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  async function handleSaveUserAgreement(content: string) {
    try {
      const hasOneDisclaimer = Boolean(userAgreementRecord);

      if (hasOneDisclaimer && userAgreementRecord?.id) {
        // edit the first disclaimer
        await updateDisclaimer({
          id: userAgreementRecord?.id,
          org: tenantKey,
          userId: username ?? '',
          formData: { content },
        }).unwrap();
      } else {
        // create a new disclaimer
        await createDisclaimer({
          org: tenantKey,
          userId: username ?? '',
          formData: {
            content: content ?? DEFAULT_DISCLAIMER_CONTENT,
            mentors: [mentorId],
            scope: 'mentor',
          },
        }).unwrap();
      }

      toast.success('User agreement updated successfully');
      setIsEditUserAgreementModalOpen(false);
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to update user agreement');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  async function toggleUserAgreement({ active, content }: { active: boolean; content?: string }) {
    try {
      const disclaimerExists = Boolean(userAgreementRecord);
      if (disclaimerExists && userAgreementRecord?.id) {
        await updateDisclaimer({
          id: userAgreementRecord.id,
          org: tenantKey,
          userId: username ?? '',
          formData: { active },
        }).unwrap();
      } else {
        await createDisclaimer({
          org: tenantKey,
          userId: username ?? '',
          formData: {
            content: content ?? DEFAULT_DISCLAIMER_CONTENT,
            active,
            mentors: [mentorId],
            scope: 'mentor',
          },
        }).unwrap();
      }

      toast.success(`User agreement ${active ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to update user agreement');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  return (
    <>
      <div className="flex lg:block flex-shrink-0 p-4 border-b border-gray-200 bg-white h-[73px] items-center">
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Disclaimers</h3>
          <p className="text-gray-600 text-xs">Configure disclaimer settings for your mentor.</p>
        </div>
      </div>
      <div className="space-y-6 flex-1 p-3 lg:p-4 overflow-y-auto">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* User Agreement */}
          <WithPermissions rbacResource={`/mentors/${mentorSettings?.mentor_id}/#view_disclaimers`}>
            {({ hasPermission }) =>
              hasPermission && (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">User Agreement</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger aria-label="More info about user agreement">
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>Controls User Agreement</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">
                        {userAgreement.active ? 'Active' : 'Inactive'}
                      </span>
                      <Switch
                        checked={userAgreement.active}
                        onCheckedChange={async (checked) => {
                          await toggleUserAgreement({
                            active: checked,
                            content: userAgreement.content,
                          });
                        }}
                        aria-label={`User agreement ${userAgreement.active ? 'enabled' : 'disabled'}`}
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-4">
                    <div className="mt-1 flex-shrink-0">📝</div>
                    <div className="flex h-[180px] flex-1 flex-col">
                      <div
                        className="mb-4 flex-grow overflow-y-auto"
                        tabIndex={0}
                        role="region"
                        aria-label="User agreement content"
                      >
                        <Markdown className="text-sm text-gray-700">
                          {parsePrompt(userAgreement.content ?? '')}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 py-5"
                      onClick={() => setIsEditUserAgreementModalOpen(true)}
                      disabled={isUserAgreementDisabled}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <CopyButton text={userAgreement.content ?? ''} />
                  </div>
                </div>
              )
            }
          </WithPermissions>

          {/* Advisory */}
          {/* @ts-ignore disclaimer not in type of MentorSettingsPublic */}
          <WithFormPermissions name="disclaimer" permissions={mentorSettings?.permissions?.field}>
            {({ disabled }) => (
              <div className="overflow-hidden rounded-lg bg-gray-50">
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900">Advisory</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger aria-label="More info about Advisory">
                          <Info className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent className="ibl-tooltip-content">
                          <p>Controls Advisory</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {/* <WithFormPermissions
                    name="safety_disclaimer"
                    // @ts-ignore permissions.field not in type of MentorSettingsPublic
                    permissions={mentorSettings?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {mentorSettings?.metadata?.safety_disclaimer ? 'Active' : 'Inactive'}
                        </span>
                        <Switch
                          // @ts-ignore safety_disclaimer not in type of MentorSettingsPublic
                          checked={mentorSettings?.metadata?.safety_disclaimer}
                          onCheckedChange={async (checked) => {
                            await toggleSafetyDisclaimer(checked);
                          }}
                          disabled={isDisabled || disabled}
                          // @ts-ignore safety_disclaimer not in type of MentorSettingsPublic
                          aria-label={`Advisory ${mentorSettings?.metadata?.safety_disclaimer ? 'enabled' : 'disabled'}`}
                        />
                      </div>
                    )}
                  </WithFormPermissions> */}
                </div>
                <div className="flex items-start gap-2 p-4">
                  <div className="mt-1 flex-shrink-0">📝</div>
                  <div className="flex h-[180px] flex-1 flex-col">
                    <div
                      className="mb-4 flex-grow overflow-y-auto"
                      tabIndex={0}
                      role="region"
                      aria-label="Advisory content"
                    >
                      <Markdown className="text-sm text-gray-700">
                        {/* @ts-ignore disclaimer not in type of MentorSettingsPublic */}
                        {parsePrompt(mentorSettings?.disclaimer ?? '')}
                      </Markdown>
                    </div>
                  </div>
                </div>
                <div className="flex w-full gap-2 px-4 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 py-5"
                    disabled={disabled}
                    onClick={() => setIsEditDisclaimerModalOpen(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <CopyButton
                    // @ts-ignore disclaimer not in type of MentorSettingsPublic
                    text={mentorSettings?.disclaimer ?? ''}
                  />
                </div>
              </div>
            )}
          </WithFormPermissions>
        </div>
      </div>

      <EditDisclaimerModal
        open={isEditDisclaimerModalOpen}
        onOpenChange={setIsEditDisclaimerModalOpen}
        // @ts-ignore disclaimer not in type of MentorSettingsPublic
        disclaimer={mentorSettings?.disclaimer ?? ''}
        onSave={handleSaveDisclaimer}
        onCancel={() => setIsEditDisclaimerModalOpen(false)}
        isSaving={isEditMentorLoading}
      />

      <EditUserAgreementModal
        open={isEditUserAgreementModalOpen}
        onOpenChange={setIsEditUserAgreementModalOpen}
        content={userAgreement.content ?? ''}
        onSave={handleSaveUserAgreement}
        onCancel={() => setIsEditUserAgreementModalOpen(false)}
        isSaving={isUserAgreementDisabled}
      />
    </>
  );
}
