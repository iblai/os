import { vi } from 'vitest';
import { Provider } from 'react-redux';
import { testAccessibility, createTestStore } from './a11y-test-utils';

import { VoiceChatButton } from '@/components/chat-input-form/voice-chat-button';

// Mock Next.js navigation to prevent null searchParams
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/test',
  useParams: () => ({}),
}));

testAccessibility(
  '[VoiceChatButton]: has no accessibility violations',
  <Provider store={createTestStore()}>
    <VoiceChatButton handleMicrophoneBtnClick={() => {}} processing recording />
  </Provider>,
);
