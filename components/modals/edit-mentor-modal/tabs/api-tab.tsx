import React from 'react';
import { Trash } from 'lucide-react';
import { format } from 'date-fns';
import { useParams } from 'next/navigation';

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
          <h3 className="mb-1 text-base font-medium text-gray-900">API</h3>
          <p className="text-xs text-gray-700">
            Manage API keys and integrations.
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
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Your secret API keys are listed below. Please note that we do not
              display your secret API keys again after you generate them.
            </p>
            <p className="text-sm text-gray-700">
              Do not share your API key with others, or expose it in the browser
              or other client-side code. In order to protect the security of
              your account, IBL may also automatically rotate any API key that
              we&apos;ve found has leaked publicly.
            </p>
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
                      NAME
                    </TableHead>
                    <TableHead className="p-2 text-left text-sm text-gray-700">
                      CREATED
                    </TableHead>
                    <TableHead className="p-2 text-left text-sm text-gray-700">
                      EXPIRES
                    </TableHead>
                    <TableHead
                      className="p-2 text-left text-sm text-gray-700"
                      aria-label="Actions"
                    >
                      <span className="sr-only">Actions</span>
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
                        No API keys found
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
                                You do not have permission to view API keys
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
                                    : 'N/A'}
                                </TableCell>
                                <TableCell className="p-2 whitespace-nowrap text-gray-700">
                                  {apiKey.expires
                                    ? format(apiKey.expires, 'PPP')
                                    : 'N/A'}
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
                                            Delete API Key
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
                  Create New
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
