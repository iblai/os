'use client';

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentSidebar } from '@/components/document-sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGetVectorDocumentsQuery } from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { isLoggedIn } from '@/lib/utils';
import { useAppSelector } from '@/lib/hooks';
import { selectStreaming } from '@iblai/iblai-js/web-utils';
import { useUsername } from '@/hooks/use-user';

type Props = {
  sessionId: string;
};

export function RetrievedDocumentsButton({ sessionId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const params = useParams<{ tenantKey: string }>();
  const username = useUsername();
  const isStreaming = useAppSelector(selectStreaming);
  const {
    data: vectorDocuments,
    refetch,
    status,
  } = useGetVectorDocumentsQuery(
    {
      org: params.tenantKey,
      sessionId: sessionId,
      // @ts-ignore
      userId: username,
    },
    {
      skip: !params.tenantKey || !sessionId || !username || !isLoggedIn(),
    },
  );

  useEffect(() => {
    if (!isStreaming && isLoggedIn() && status !== 'uninitialized') {
      refetch();
    }
  }, [isStreaming, refetch]);

  if (!vectorDocuments?.length) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        onClick={() => setIsOpen(true)}
      >
        <FileText className="h-4 w-4 text-blue-600" />
        <span>Retrieved Documents</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-[425px] md:max-w-[600px]">
          <DialogHeader className="border-b px-4 py-2">
            <DialogTitle className="flex items-center gap-2 text-base font-medium text-[#646464]">
              <FileText className="h-5 w-5 text-blue-600" />
              Retrieved Documents
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <DocumentSidebar isModal={true} sessionId={sessionId} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
