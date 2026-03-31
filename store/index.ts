import { configureStore } from '@reduxjs/toolkit';

import {
  mentorReducer,
  coreApiSlice,
  mentorMiddleware,
  mcpApiSlice,
  workflowsApiSlice,
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
import { analyticsReducer } from '@/features/analytics/slice';
import { chatInputSliceReducer } from '@/features/chat-input/api-slice';
import rbacReducer from '@/features/rbac/rbac-slice';

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
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
