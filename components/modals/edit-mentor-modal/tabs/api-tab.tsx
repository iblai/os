import React from 'react';
import { Trash } from 'lucide-react';
import { format } from 'date-fns';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useGetApiKeysQuery } from '@iblai/iblai-js/data-layer';
import { CreateApiModal } from './api-tab/create-api-modal';
import { ApiKey, DeleteApiModal } from './api-tab/delete-api-modal';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { Spinner } from '@/components/spinner';
import { WithPermissions } from '@/hoc/withPermissions';

export function ApiTab() {
  const t = useTranslations('tabsApiTab');
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const { data: apiKeys, isLoading: isApiKeysLoading } = useGetApiKeysQuery({
    platformKey: tenantKey,
  });

  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();

  const [showCreateApiModal, setShowCreateApiModal] = React.useState(false);

  const [apiKeyToDelete, setApiKeyToDelete] = React.useState<ApiKey | null>(
    null,
  );

  function closeCreateApiModal() {
    setShowCreateApiModal(false);
  }

  function openCreateApiModal() {
    setShowCreateApiModal(true);
  }

  function closeDeleteApiModal() {
    setApiKeyToDelete(null);
  }

  function openDeleteApiModal(apiKey: ApiKey) {
    setApiKeyToDelete(apiKey);
  }

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">
            {t('apiHeading')}
          </h3>
          <p className="text-xs text-gray-700">
            {t('manageApiKeysDescription')}
          </p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 p-3 lg:p-4"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
          className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600"
          data-testid="api-info-box"
        >
          {t('infoBox')}
        </div>
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t('secretKeysListedBelow')}
            </p>
            <p className="text-sm text-gray-700">{t('doNotShareApiKey')}</p>
          </div>

          {isApiKeysLoading ? (
            <div className="flex w-full items-center justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-2 text-left text-sm text-gray-700">
                      {t('columnName')}
                    </TableHead>
                    <TableHead className="p-2 text-left text-sm text-gray-700">
                      {t('columnCreated')}
                    </TableHead>
                    <TableHead className="p-2 text-left text-sm text-gray-700">
                      {t('columnExpires')}
                    </TableHead>
                    <TableHead
                      className="p-2 text-left text-sm text-gray-700"
                      aria-label={t('columnActions')}
                    >
                      <span className="sr-only">{t('columnActions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="p-4 text-center text-sm text-gray-700"
                      >
                        {t('noApiKeysFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <WithPermissions rbacResource="/apitokens/#list">
                      {({ hasPermission }) => {
                        if (!hasPermission)
                          return (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="p-4 text-center text-sm text-gray-700"
                              >
                                {t('noPermissionToViewApiKeys')}
                              </TableCell>
                            </TableRow>
                          );

                        return (
                          <>
                            {apiKeys?.map((apiKey) => (
                              <TableRow
                                key={apiKey.name}
                                className="text-sm hover:bg-blue-50"
                              >
                                <TableCell className="p-2 whitespace-nowrap text-gray-700">
                                  {apiKey.name}
                                </TableCell>
                                <TableCell className="p-2 whitespace-nowrap text-gray-700">
                                  {apiKey.created
                                    ? format(apiKey.created, 'PPP')
                                    : t('notAvailable')}
                                </TableCell>
                                <TableCell className="p-2 whitespace-nowrap text-gray-700">
                                  {apiKey.expires
                                    ? format(apiKey.expires, 'PPP')
                                    : t('notAvailable')}
                                </TableCell>
                                <TableCell className="p-2">
                                  <WithPermissions
                                    rbacResource={`/apitokens/#create`}
                                  >
                                    {({ hasPermission }) =>
                                      hasPermission && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="cursor-pointer"
                                          onClick={() =>
                                            executeWithTrialCheck(() =>
                                              openDeleteApiModal({
                                                name: apiKey.name,
                                              }),
                                            )
                                          }
                                        >
                                          <Trash className="h-4 w-4" />
                                          <span className="sr-only">
                                            {t('deleteApiKey')}
                                          </span>
                                        </Button>
                                      )
                                    }
                                  </WithPermissions>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      }}
                    </WithPermissions>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <WithPermissions rbacResource={`/apitokens/#create`}>
            {(hasPermission) =>
              hasPermission && (
                <Button
                  onClick={openCreateApiModal}
                  className="cursor-pointer bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                >
                  {t('createNew')}
                </Button>
              )
            }
          </WithPermissions>

          <CreateApiModal
            isOpen={showCreateApiModal}
            onClose={closeCreateApiModal}
          />

          {apiKeyToDelete && (
            <DeleteApiModal
              isOpen={!!apiKeyToDelete}
              onClose={closeDeleteApiModal}
              apiKey={apiKeyToDelete}
            />
          )}

          {isModalOpen && FreeTrialDialog && (
            <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
          )}
        </div>
      </div>
    </>
  );
}
