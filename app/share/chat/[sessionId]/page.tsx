import type { Metadata } from 'next';

import { buildSharedChatSessionMetadata } from '@/lib/seo-share';

import ShareChatRedirectContent from './share-chat-redirect-content';

// Server wrapper: resolves a rich (noindex) share card from the sessionId so
// the short link previews well on social, then renders the client redirect UI.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  return buildSharedChatSessionMetadata(sessionId);
}

export default function Page() {
  return <ShareChatRedirectContent />;
}
