import React from 'react';

import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Eye, EyeOff, Clock } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { useEditTrainingDocumentMutation } from '@iblai/iblai-js/data-layer';
import { useUsername } from '@/hooks/use-user';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import WithFormPermissions from '@/hoc/withPermissions';

const DeleteDatasetModal = dynamic(() =>
  import('./delete-dataset-modal').then((mod) => ({ default: mod.DeleteDatasetModal })),
);
const RetrainScheduleModal = dynamic(() =>
  import('./retrain-schedule-modal').then((mod) => ({ default: mod.RetrainScheduleModal })),
);
const TrainOrDeleteModal = dynamic(() =>
  import('./train-or-delete-modal').then((mod) => ({ default: mod.TrainOrDeleteModal })),
);

type EditTrainingDocument = {
  access?: 'public' | 'private';
  pathway?: string;
  url?: string;
  train?: boolean;
};

export type Dataset = {
  id: string;
  url: string;
  document_name: string;
  document_type: string;
  tokens: number;
  is_trained: boolean;
  access: string;
  pathway: string;
  training_status: string;
};

type Props = {
  dataset: Dataset;
  onSelect?: (dataset: Dataset) => void;
  isSelected?: boolean;
};

export function DatasetItem({ dataset, onSelect, isSelected }: Props) {
  const [isDeleteDatasetModalOpen, setIsDeleteDatasetModalOpen] = React.useState(false);
  const [isRetrainScheduleModalOpen, setIsRetrainScheduleModalOpen] = React.useState(false);
  const [isTrainOrDeleteModalOpen, setIsTrainOrDeleteModalOpen] = React.useState(false);
  const username = useUsername();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const [editTrainingDocument, { isLoading: isEditTrainingDocumentLoading }] =
    useEditTrainingDocumentMutation();

  const handleEditTrainingDocument = async (data: EditTrainingDocument, callback?: () => void) => {
    try {
      await editTrainingDocument({
        documentId: dataset.id,
        org: tenantKey,
        // @ts-expect-error - access enum type compatibility issue with API request type
        formData: {
          ...data,
          pathway: dataset.pathway,
        },
        userId: username ?? '',
      }).unwrap();
      toast.success('Training document updated successfully');
      callback?.();
    } catch (error) {
      toast.error('Failed to update training document');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const handleTrainDataset = async () => {
    await handleEditTrainingDocument({
      url: dataset.url,
      train: true,
    });
    setIsTrainOrDeleteModalOpen(false);
  };

  const handleDeleteFromTrainModal = () => {
    setIsTrainOrDeleteModalOpen(false);
    setIsDeleteDatasetModalOpen(true);
  };

  // Helper function to check if retrain should be disabled
  const isRetrainDisabled = () => {
    // Disable if the dataset is not trained yet
    if (!dataset.is_trained) {
      return true;
    }

    const docType = dataset.document_type?.toLowerCase();

    // Disable for uploaded documents (local files like PDF, DOCX, etc.)
    const uploadedFileTypes = ['file'];
    if (uploadedFileTypes.some((type) => docType?.includes(type))) {
      return true;
    }

    // Disable for cloud storage providers
    const cloudProviders = ['google drive', 'onedrive', 'dropbox', 'one drive'];
    if (cloudProviders.some((provider) => docType?.includes(provider))) {
      return true;
    }

    return false;
  };

  return (
    <>
      <TableRow
        key={dataset.id}
        className={`border-b last:border-0 ${onSelect ? 'cursor-pointer hover:bg-muted/50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
        onClick={onSelect ? () => onSelect(dataset) : undefined}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <TableCell className="p-3 font-medium whitespace-nowrap text-[#646464] truncate max-w-[200px]">
              <WithFormPermissions
                name={['document_name', 'url']}
                // @ts-ignore
                permissions={dataset?.permissions?.field}
              >
                {() => (
                  <a
                    href={dataset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {dataset.document_name || dataset.url}
                  </a>
                )}
              </WithFormPermissions>
            </TableCell>
          </TooltipTrigger>
          <TooltipContent className="bg-gray-700 px-3 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-opacity duration-300">
            <p>{dataset.document_name || dataset.url}</p>
          </TooltipContent>
        </Tooltip>
        <TableCell className="p-3 whitespace-nowrap text-[#646464]">
          <WithFormPermissions
            name="document_type"
            // @ts-ignore
            permissions={dataset?.permissions?.field}
          >
            {() => (
              <>
                {dataset.document_type
                  ?.toUpperCase()
                  ?.replace('.PDF', 'PDF')
                  .replace('.URL', 'URL')}
              </>
            )}
          </WithFormPermissions>
        </TableCell>
        <TableCell className="p-3 whitespace-nowrap text-[#646464]">
          <WithFormPermissions
            name="tokens"
            // @ts-ignore
            permissions={dataset?.permissions?.field}
          >
            {() => <>{dataset.tokens ?? 0}</>}
          </WithFormPermissions>
        </TableCell>
        <TableCell className="p-3 whitespace-nowrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button
                  variant="ghost"
                  className="cursor-pointer text-gray-500 hover:text-gray-700"
                  disabled={isRetrainDisabled()}
                  onClick={() => setIsRetrainScheduleModalOpen(true)}
                >
                  <Clock className="h-4 w-4" />
                  <span className="sr-only">Schedule retrain</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-700 px-3 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-opacity duration-300">
              <p>
                {isRetrainDisabled()
                  ? 'This document cannot be retrained'
                  : 'Schedule automatic retraining for this dataset'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="p-3 whitespace-nowrap">
          <WithFormPermissions
            name="access"
            // @ts-ignore
            permissions={dataset?.permissions?.field}
          >
            {({ disabled }) => (
              <Button
                variant="ghost"
                onClick={() => {
                  if (dataset.access === 'private') {
                    handleEditTrainingDocument({
                      access: 'public',
                    });
                  } else {
                    handleEditTrainingDocument({
                      access: 'private',
                    });
                  }
                }}
                className="text-gray-500 hover:text-gray-700"
                disabled={isEditTrainingDocumentLoading || disabled}
              >
                {dataset.access === 'private' ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span className="sr-only">Make public</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Make private</span>
                  </>
                )}
              </Button>
            )}
          </WithFormPermissions>
        </TableCell>
        <TableCell className="p-3 whitespace-nowrap">
          <WithFormPermissions
            name="is_trained"
            // @ts-ignore
            permissions={dataset?.permissions?.field}
          >
            {({ disabled }) => (
              <TrainingStatusSwitch
                is_trained={dataset.is_trained}
                url={dataset.url}
                disabled={disabled}
                training_status={dataset.training_status}
                handleEditTrainingDocument={handleEditTrainingDocument}
                onUntrainSuccess={() => setIsDeleteDatasetModalOpen(true)}
                onTrainRequest={() => setIsTrainOrDeleteModalOpen(true)}
              />
            )}
          </WithFormPermissions>
        </TableCell>
      </TableRow>

      {isDeleteDatasetModalOpen && (
        <DeleteDatasetModal
          isOpen={isDeleteDatasetModalOpen}
          onClose={() => setIsDeleteDatasetModalOpen(false)}
          dataset={dataset}
        />
      )}

      {isRetrainScheduleModalOpen && (
        <RetrainScheduleModal
          isOpen={isRetrainScheduleModalOpen}
          onClose={() => setIsRetrainScheduleModalOpen(false)}
          dataset={dataset}
        />
      )}

      {isTrainOrDeleteModalOpen && (
        <TrainOrDeleteModal
          isOpen={isTrainOrDeleteModalOpen}
          onClose={() => setIsTrainOrDeleteModalOpen(false)}
          onTrain={handleTrainDataset}
          onDelete={handleDeleteFromTrainModal}
          isLoading={isEditTrainingDocumentLoading}
        />
      )}
    </>
  );
}

function TrainingStatusSwitch({
  is_trained,
  url,
  training_status,
  disabled,
  handleEditTrainingDocument,
  onUntrainSuccess,
  onTrainRequest,
}: {
  is_trained: boolean;
  url: string;
  training_status: string;
  disabled: boolean;
  handleEditTrainingDocument: (data: EditTrainingDocument, callback?: () => void) => void;
  onUntrainSuccess?: () => void;
  onTrainRequest?: () => void;
}) {
  if (training_status === 'pending') {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700">
        In Progress
      </Badge>
    );
  }

  return (
    <Switch
      checked={is_trained}
      onCheckedChange={() => {
        // If trying to train an untrained dataset, show the modal
        if (!is_trained) {
          onTrainRequest?.();
          return;
        }

        // If untraining, proceed with the untrain action
        handleEditTrainingDocument(
          {
            url,
            train: false,
          },
          () => {
            onUntrainSuccess?.();
          },
        );
      }}
      disabled={disabled}
      aria-label={is_trained ? 'Disable training for document' : 'Enable training for document'}
    />
  );
}