import { RootState } from '@/store';

export const selectSessionId = (state: RootState) => state.app.sessionId;
