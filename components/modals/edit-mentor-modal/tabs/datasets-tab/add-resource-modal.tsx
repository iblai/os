'use client';

import React from 'react';
import Script from 'next/script';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [selectedResource, setSelectedResource] = React.useState<ResourceType | null>(null);

  const { openChooser } = useDropboxPicker({ autoShow: false });
  const {
    handlePickerOpen,
    loadGoogleApiScript,
    isPickerLoaded,
    forceClosePickerModal,
    pickerError,
  } = useGoogleDrivePicker();
  const { pickOneDriveFile } = useOneDrivePicker();
  const disabledDatasets = config.disabedDatasets().split('|');

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
            <DialogTitle>Add Resources</DialogTitle>
          </DialogHeader>

          <div className="pt-4">
            <div>
              <p className="mb-6 text-gray-600">
                Add knowledge to help your agent provide more relevant insights. Others with edit
                access can reuse these sources for more topics.
              </p>

              {pickerError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-red-800">
                        Google Drive Picker Error
                      </h4>
                      <p className="mt-1 text-sm text-red-600">{pickerError}</p>
                    </div>
                    <button
                      onClick={forceClosePickerModal}
                      className="ml-4 rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-800 hover:bg-red-200"
                    >
                      Force Close Picker
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {resourceTypes.map((resource) => (
                  <button
                    key={resource.id}
                    className={cn(
                      'flex items-center rounded-lg border p-4 transition-colors duration-200 hover:bg-gray-50',
                      resource.isActive && !disabledDatasets.includes(resource.id.toLowerCase())
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
                        openChooser();
                        return;
                      }
                      if (resource.name === 'Microsoft OneDrive') {
                        pickOneDriveFile();
                        return;
                      }
                    }}
                    disabled={
                      !resource.isActive || disabledDatasets.includes(resource.id.toLowerCase())
                    }
                  >
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-100">
                      {resource.icon}
                    </div>
                    <span className="text-gray-700">{resource.name}</span>
                  </button>
                ))}
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
