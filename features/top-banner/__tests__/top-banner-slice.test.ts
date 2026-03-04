import { describe, it, expect } from 'vitest';
import topBannerSlice, { setTopBannerOptions } from '../top-banner-slice';

describe('top-banner/top-banner-slice', () => {
  const initialState = {
    topBannerOptions: {
      bannerText: '',
      loading: false,
      enabled: false,
      parentContainerSelector: '',
    },
  };

  describe('reducer', () => {
    it('should return the initial state', () => {
      expect(topBannerSlice.reducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('setTopBannerOptions', () => {
    it('should update banner text', () => {
      const options = {
        bannerText: 'New banner text',
        loading: false,
        enabled: true,
        parentContainerSelector: '',
      };

      const state = topBannerSlice.reducer(initialState, setTopBannerOptions(options));

      expect(state.topBannerOptions.bannerText).toBe('New banner text');
    });

    it('should update loading state', () => {
      const options = {
        bannerText: '',
        loading: true,
        enabled: false,
        parentContainerSelector: '',
      };

      const state = topBannerSlice.reducer(initialState, setTopBannerOptions(options));

      expect(state.topBannerOptions.loading).toBe(true);
    });

    it('should update enabled state', () => {
      const options = {
        bannerText: 'Test',
        loading: false,
        enabled: true,
        parentContainerSelector: '',
      };

      const state = topBannerSlice.reducer(initialState, setTopBannerOptions(options));

      expect(state.topBannerOptions.enabled).toBe(true);
    });

    it('should update parent container selector', () => {
      const options = {
        bannerText: '',
        loading: false,
        enabled: false,
        parentContainerSelector: '#container',
      };

      const state = topBannerSlice.reducer(initialState, setTopBannerOptions(options));

      expect(state.topBannerOptions.parentContainerSelector).toBe('#container');
    });

    it('should merge options with existing state', () => {
      const existingState = {
        topBannerOptions: {
          bannerText: 'Existing text',
          loading: true,
          enabled: true,
          parentContainerSelector: '#existing',
        },
      };

      const partialOptions = {
        bannerText: 'Updated text',
        loading: false,
        enabled: true,
        parentContainerSelector: '#existing',
      };

      const state = topBannerSlice.reducer(existingState, setTopBannerOptions(partialOptions));

      expect(state.topBannerOptions.bannerText).toBe('Updated text');
      expect(state.topBannerOptions.loading).toBe(false);
      expect(state.topBannerOptions.enabled).toBe(true);
      expect(state.topBannerOptions.parentContainerSelector).toBe('#existing');
    });

    it('should handle onUpgrade property', () => {
      const options = {
        bannerText: 'Test',
        loading: false,
        enabled: true,
        parentContainerSelector: '',
        onUpgrade: 'https://upgrade.com',
      };

      const state = topBannerSlice.reducer(initialState, setTopBannerOptions(options as any));

      expect((state.topBannerOptions as any).onUpgrade).toBe('https://upgrade.com');
    });
  });

  describe('slice metadata', () => {
    it('should have correct slice name', () => {
      expect(topBannerSlice.name).toBe('topBanner');
    });

    it('should export action creator', () => {
      expect(setTopBannerOptions).toBeDefined();
    });
  });
});
