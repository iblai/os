'use client';

import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar, Download, Star, ChevronRight, Brain, Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn, textTruncate } from '@/lib/utils';
import Markdown from '@/components/markdown';
import IblPagination from '@/components/ibl-pagination';
import { useHistoryWithPagination } from '@/hooks/use-history';
import { useExportChatHistory } from '@/hooks/use-history/use-export-chat-history';
import { Spinner } from '@/components/spinner';
import {
  useGetMentorPublicSettingsQuery,
  useGetMentorSummariesQuery,
  useGetConversationMemoriesQuery,
} from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { useUsername } from '@/hooks/use-user';
import { useIsMobile } from '@/hooks/use-mobile';
import { ANONYMOUS_USERNAME } from '@/lib/constants';

interface Conversation {
  id: string;
  messages: Array<{ human: string; ai: string }>;
  topics: Array<{ name: string }>;
  sentiment: string;
  mentor: string;
  student: string;
  email: string;
  model: string;
  rating: number;
  platform: string;
  lti_email: string;
  lti_username: string;
  inserted_at: string;
  has_document?: boolean;
  memory_tracked?: boolean;
  llm_name?: string | null;
  llm_provider?: string | null;
  metadata?: any;
  tools?: Array<number>;
}

export function HistoryTab() {
  const [selectedConversation, setSelectedConversation] = React.useState<Conversation | null>(null);
  const [isConversationPreviewModalOpen, setIsConversationPreviewModalOpen] = React.useState(false);
  const [previewConversationContent, setPreviewConversationContent] =
    React.useState<Conversation | null>(null);
  const [showConversationMemory, setShowConversationMemory] = React.useState(false);
  const isMobile = useIsMobile();
  const params = useParams();
  const username = useUsername();
  const { tenantKey, mentorId } = params as {
    tenantKey: string;
    mentorId: string;
  };

  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery({
    mentor: mentorId,
    org: tenantKey,
    // @ts-ignore
    userId: username ?? ANONYMOUS_USERNAME,
  });

  const {
    chatHistory,
    isChatHistoryLoading,
    isChatHistoryFetching,
    currentPage,
    totalPages,
    handlePageChange,
    chatHistoryFilter,
    setFilters,
    filters,
  } = useHistoryWithPagination();

  // Get mentor summaries
  const { data: mentorSummaries, isLoading: isMentorSummariesLoading } = useGetMentorSummariesQuery(
    {
      tenantKey,
      username: username ?? '',
      mentorId,
      summary_type: 'general',
    },
    {
      skip: !mentorPublicSettings?.enable_memory_component,
    },
  );

  // Get conversation memory
  const { data: conversationMemory, isLoading: isConversationMemoryLoading } =
    useGetConversationMemoriesQuery(
      {
        tenantKey,
        username: username ?? '',
        memory_unique_id: selectedConversation?.id ?? '',
      },
      {
        skip:
          !selectedConversation?.id ||
          !mentorPublicSettings?.enable_memory_component ||
          !selectedConversation?.memory_tracked,
      },
    );

  const { handleExport, isExporting } = useExportChatHistory();

  const chatHistoryLength = chatHistory?.results?.length ?? 0;

  // Handler for opening conversation preview modal
  const handleConversationClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setPreviewConversationContent(conversation);
    setShowConversationMemory(false);
    // Only open the modal on non-desktop views (mobile and tablet)
    if (window.innerWidth < 768) {
      setIsConversationPreviewModalOpen(true);
    }
  };

  // Use mentor summaries data for rating and tags
  const averageRating = mentorSummaries?.rating || 0;
  const topicTags = mentorSummaries?.tags || [];

  return (
    <div className="flex flex-col h-full">
      <div className="hidden lg:block flex-shrink-0 p-4 border-b border-gray-200 bg-white h-[73px] flex items-center">
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-1">History</h3>
          <p className="text-gray-700 text-xs">View and manage conversation history.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className="space-y-6">
          {/* Rating and Description Section */}
          {!isMentorSummariesLoading && mentorSummaries && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center">
                  {/* RATING SECTION */}
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${star <= Math.round(averageRating) ? 'fill-blue-500 text-blue-500' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="font-semibold text-gray-900">
                  {averageRating.toFixed(1)} out of 5
                </span>
              </div>
              {/* SUMMARY SECTION */}
              {mentorSummaries.summary ? (
                <p className="text-gray-900 text-sm leading-relaxed">{mentorSummaries.summary}</p>
              ) : (
                <p className="text-sm text-gray-600">Summary not available</p>
              )}
            </div>
          )}

          {/* Loading state for mentor summaries */}
          {isMentorSummariesLoading && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            </div>
          )}

          {/* Topic Tags */}
          {!isMentorSummariesLoading && mentorSummaries && topicTags.length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex flex-wrap gap-2">
                {topicTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-gray-100 text-gray-900 text-sm rounded-md hover:bg-gray-200 cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="border rounded-lg p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Row 1: Search + Date (Mobile/Tablet) | All filters (Desktop) */}
              <div className="flex flex-wrap gap-3 flex-1">
                <div className="relative flex-1 min-w-[200px]">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-label="Search for User"
                        className="w-full justify-between font-normal bg-transparent"
                      >
                        {filters.users
                          ? chatHistoryFilter?.users?.find(
                              (user) => user.username === filters.users,
                            )?.email
                          : 'Search for User'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search users..." />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value=""
                              onSelect={() => setFilters({ ...filters, users: undefined })}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  !filters.users ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              All Users
                            </CommandItem>
                            {chatHistoryFilter?.users?.map((user) => (
                              <CommandItem
                                key={user.email}
                                value={user.email}
                                onSelect={() =>
                                  setFilters({
                                    ...filters,
                                    users: user.username,
                                  })
                                }
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    filters.users === (user.username || user.email)
                                      ? 'opacity-100'
                                      : 'opacity-0',
                                  )}
                                />
                                <div className="flex flex-col">
                                  {/* <span className="font-medium">{user.username || "No username"}</span> */}
                                  <span className="font-medium text-gray-700">{user.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 whitespace-nowrap font-normal bg-transparent"
                    >
                      <Calendar className="h-4 w-4" />
                      {filters.dateRange?.from && filters.dateRange?.to
                        ? `${format(filters.dateRange.from, 'MMM dd')} - ${format(filters.dateRange.to, 'MMM dd')}`
                        : 'Pick a Date Range'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={filters.dateRange}
                      onSelect={(date) => setFilters({ ...filters, dateRange: date })}
                      numberOfMonths={2}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Desktop only - show selects in same row */}
                <div className="hidden lg:flex gap-3">
                  <Select
                    value={filters.sentiment || 'all'}
                    onValueChange={(value) =>
                      setFilters({
                        ...filters,
                        sentiment: value === 'all' ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-40" aria-label="Filter by sentiment">
                      <SelectValue placeholder="All Sentiments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sentiments</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.topics || 'all'}
                    onValueChange={(value) =>
                      setFilters({
                        ...filters,
                        topics: value === 'all' ? '' : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-32" aria-label="Filter by topic">
                      <SelectValue placeholder="All Topics" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      {chatHistoryFilter?.topics?.map((topic) => (
                        <SelectItem key={topic.name} value={topic.name}>
                          {topic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Sentiments + Topics (Mobile/Tablet only) */}
              <div className="flex gap-3 lg:hidden">
                <Select
                  value={filters.sentiment || 'all'}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      sentiment: value === 'all' ? '' : value,
                    })
                  }
                >
                  <SelectTrigger className="flex-1" aria-label="Filter by sentiment">
                    <SelectValue placeholder="All Sentiments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sentiments</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.topics || 'all'}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      topics: value === 'all' ? '' : value,
                    })
                  }
                >
                  <SelectTrigger className="flex-1" aria-label="Filter by topic">
                    <SelectValue placeholder="All Topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    {chatHistoryFilter?.topics?.map((topic) => (
                      <SelectItem key={topic.name} value={topic.name}>
                        {topic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Export button - separate row on tablet/mobile, same row on desktop */}
              <div className="w-full lg:w-auto">
                <Button
                  variant="outline"
                  onClick={() => handleExport(filters)}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-2 w-full lg:w-auto bg-transparent"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
            </div>
          </div>

          {isChatHistoryLoading && (
            <div className="flex items-center justify-center w-full py-10">
              <Spinner />
            </div>
          )}

          {/* No conversations found */}
          {chatHistoryLength === 0 && !isChatHistoryLoading && (
            <div className="flex flex-col items-center justify-center">
              <p className="text-sm text-gray-600">No conversations found</p>
            </div>
          )}

          {/* Two Column Layout for Conversation List and Preview */}
          {chatHistoryLength > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Conversation List */}
              <div className="space-y-4 col-span-full md:col-span-1">
                <div
                  className="border rounded-md overflow-hidden max-h-[500px] overflow-y-auto scrollbar-hide"
                  tabIndex={0}
                  role="region"
                  aria-label="Conversation list"
                >
                  {chatHistory?.results?.map((_conversation: unknown) => {
                    //const messages = parseMessages(conversation.messages);
                    const conversation = _conversation as Conversation;
                    const messages = conversation.messages;
                    const firstMessage = messages[0];
                    const name = conversation.lti_email || conversation.email || 'Anonymous';
                    const timeAgo = formatDistanceToNow(new Date(conversation.inserted_at), {
                      addSuffix: true,
                    });
                    const title = firstMessage?.human
                      ? textTruncate(firstMessage.human, 50)
                      : 'Conversation';
                    const preview = firstMessage?.ai
                      ? textTruncate(firstMessage.ai, 60)
                      : 'No response available';

                    return (
                      <div
                        key={conversation.id}
                        className={cn(
                          'flex items-center justify-between p-4 border-b last:border-b-0 cursor-pointer',
                          selectedConversation?.id === conversation.id
                            ? 'bg-gray-100'
                            : 'hover:bg-gray-50',
                        )}
                        onClick={() => handleConversationClick(conversation)}
                      >
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">{timeAgo}</span>
                            <span className="text-sm text-gray-900 max-w-[100px] sm:max-w-[200px] truncate">
                              {name}
                            </span>
                          </div>
                          <div className="font-medium text-gray-900">{title}</div>
                          <p className="text-sm text-gray-600 line-clamp-1">{preview}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="my-2">
                    <IblPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                      disabled={isChatHistoryFetching || isChatHistoryLoading}
                      disableNumberedButtons={isMobile}
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Conversation Preview - Hidden on mobile, visible on desktop */}
              <div
                className="hidden md:flex border rounded-lg p-6 bg-white shadow-sm flex-col max-h-[500px] overflow-y-auto scrollbar-hide"
                tabIndex={0}
                role="region"
                aria-label="Conversation preview"
              >
                {selectedConversation && previewConversationContent ? (
                  <>
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-gray-700 mb-1">
                        {selectedConversation.messages[0]?.human || 'Conversation'}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {format(
                          new Date(selectedConversation.inserted_at),
                          "MMM dd, yyyy 'at' h:mm a",
                        )}
                      </span>
                    </div>

                    <div className="space-y-6">
                      {selectedConversation.messages.map((message, index) => (
                        <div key={index} className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                              <span className="text-sm font-medium text-blue-600">
                                {
                                  (selectedConversation.lti_email || selectedConversation.email)
                                    ?.charAt(0)
                                    ?.toUpperCase() || 'A' //A for Anonymous
                                }
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-700">
                                {selectedConversation.lti_email ||
                                  selectedConversation.email ||
                                  'Anonymous'}
                              </div>
                              <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">
                                {message.human}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 pt-4 border-t border-gray-200">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <span className="text-sm font-medium text-gray-600">AI</span>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-700">AI Agent</div>
                              <div className="text-sm text-gray-500 mt-1">
                                <Markdown>{message.ai}</Markdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Conversation Memory Section */}
                      {selectedConversation?.memory_tracked && (
                        <div className="pt-4 border-t border-gray-200">
                          <Button
                            variant="outline"
                            onClick={() => setShowConversationMemory(!showConversationMemory)}
                            className="w-full flex items-center justify-center gap-2 text-gray-700 border-gray-200 hover:bg-gray-50"
                          >
                            <Brain className="h-4 w-4" />
                            {showConversationMemory
                              ? 'Hide Conversation Memory'
                              : 'Show Conversation Memory'}
                          </Button>

                          {showConversationMemory && (
                            <div className="mt-4 space-y-6">
                              {isConversationMemoryLoading ? (
                                <div className="flex items-center justify-center py-4">
                                  <Spinner />
                                </div>
                              ) : conversationMemory?.entries?.length ? (
                                <>
                                  {/* Memory Name */}
                                  {conversationMemory.entries.map((entry, index) => (
                                    <div key={index}>
                                      <h4 className="font-semibold text-gray-900 mb-3">
                                        {entry.key}
                                      </h4>
                                      {/* Entries */}
                                      <ul className="space-y-2">
                                        <li className="flex items-start gap-2 text-sm text-gray-600">
                                          {entry.value}
                                        </li>
                                      </ul>
                                    </div>
                                  ))}
                                </>
                              ) : (
                                <div className="text-sm text-gray-500">
                                  No conversation memory available.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Select a conversation to view details.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Preview Modal for Mobile */}
      <Dialog
        open={isConversationPreviewModalOpen}
        onOpenChange={setIsConversationPreviewModalOpen}
      >
        <DialogContent className="max-w-[90vw] mx-auto overflow-y-auto overflow-x-hidden scrollbar-hide max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {previewConversationContent
                ? previewConversationContent.messages[0]?.human || 'Conversation'
                : 'Conversation'}
            </DialogTitle>
          </DialogHeader>
          <div className="max-w-full mx-auto overflow-x-hidden">
            {previewConversationContent && (
              <div className="space-y-4 overflow-y-auto scrollbar-hide">
                <div className="text-sm text-gray-500">
                  {format(
                    new Date(previewConversationContent.inserted_at),
                    "MMM dd, yyyy 'at' h:mm a",
                  )}
                </div>

                {previewConversationContent.messages.map((message, index) => (
                  <div key={index} className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <span className="text-sm font-medium text-blue-600">
                          {
                            (
                              previewConversationContent.lti_email ||
                              previewConversationContent.email
                            )
                              ?.charAt(0)
                              ?.toUpperCase() || 'A' //A for Anonymous
                          }
                        </span>
                      </div>
                      <div className="overflow-x-hidden">
                        <div className="font-medium text-gray-900 truncate">
                          {previewConversationContent.lti_email ||
                            previewConversationContent.email ||
                            'Anonymous'}
                        </div>
                        <p className="text-sm text-gray-900 mt-1 whitespace-pre-line">
                          {message.human}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 pt-4 border-t border-gray-200">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                        <span className="text-sm font-medium text-gray-600">AI</span>
                      </div>
                      <div className="overflow-x-hidden">
                        <div className="font-medium text-gray-900">AI Agent</div>
                        <div className="text-sm text-gray-900 mt-1">
                          <Markdown>{message.ai}</Markdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
