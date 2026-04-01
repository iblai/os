"use client";

import { useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Check, ChevronRight, ChevronsUpDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/spinner";
import {
  useGetMentorMemoriesQuery,
  useGetMemoryCategoriesAdminQuery,
  type MentorMemory,
  type MentorMemoryCategory,
} from "@iblai/iblai-js/data-layer";
import { useParams } from "next/navigation";
import { TenantKeyMentorIdParams } from "@/lib/types";
import { useUsername } from "@/hooks/use-user";
import { useNavigate } from "@/hooks/user-navigate";

interface MemoryItem {
  id: number;
  content: string;
  category: {
    id: number;
    name: string;
    slug: string;
  };
  username?: string;
  createdAt?: string;
}

export function LearnersMemories() {
  const username = useUsername();
  const [open, setOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState("");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedMemoryId, setSelectedMemoryId] = useState<number | null>(null);
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  // Build query params for server-side filtering
  const queryParams = useMemo(() => {
    const params: { start_date?: string; end_date?: string; user_id?: string } =
      {};
    if (selectedLearner) {
      params.user_id = selectedLearner;
    }
    if (dateRange?.from) {
      params.start_date = format(dateRange.from, "yyyy-MM-dd");
    }
    if (dateRange?.to) {
      params.end_date = format(dateRange.to, "yyyy-MM-dd");
    }
    return Object.keys(params).length > 0 ? params : undefined;
  }, [selectedLearner, dateRange]);

  const { data: memoriesByCategoryResponse, isLoading: isLoadingMemories } =
    useGetMentorMemoriesQuery(
      {
        org: tenantKey,
        userId: username ?? "",
        mentorId: activeMentorId,
        ...(queryParams ? { params: queryParams } : {}),
      },
      {
        skip: !tenantKey || !username || !activeMentorId,
      },
    );

  const { data: adminCategories } = useGetMemoryCategoriesAdminQuery(
    {
      org: tenantKey,
      mentorId: activeMentorId,
    },
    {
      skip: !tenantKey || !activeMentorId,
    },
  );

  // Fetch unfiltered memories to derive learner list
  const { data: unfilteredResponse } = useGetMentorMemoriesQuery(
    {
      org: tenantKey,
      userId: username ?? "",
      mentorId: activeMentorId,
    },
    {
      skip: !tenantKey || !username || !activeMentorId,
    },
  );

  // Flatten memories
  const memories: MemoryItem[] = useMemo(() => {
    if (!memoriesByCategoryResponse) return [];
    return memoriesByCategoryResponse.flatMap((item) =>
      item.memories.map((memory: MentorMemory) => ({
        id: memory.id,
        content: memory.content,
        category: {
          id: memory.category.id,
          name: memory.category.name,
          slug: memory.category.slug,
        },
        username: memory.username,
        createdAt: memory.created_at,
      })),
    );
  }, [memoriesByCategoryResponse]);

  // Filter by category (client-side since the API groups by category)
  const filteredMemories = useMemo(() => {
    if (selectedCategorySlug === "all") return memories;
    return memories.filter((m) => m.category.slug === selectedCategorySlug);
  }, [memories, selectedCategorySlug]);

  // Derive unique learners from unfiltered response
  const learners = useMemo(() => {
    if (!unfilteredResponse) return [];
    const userMap = new Map<string, { username: string; email: string }>();
    unfilteredResponse.forEach((item) =>
      item.memories.forEach((m: MentorMemory) => {
        if (m.username && !userMap.has(m.username)) {
          userMap.set(m.username, { username: m.username, email: m.username });
        }
      }),
    );
    return Array.from(userMap.values());
  }, [unfilteredResponse]);

  // Build category list
  const categories = useMemo(() => {
    if (adminCategories && adminCategories.length > 0) {
      return [
        { id: 0, name: "All", slug: "all" },
        ...adminCategories.map((cat: MentorMemoryCategory) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
        })),
      ];
    }
    if (!memoriesByCategoryResponse)
      return [{ id: 0, name: "All", slug: "all" }];
    const responseCats = memoriesByCategoryResponse.map((item) => ({
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug,
    }));
    return [{ id: 0, name: "All", slug: "all" }, ...responseCats];
  }, [adminCategories, memoriesByCategoryResponse]);

  const selectedMemory =
    filteredMemories.find((m) => m.id === selectedMemoryId) ?? null;

  return (
    <div className="space-y-4 pt-6 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-gray-900">Learner Memories</h3>
        <Info className="h-4 w-4 text-gray-400" />
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex flex-wrap gap-3 flex-1">
            <div className="flex-1 min-w-[200px]">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal bg-transparent"
                  >
                    {selectedLearner
                      ? learners.find(
                          (learner) => learner.username === selectedLearner,
                        )?.username
                      : "Select Learner"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search learner..." />
                    <CommandList>
                      <CommandEmpty>No learner found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setSelectedLearner("");
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedLearner === ""
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          All Learners
                        </CommandItem>
                        {learners.map((learner) => (
                          <CommandItem
                            key={learner.username}
                            value={`${learner.username} ${learner.email}`}
                            onSelect={() => {
                              setSelectedLearner(learner.username);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLearner === learner.username
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {learner.username}
                              </span>
                              <span className="text-xs text-gray-500">
                                {learner.email}
                              </span>
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
                  className="flex items-center gap-2 whitespace-nowrap font-normal bg-transparent w-full lg:w-auto"
                >
                  <Calendar className="h-4 w-4" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                    : "Pick a Date Range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <div className="hidden lg:block">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-40 justify-between font-normal bg-transparent"
                  >
                    {categories.find((c) => c.slug === selectedCategorySlug)
                      ?.name ?? "All"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-0" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {categories.map((category) => (
                          <CommandItem
                            key={category.slug}
                            value={category.slug}
                            onSelect={() =>
                              setSelectedCategorySlug(category.slug)
                            }
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCategorySlug === category.slug
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {category.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {isLoadingMemories ? (
        <div className="border rounded-md p-8 md:p-20 flex items-center justify-center">
          <Spinner />
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="border rounded-md p-8 md:p-20 flex items-center justify-center text-gray-500">
          No Memories
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 col-span-full md:col-span-1">
            <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto scrollbar-hide">
              {filteredMemories.map((memory) => {
                const timeAgo = memory.createdAt
                  ? formatDistanceToNow(new Date(memory.createdAt), {
                      addSuffix: true,
                    })
                  : "";
                const displayUser = memory.username || "Unknown";
                return (
                  <div
                    key={memory.id}
                    className={cn(
                      "flex items-center justify-between p-4 border-b last:border-b-0 cursor-pointer",
                      selectedMemoryId === memory.id
                        ? "bg-gray-100"
                        : "hover:bg-gray-50",
                    )}
                    onClick={() => setSelectedMemoryId(memory.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        {timeAgo && (
                          <span className="text-sm text-gray-500">
                            {timeAgo}
                          </span>
                        )}
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                          {memory.category.name}
                        </span>
                      </div>
                      <div className="font-medium text-gray-900 mb-1">
                        {displayUser}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {memory.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 ml-4">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="hidden md:flex border rounded-lg p-6 bg-white shadow-sm flex-col max-h-[400px] overflow-y-auto scrollbar-hide">
            {selectedMemory ? (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                      {selectedMemory.category.name}
                    </span>
                    {selectedMemory.createdAt && (
                      <span className="text-sm text-gray-500">
                        {format(
                          new Date(selectedMemory.createdAt),
                          "MMM dd, yyyy 'at' h:mm a",
                        )}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    {selectedMemory.username || "Unknown"}
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                      Memory Content
                    </h4>
                    <div className="text-sm text-gray-600">
                      {selectedMemory.content}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a memory to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
