import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { MentorECommerceWrapper } from '../mentor-e-commerce-wrapper';
import topBannerSlice from '@/features/top-banner/top-banner-slice';

// ---- Test-controlled mock state ----
let mockIsPreviewMode = false;
let lastTopBannerProps: any = null;

vi.mock('@/hooks/use-is-preview-mode', () => ({
  useIsPreviewMode: () => mockIsPreviewMode,
}));

const mockGetTopBannerButtonHandler = vi.fn();
vi.mock('@/hooks/subscription/use-top-banner-button-handler', () => ({
  useTopBannerButtonHandler: () => mockGetTopBannerButtonHandler,
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  TopBanner: (props: any) => {
    lastTopBannerProps = props;
    // Capture the ref via onLoad with a fake banner element
    const ref = {
      clientHeight: 60,
    } as HTMLDivElement;
    return (
      <div data-testid="top-banner">
        <span data-testid="banner-text">{props.bannerText}</span>
        <span data-testid="banner-button-label">{props.buttonLabel}</span>
        <button
          data-testid="banner-load-btn"
          onClick={() => props.onLoad?.(ref)}
        >
          Load
        </button>
        <button
          data-testid="banner-load-null-btn"
          onClick={() => props.onLoad?.(null as unknown as HTMLDivElement)}
        >
          Load null
        </button>
        <button
          data-testid="banner-close-btn"
          onClick={() => props.onClose?.()}
        >
          Close
        </button>
      </div>
    );
  },
}));

interface StoreOptions {
  enabled?: boolean;
  bannerText?: string;
  buttonLabel?: string;
  loading?: boolean;
  tooltipText?: string;
  onUpgrade?: string;
}

function createTestStore(options: StoreOptions = {}) {
  const store = configureStore({
    reducer: {
      topBanner: topBannerSlice.reducer,
    },
    preloadedState: {
      topBanner: {
        topBannerOptions: {
          enabled: options.enabled ?? false,
          bannerText: options.bannerText ?? '',
          loading: options.loading ?? false,
          parentContainerSelector: '.mentor-parent-container',
          ...(options.buttonLabel ? { buttonLabel: options.buttonLabel } : {}),
          ...(options.tooltipText ? { tooltipText: options.tooltipText } : {}),
          ...(options.onUpgrade ? { onUpgrade: options.onUpgrade } : {}),
        },
      },
    },
  });
  return store;
}

function renderWithStore(store: ReturnType<typeof createTestStore>) {
  return render(
    <Provider store={store}>
      <MentorECommerceWrapper />
    </Provider>,
  );
}

