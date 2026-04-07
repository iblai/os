'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Radio, FileText, ChevronRight } from 'lucide-react';

import { cn, isLoggedIn } from '@/lib/utils';
import { useAppSelector } from '@/lib/hooks';
import { useUsername } from '@/hooks/use-user';
import { selectStreaming } from '@iblai/iblai-js/web-utils';
import { useGetVectorDocumentsQuery } from '@iblai/iblai-js/data-layer';

interface DocumentSidebarProps {
  isModal?: boolean;
  sessionId: string;
}

export function DocumentSidebar({
  isModal = false,
  sessionId,
}: DocumentSidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
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

  React.useEffect(() => {
    if (!isStreaming && isLoggedIn() && status !== 'uninitialized') {
      refetch();
    }
  }, [isStreaming, refetch]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {vectorDocuments?.length && vectorDocuments.length > 0 ? (
        <aside
          className={cn(
            'transition-all duration-300 ease-in-out',
            isModal
              ? 'max-h-full w-full overflow-auto'
              : 'hidden rounded-tl-lg rounded-bl-lg md:hidden lg:block',
            !isModal && (isCollapsed ? 'w-[40px]' : 'w-[380px]'),
          )}
          style={{
            backgroundColor: isCollapsed && !isModal ? 'white' : '#F3F6FB',
            maxHeight: 'calc(100vh - 80px)',
          }}
        >
          <div className="flex h-full flex-col">
            {!isModal && (
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-b border-gray-200 p-4 transition-colors duration-200',
                  isCollapsed &&
                    'h-[80px] justify-center rounded-tl-[5px] rounded-bl-[5px] p-2',
                  'hover:bg-blue-100',
                )}
                onClick={toggleCollapse}
                style={{ backgroundColor: '#F3F6FB' }}
              >
                <FileText className="h-5 w-5 shrink-0 text-blue-600" />
                {!isCollapsed && (
                  <>
                    <h2 className="text-base font-medium text-[#646464]">
                      Retrieved Documents
                    </h2>
                    <ChevronRight
                      className={cn(
                        'ml-auto h-4 w-4 text-gray-400 transition-transform',
                        isCollapsed ? 'rotate-180' : '',
                      )}
                    />
                  </>
                )}
              </div>
            )}

            {(!isCollapsed || isModal) && (
              <>
                <div
                  className="flex-1 overflow-auto"
                  style={{ backgroundColor: '#F3F6FB' }}
                >
                  <div className="mt-0 space-y-1 p-2">
                    {vectorDocuments.map((doc, index) => (
                      <React.Fragment key={index}>
                        <div className="rounded-lg p-2 hover:bg-gray-50">
                          <div className="flex items-start gap-2">
                            <Radio className="mt-1 h-4 w-4 text-gray-400" />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <Link
                                  href={doc.source ?? ''}
                                  target="_blank"
                                  className="min-w-0"
                                >
                                  <span className="text-sm font-semibold break-words text-[#646464] hover:text-blue-600">
                                    {doc.title}
                                  </span>
                                </Link>
                                <div className="flex items-center gap-2 self-center">
                                  <span className="text-xs text-gray-500">
                                    {doc?.score?.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <p className="line-clamp-6 pt-[10px] text-[14px] text-gray-600">
                                {doc.snippet}
                              </p>
                            </div>
                          </div>
                        </div>
                        {index < vectorDocuments.length - 1 && (
                          <div className="my-2 border-t border-gray-200" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}
