import type { Metadata } from 'next';

import { buildSharedChatMetadata } from '@/lib/seo-share';

import ShareChatContent from './share-chat-content';

// Server wrapper: resolves the shared-chat SEO card (noindex + rich OG), then
// renders the client transcript UI. Uses request-time data → stays dynamic.
export const dynamic = 'force-dynamic';

type ShareChatParams = {
  sessionId: string;
  tenantKey: string;
  mentorId: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<ShareChatParams>;
}): Promise<Metadata> {
  const { sessionId, tenantKey, mentorId } = await params;
  return buildSharedChatMetadata(sessionId, tenantKey, mentorId);
}

export default function Page() {
  return <ShareChatContent />;
}
