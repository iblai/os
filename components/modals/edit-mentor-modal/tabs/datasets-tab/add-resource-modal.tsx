'use client';

import React from 'react';
import Script from 'next/script';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ResourceType, resourceTypes } from './resource-types';
import { ResourceModal } from './resource-modal';
import { cn } from '@/lib/utils';
import useGoogleDrivePicker from '@/hooks/use-google-drive-picker';
import useDropboxPicker from '@/hooks/use-dropdox-picker';
import useOneDrivePicker from '@/hooks/use-one-drive-picker';
import { config } from '@/lib/config';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  keepParentOpen?: boolean;
}

export function AddResourceModal({ isOpen, onClose }: AddResourceModalProps) {
  const t = useTranslations('datasetsTabAddResourceModal');
  const [selectedResource, setSelectedResource] =
    React.useState<ResourceType | null>(null);

  const dropbox = useDropboxPicker({ autoShow: false });
  const {
    handlePickerOpen,
    loadGoogleApiScript,
    isPickerLoaded,
    forceClosePickerModal,
    pickerError,
    credentialsLoaded: googleCredentialsLoaded,
    isConfigured: googleIsConfigured,
  } = useGoogleDrivePicker();
  const oneDrive = useOneDrivePicker();
  const disabledDatasets = config.disabedDatasets().split('|');

  // A cloud provider only works once the tenant has OAuth credentials for it
  // (GET .../integration-credential/?name=<provider>). Without them the SDK is
  // handed an empty client id and the click does nothing at all — no popup, no
  // error — which reads as a broken button. Disable and say why instead.
  // `loaded` gates on the lookup having finished so the buttons are not
  // disabled during the in-flight fetch.
  const cloudProviders: Record<
    string,
    { loaded: boolean; configured: boolean }
  > = {
    'google-drive': {
      loaded: googleCredentialsLoaded,
      configured: googleIsConfigured,
    },
    onedrive: {
      loaded: oneDrive.credentialsLoaded,
      configured: oneDrive.isConfigured,
    },
    dropbox: {
      loaded: dropbox.credentialsLoaded,
      configured: dropbox.isConfigured,
    },
  };

  return (
    <>
      <Script
        src="https://apis.google.com/js/api.js"
        onLoad={loadGoogleApiScript}
        strategy="lazyOnload"
      />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>{t('addResources')}</DialogTitle>
          </DialogHeader>

          <div className="pt-4">
            <div>
              <p className="mb-6 text-gray-600">{t('description')}</p>

              {pickerError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-red-800">
                        {t('googleDrivePickerError')}
                      </h4>
                      <p className="mt-1 text-sm text-red-600">{pickerError}</p>
                    </div>
                    <button
                      onClick={forceClosePickerModal}
                      className="ml-4 rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-800 hover:bg-red-200"
                    >
                      {t('forceClosePicker')}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {resourceTypes.map((resource) => {
                  const cloudProvider = cloudProviders[resource.id];
                  const notConfigured = cloudProvider
                    ? cloudProvider.loaded && !cloudProvider.configured
                    : false;
                  const isDisabled =
                    !resource.isActive ||
                    disabledDatasets.includes(resource.id.toLowerCase()) ||
                    notConfigured;

                  return (
                    <button
                      key={resource.id}
                      title={notConfigured ? t('notConfigured') : undefined}
                      className={cn(
                        'flex items-center rounded-lg border p-4 transition-colors duration-200 hover:bg-gray-50',
                        !isDisabled
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed opacity-50',
                      )}
                      onClick={() => {
                        if (resource.type !== 'link') {
                          setSelectedResource(resource);
                          return;
                        }
                        if (resource.name === 'Google Drive') {
                          if (isPickerLoaded) {
                            handlePickerOpen();
                          } else {
                            // Show loading state or toast
                            console.log('Google Picker is still loading...');
                          }
                          return;
                        }
                        if (resource.name === 'Dropbox') {
                          dropbox.openChooser();
                          return;
                        }
                        if (resource.name === 'Microsoft OneDrive') {
                          oneDrive.pickOneDriveFile();
                          return;
                        }
                      }}
                      disabled={isDisabled}
                    >
                      <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-100">
                        {resource.icon}
                      </div>
                      <span className="flex flex-col items-start text-left">
                        <span className="text-gray-700">{resource.name}</span>
                        {notConfigured && (
                          <span className="text-xs text-gray-500">
                            {t('notConfigured')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {selectedResource && (
        <ResourceModal
          resource={selectedResource}
          isOpen={!!selectedResource}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </>
  );
}
