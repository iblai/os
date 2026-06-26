'use client';

import { useTranslations } from 'next-intl';

import { DatasetItem, Dataset } from './dataset-item';
import { TableCell, TableRow, TableBody } from '@/components/ui/table';

type Props = {
  datasets: Dataset[];
  onSelect?: (dataset: Dataset) => void;
  selectedDatasetId?: string;
};

export function DatasetItemList({
  datasets,
  onSelect,
  selectedDatasetId,
}: Props) {
  const t = useTranslations('datasetsTabDatasetItemList');
  return (
    <TableBody>
      {datasets?.length > 0 ? (
        datasets?.map((dataset) => (
          <DatasetItem
            key={dataset.id}
            dataset={dataset}
            onSelect={onSelect}
            isSelected={selectedDatasetId === dataset.id}
          />
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={6} className="p-4 text-center text-[#646464]">
            {t('noDatasetsFound')}
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}
