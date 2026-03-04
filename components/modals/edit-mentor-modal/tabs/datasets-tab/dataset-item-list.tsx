import { DatasetItem, Dataset } from './dataset-item';
import { TableCell, TableRow, TableBody } from '@/components/ui/table';

type Props = {
  datasets: Dataset[];
};

export function DatasetItemList({ datasets }: Props) {
  return (
    <TableBody>
      {datasets?.length > 0 ? (
        datasets?.map((dataset) => <DatasetItem key={dataset.id} dataset={dataset} />)
      ) : (
        <TableRow>
          <TableCell colSpan={6} className="p-4 text-center text-[#646464]">
            No datasets found
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
}
