'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { CreateWorkflowModal } from '@iblai/iblai-js/web-containers';
import {
  useGetWorkflowsQuery,
  useCreateWorkflowMutation,
} from '@iblai/iblai-js/data-layer';
import type { Workflow } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';

export default function WorkflowsPage() {
  const [searchValue, setSearchValue] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const router = useRouter();
  const params = useParams<{ tenantKey: string; mentorId: string }>();

  const { data, isLoading, error } = useGetWorkflowsQuery(
    { org: params.tenantKey, params: { search: searchValue || undefined } },
    { skip: !params.tenantKey },
  );

  const [createWorkflow, { isLoading: isCreating }] =
    useCreateWorkflowMutation();

  const workflows = useMemo(() => data?.results ?? [], [data]);

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'text-green-600 bg-green-50'
      : 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle2 className="h-3 w-3" />
    ) : (
      <Clock className="h-3 w-3" />
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateString);
  };

  const handleCreateWorkflow = async (name: string) => {
    const defaultNodes = [
      {
        id: 'start',
        type: 'start',
        position: { x: 100, y: 250 },
        data: { label: 'Start' },
        draggable: true,
        selectable: true,
        connectable: true,
      },
      {
        id: 'mentor-1',
        type: 'mentor',
        position: { x: 350, y: 250 },
        data: {
          label: 'Agent',
          subtitle: 'Agent',
          mentor_id: params.mentorId,
        },
        draggable: true,
        selectable: true,
        connectable: true,
      },
    ];
    const defaultEdges = [
      { id: 'e-start-mentor-1', source: 'start', target: 'mentor-1' },
    ];

    try {
      const workflow = await createWorkflow({
        org: params.tenantKey,
        data: {
          name,
          definition: { nodes: defaultNodes, edges: defaultEdges },
        },
      }).unwrap();
      setIsCreateModalOpen(false);
      router.push(
        `/platform/${params.tenantKey}/workflows/${workflow.entry_mentor_id}/${workflow.unique_id}?listMentorId=${params.mentorId}`,
      );
    } catch {
      toast.error('Failed to create workflow');
    }
  };

  const handleOpenWorkflow = (workflow: Workflow) => {
    router.push(
      `/platform/${params.tenantKey}/workflows/${workflow.entry_mentor_id}/${workflow.unique_id}?listMentorId=${params.mentorId}`,
    );
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="text-gray-600">Failed to load workflows</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="scrollbar-hide flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[920px] px-3 py-6 md:px-6 md:py-8">
          <div className="mb-6">
            <h1 className="mb-2 text-2xl font-semibold text-gray-700">
              Workflows
            </h1>
            <p className="text-sm text-gray-600">
              Create and manage automated workflows for your agents
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <Input
                placeholder="Search workflows..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full rounded-lg border-gray-300 py-3 pr-4 pl-12 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              className="rounded-lg bg-gradient-to-r from-[#38A1E5] to-[#7284FF] px-6 py-3 whitespace-nowrap text-white hover:from-[#2E8BD1] hover:to-[#5F6FE8]"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Workflow
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {workflows.map((workflow) => (
                  <Card
                    key={workflow.unique_id}
                    className="cursor-pointer rounded-lg border border-[#D0E0FF] bg-[#F5F8FF] transition-shadow hover:shadow-md"
                    onClick={() => handleOpenWorkflow(workflow)}
                  >
                    <CardContent className="p-6">
                      <div className="mb-3 flex items-start justify-between">
                        <h3 className="text-base font-semibold text-gray-900">
                          {workflow.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(workflow.is_active ?? false)}`}
                        >
                          {getStatusIcon(workflow.is_active ?? false)}
                          {workflow.is_active ? 'Active' : 'Draft'}
                        </span>
                      </div>
                      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-600">
                        {workflow.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          Modified {getRelativeTime(workflow.updated_at)}
                        </span>
                        <span>Created {formatDate(workflow.created_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {workflows.length === 0 && !isLoading && (
                <div className="py-12 text-center">
                  <p className="mb-4 text-gray-500">No workflows found</p>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="border-gray-300"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first workflow
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateWorkflowModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreateWorkflow={handleCreateWorkflow}
        isCreating={isCreating}
      />
    </div>
  );
}
