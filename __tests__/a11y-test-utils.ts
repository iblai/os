import React from 'react';
import { test, expect } from 'vitest';
import { axe, AxeCore } from 'vitest-axe';
import { render } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { mentorApiSlice, memoryApiSlice } from '@iblai/iblai-js/data-layer';
import { modalReducer } from '@/features/navigation/slice';

export function createTestStore() {
  return configureStore({
    reducer: {
      modals: modalReducer,
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
      [memoryApiSlice.reducerPath]: memoryApiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      })
        .concat(mentorApiSlice.middleware)
        .concat(memoryApiSlice.middleware),
    preloadedState: {
      modals: {
        modalStack: [],
        customAlertDialog: {
          message: '',
          validateTrigger: '',
          cancelTrigger: '',
          isOpen: false,
          title: '',
        },
        iframeCloseButton: false,
        darkMode: false,
        shortcutsModal: false,
      },
    },
  });
}

export function testAccessibility(
  testName: string,
  component: React.ReactNode,
  options: {
    debug?: boolean;
    axeRules?: AxeCore.RunOptions;
    verbose?: boolean;
  } = {},
) {
  test(testName, async () => {
    const { container, debug } = render(component);

    if (options.debug) debug();

    const results = await axe(container, options.axeRules);

    if (options.verbose) {
      console.log('Accessibility violations:', results.violations);
    }

    // @ts-ignore
    expect(results).toHaveNoViolations();
  });
}
