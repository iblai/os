import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';

import {
  mentorReducer,
  coreApiSlice,
  mentorMiddleware,
  mcpApiSlice,
  workflowsApiSlice,
  memoryApiSlice,
  MEMORY_QUERY_KEYS,
} from '@iblai/iblai-js/data-layer';
import { userReducer } from '@/features/users/slice';
import { authApiSlice } from '@/features/auth/api-slice';
import { authApiSlice as authApiSliceDataLayer } from '@iblai/iblai-js/data-layer';
import topTrialBannerSlice from '@/features/top-banner/top-banner-slice';
import subscriptionSlice from '@/features/subscription/subscription-slice';
import { userApiSlice } from '@/features/users/api-slice';
import { modalReducer } from '@/features/navigation/slice';
import { mentorsApiSlice } from '@/features/mentors/api-slice';
import { tenantsApiSlice } from '@/features/tenants/api-slice';
import { messagesApiSlice } from '@/features/messages/api-slice';
import { appSlice } from '@/lib/features/app/app-slice';
import { providerAssociationApiSlice } from '@/features/provider-association/api-slice';
import { chatReducer } from '@/features/chat/chatSlice';
import { filesReducer } from '@iblai/iblai-js/web-utils';
import { chatSliceReducerShared } from '@iblai/iblai-js/web-utils';
import { appleRestrictionReducer } from '@iblai/iblai-js/web-utils';
import { analyticsReducer } from '@/features/analytics/slice';
import { chatInputSliceReducer } from '@/features/chat-input/api-slice';
import rbacReducer from '@/features/rbac/rbac-slice';
import imagePreviewsReducer from '@/features/image-previews/image-previews-slice';

// Bridge: the data layer's `updateMemsearchConfig` mutation only invalidates
// the MEMSEARCH_PLATFORM_CONFIG tag, but our app reads memsearch state via
// `getMemsearchStatus` (which provides MEMSEARCH_STATUS). Invalidate the
// status tag whenever the config mutation succeeds so the UI updates without
// a page reload when the toggle in the Profile dialog flips.
const memsearchStatusBridge = createListenerMiddleware();
memsearchStatusBridge.startListening({
  predicate: (action) => {
    const a = action as {
      type?: string;
      meta?: { arg?: { endpointName?: string } };
    };
    return (
      a.type === `${memoryApiSlice.reducerPath}/executeMutation/fulfilled` &&
      a.meta?.arg?.endpointName === 'updateMemsearchConfig'
    );
  },
  effect: (_action, listenerApi) => {
    listenerApi.dispatch(
      memoryApiSlice.util.invalidateTags(MEMORY_QUERY_KEYS.MEMSEARCH_STATUS()),
    );
  },
});

export const store = configureStore({
  reducer: {
    modals: modalReducer,
    user: userReducer,
    chat: chatReducer,
    files: filesReducer,
    chatSliceShared: chatSliceReducerShared,
    analytics: analyticsReducer,
    chatInput: chatInputSliceReducer,
    app: appSlice.reducer,
    rbac: rbacReducer,
    imagePreviews: imagePreviewsReducer,

    [mentorsApiSlice.reducerPath]: mentorsApiSlice.reducer,
    [messagesApiSlice.reducerPath]: messagesApiSlice.reducer,
    [userApiSlice.reducerPath]: userApiSlice.reducer,
    [tenantsApiSlice.reducerPath]: tenantsApiSlice.reducer,
    [coreApiSlice.reducerPath]: coreApiSlice.reducer,
    [authApiSlice.reducerPath]: authApiSlice.reducer,
    [authApiSliceDataLayer.reducerPath]: authApiSliceDataLayer.reducer,
    [mcpApiSlice.reducerPath]: mcpApiSlice.reducer,
    [workflowsApiSlice.reducerPath]: workflowsApiSlice.reducer,
    topBanner: topTrialBannerSlice.reducer,
    subscription: subscriptionSlice.reducer,
    appleRestriction: appleRestrictionReducer,
    [providerAssociationApiSlice.reducerPath]:
      providerAssociationApiSlice.reducer,
    ...mentorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      mentorsApiSlice.middleware,
      messagesApiSlice.middleware,
      userApiSlice.middleware,
      tenantsApiSlice.middleware,
      coreApiSlice.middleware,
      authApiSlice.middleware,
      authApiSliceDataLayer.middleware,
      mcpApiSlice.middleware,
      workflowsApiSlice.middleware,
      providerAssociationApiSlice.middleware,
      ...mentorMiddleware,
      memsearchStatusBridge.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
