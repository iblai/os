'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ConnectorManagementContent } from './connector-management-content';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';
import type { MCPServer } from '@iblai/iblai-js/data-layer';

interface McpTabProps {
  onSelect?: (server: MCPServer) => void;
}

export function McpTab({ onSelect }: McpTabProps = {}) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">MCP</h3>
          <p className="text-xs text-gray-700">
            Manage Model Context Protocol connectors for your agent.
          </p>
        </div>
      </div>
      <div
        className="flex-1 p-3 lg:p-4"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <ConnectorManagementContent
          tenantKey={tenantKey}
          username={username ?? ''}
          mentorId={activeMentorId}
          onSelect={onSelect}
        />
      </div>
    </>
  );
}
