'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { format, formatDistanceToNow } from 'date-fns';
import { Search, Users } from 'lucide-react';
import { useDebounce } from 'use-debounce';

import { useGetDisclaimerAgreementsQuery } from '@iblai/iblai-js/data-layer';

import IblPagination from '@/components/ibl-pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const PAGE_SIZE = 20;

interface AgreementsBodyProps {
  org: string;
  userId: string;
  mentorId: string;
  disclaimerId: string;
}

interface AgreementsModalProps extends AgreementsBodyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgreementsModal({
  open,
  onOpenChange,
  ...bodyProps
}: AgreementsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The body mounts only while open so search and page reset on reopen. */}
      {open && <AgreementsBody {...bodyProps} />}
    </Dialog>
  );
}

function AgreementsBody({
  org,
  userId,
  mentorId,
  disclaimerId,
}: AgreementsBodyProps) {
  const t = useTranslations('disclaimersTabAgreements');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [pageSearchTerm, setPageSearchTerm] = useState(debouncedSearchTerm);

  // A new search always starts from the first page. Adjusting during render
  // (not in an effect) means no render is committed -- and no request fired --
  // with the new term and the old page.
  if (pageSearchTerm !== debouncedSearchTerm) {
    setPageSearchTerm(debouncedSearchTerm);
    setPage(1);
  }

  const { data, isLoading, isFetching } = useGetDisclaimerAgreementsQuery(
    {
      org,
      userId,
      params: {
        disclaimer: disclaimerId,
        mentor_id: mentorId,
        username: debouncedSearchTerm || undefined,
        page,
        page_size: PAGE_SIZE,
      },
    },
    // Other users' agreements land in other clients, so the cached list goes
    // stale without any invalidation here; always refetch on (re)open.
    { refetchOnMountOrArgChange: true },
  );

  const agreements = data?.results ?? [];
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // An empty list is either nobody agreed yet or a search miss.
  const emptyState = debouncedSearchTerm
    ? {
        Icon: Search,
        heading: 'noMatches',
        description: 'noMatchesDescription',
      }
    : { Icon: Users, heading: 'empty', description: 'emptyDescription' };

  return (
    <DialogContent
      className="flex h-[90vh] max-w-6xl flex-col p-0"
      data-testid="disclaimer-agreements"
    >
      <DialogHeader className="flex-shrink-0 border-b border-gray-200 px-6 pt-6 pb-4">
        <DialogTitle className="text-xl font-semibold text-gray-900">
          {t('title')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t('dialogDescription')}
        </DialogDescription>
      </DialogHeader>
      <div className="scrollbar-hide flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          <div
            className="rounded-lg border p-4"
            data-testid="disclaimer-agreements-summary"
          >
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <span
                className="font-semibold text-gray-900"
                data-testid="disclaimer-agreements-count"
              >
                {t('totalAgreements', { count })}
              </span>
            </div>
            <p
              className="text-sm leading-relaxed text-gray-900"
              role="note"
              data-testid="disclaimer-agreements-banner"
            >
              {t('summaryDescription')}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="relative">
              <Search
                className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-500"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchAriaLabel')}
                className="w-full pl-9"
                data-testid="disclaimer-agreements-search"
              />
            </div>
          </div>

          {isLoading ? (
            <div
              className="space-y-2"
              data-testid="disclaimer-agreements-loading"
              aria-busy="true"
            >
              {[0, 1, 2].map((key) => (
                <div
                  key={key}
                  className="h-9 animate-pulse rounded bg-gray-200"
                />
              ))}
            </div>
          ) : agreements.length === 0 ? (
            <div
              className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600 md:p-10"
              data-testid="disclaimer-agreements-empty"
            >
              <emptyState.Icon
                className="mx-auto mb-2 h-8 w-8 text-blue-600"
                aria-hidden="true"
              />
              <p className="font-medium text-gray-900">
                {t(emptyState.heading)}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {t(emptyState.description)}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columnUser')}</TableHead>
                    <TableHead className="w-0 whitespace-nowrap">
                      {t('columnAgreedAt')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements.map((agreement) => {
                    const agreedAt = new Date(agreement.agreed_at);
                    // Primary is the full name, falling back to the username.
                    // Secondary is the email, falling back to the username only
                    // when the primary is the name (never print it twice).
                    const primary =
                      agreement.user_full_name || agreement.user_id;
                    const secondary =
                      agreement.user_email ||
                      (primary !== agreement.user_id
                        ? agreement.user_id
                        : null);
                    return (
                      <TableRow
                        key={agreement.id}
                        data-testid="disclaimer-agreement-row"
                        data-username={agreement.user_id}
                      >
                        <TableCell>
                          <div
                            className="font-medium text-gray-900"
                            data-testid="disclaimer-agreement-user"
                          >
                            {primary}
                          </div>
                          {secondary && (
                            <div className="text-xs text-gray-500">
                              {secondary}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-gray-600">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {formatDistanceToNow(agreedAt, {
                                  addSuffix: true,
                                })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>
                                {format(agreedAt, "MMM dd, yyyy 'at' h:mm a")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <IblPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={isFetching}
          />
        </div>
      </div>
    </DialogContent>
  );
}