beforeEach(() => {
  mockIsPreviewMode = false;
  lastTopBannerProps = null;
  mockGetTopBannerButtonHandler.mockReset();
  mockGetTopBannerButtonHandler.mockReturnValue(() => {});
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('MentorECommerceWrapper', () => {
  it('renders nothing when in preview mode', () => {
    mockIsPreviewMode = true;
    const store = createTestStore({ enabled: true, bannerText: 'hi' });

    const { queryByTestId } = renderWithStore(store);

    expect(queryByTestId('top-banner')).not.toBeInTheDocument();
  });

  it('renders nothing when banner is not enabled', () => {
    const store = createTestStore({ enabled: false });

    const { queryByTestId } = renderWithStore(store);

    expect(queryByTestId('top-banner')).not.toBeInTheDocument();
  });

  it('renders the TopBanner with text and default label when enabled', () => {
    const store = createTestStore({
      enabled: true,
      bannerText: 'Credit exhausted',
    });

    const { getByTestId } = renderWithStore(store);

    expect(getByTestId('banner-text').textContent).toBe('Credit exhausted');
    expect(getByTestId('banner-button-label').textContent).toBe('Upgrade');
  });

  it('uses the provided buttonLabel when supplied', () => {
    const store = createTestStore({
      enabled: true,
      bannerText: 'Limit reached',
      buttonLabel: 'Contact admin',
    });

    const { getByTestId } = renderWithStore(store);

    expect(getByTestId('banner-button-label').textContent).toBe(
      'Contact admin',
    );
  });

  it('passes the onUpgrade trigger through useTopBannerButtonHandler', () => {
    const handler = vi.fn();
    mockGetTopBannerButtonHandler.mockReturnValue(handler);
    const store = createTestStore({
      enabled: true,
      onUpgrade: 'TRIGGER_CONTACT_ADMIN',
    });

    renderWithStore(store);

    expect(mockGetTopBannerButtonHandler).toHaveBeenCalledWith(
      'TRIGGER_CONTACT_ADMIN',
    );
    expect(lastTopBannerProps?.buttonHandler).toBe(handler);
  });

  it('mutates layout elements when the banner loads', () => {
    document.body.innerHTML = `
      <div data-slot="sidebar-wrapper" style="max-height: 100vh; top: 0px; position: static"></div>
      <div id="main-content-container"><div style="position: static; top: 0px"></div></div>
      <div data-slot="sidebar-container" style="top: 0px; height: 100%"></div>
      <div data-slot="sidebar-inset" style="top: 0px; height: 100dvh"></div>
    `;

    const store = createTestStore({ enabled: true, bannerText: 'foo' });

    const { getByTestId } = renderWithStore(store);

    fireEvent.click(getByTestId('banner-load-btn'));

    const sideBar = document.querySelector(
      '[data-slot="sidebar-wrapper"]',
    ) as HTMLElement;
    const mainInner = document.querySelector(
      '#main-content-container > div',
    ) as HTMLElement;
    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]',
    ) as HTMLElement;

    expect(sideBar.style.maxHeight).toBe('calc(100vh - 60px)');
    expect(sideBar.style.top).toBe('3px');
    expect(sideBar.style.position).toBe('relative');

    expect(mainInner.style.position).toBe('relative');
    expect(mainInner.style.top).toBe('-12px');

    expect(sidebarContainer.style.top).toBe('48px');
    expect(sidebarContainer.style.height).toBe('calc(100% - 60px)');

    expect(sidebarInset.style.height).toBe('calc(100dvh - 60px)');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('is a no-op when onLoad receives a falsy ref', () => {
    document.body.innerHTML = `
      <div data-slot="sidebar-wrapper" style="max-height: 100vh"></div>
    `;
    const store = createTestStore({ enabled: true, bannerText: 'foo' });

    const { getByTestId } = renderWithStore(store);

    fireEvent.click(getByTestId('banner-load-null-btn'));

    const sideBar = document.querySelector(
      '[data-slot="sidebar-wrapper"]',
    ) as HTMLElement;
    expect(sideBar.style.maxHeight).toBe('100vh');
  });

  it('skips layout mutations on load when target elements are missing', () => {
    // No layout elements on the page
    const store = createTestStore({ enabled: true, bannerText: 'foo' });

    const { getByTestId } = renderWithStore(store);

    expect(() => fireEvent.click(getByTestId('banner-load-btn'))).not.toThrow();
    // Body always exists in jsdom; banner load forces overflow:hidden
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores initial layout styles on close', () => {
    document.body.innerHTML = `
      <div data-slot="sidebar-wrapper" style="max-height: 50vh; top: 7px; position: absolute"></div>
      <div id="main-content-container"><div style="position: absolute; top: 5px"></div></div>
      <div data-slot="sidebar-container" style="top: 10px; height: 90%"></div>
      <div data-slot="sidebar-inset" style="top: 11px; height: 80dvh"></div>
    `;
    document.body.style.overflow = 'scroll';

    const store = createTestStore({ enabled: true, bannerText: 'foo' });

    const { getByTestId } = renderWithStore(store);

    // Apply banner styles first
    fireEvent.click(getByTestId('banner-load-btn'));

    // Now close — should restore the originals captured by the mount effect
    fireEvent.click(getByTestId('banner-close-btn'));

    const sideBar = document.querySelector(
      '[data-slot="sidebar-wrapper"]',
    ) as HTMLElement;
    expect(sideBar.style.maxHeight).toBe('50vh');
    expect(sideBar.style.top).toBe('7px');
    expect(sideBar.style.position).toBe('absolute');

    const mainInner = document.querySelector(
      '#main-content-container > div',
    ) as HTMLElement;
    expect(mainInner.style.position).toBe('absolute');
    expect(mainInner.style.top).toBe('5px');

    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    expect(sidebarContainer.style.top).toBe('10px');
    expect(sidebarContainer.style.height).toBe('90%');

    const sidebarInset = document.querySelector(
      '[data-slot="sidebar-inset"]',
    ) as HTMLElement;
    expect(sidebarInset.style.height).toBe('80dvh');

    expect(document.body.style.overflow).toBe('scroll');
  });

  it('falls back to overflow auto on close when no original body overflow was captured', () => {
    document.body.style.overflow = '';
    const store = createTestStore({ enabled: true, bannerText: 'foo' });

    const { getByTestId } = renderWithStore(store);

    fireEvent.click(getByTestId('banner-close-btn'));

    expect(document.body.style.overflow).toBe('auto');
  });

  it('does not throw on close when target layout elements are missing', () => {
    const store = createTestStore({ enabled: true, bannerText: 'foo' });

    const { getByTestId } = renderWithStore(store);

    expect(() =>
      fireEvent.click(getByTestId('banner-close-btn')),
    ).not.toThrow();
  });
});
