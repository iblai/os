import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import imagePreviewsReducer, {
  setImagePreview,
  clearImagePreviews,
  selectImagePreviews,
  selectImagePreviewByFileId,
} from '../image-previews-slice';

describe('imagePreviews/image-previews-slice', () => {
  const initialState = { urls: {} };

  let revokeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    revokeSpy = vi.fn();
    // jsdom may not implement these; stub both.
    global.URL.revokeObjectURL =
      revokeSpy as unknown as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reducer', () => {
    it('should return the initial state', () => {
      expect(imagePreviewsReducer(undefined, { type: 'unknown' })).toEqual(
        initialState,
      );
    });
  });

  describe('setImagePreview', () => {
    it('should store a url keyed by fileId', () => {
      const state = imagePreviewsReducer(
        initialState,
        setImagePreview({ fileId: 'file-1', url: 'blob:abc' }),
      );

      expect(state.urls).toEqual({ 'file-1': 'blob:abc' });
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('should revoke the prior url when replacing one for the same fileId', () => {
      const existingState = { urls: { 'file-1': 'blob:old' } };

      const state = imagePreviewsReducer(
        existingState,
        setImagePreview({ fileId: 'file-1', url: 'blob:new' }),
      );

      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('blob:old');
      expect(state.urls).toEqual({ 'file-1': 'blob:new' });
    });

    it('should not revoke when the url is unchanged for the same fileId', () => {
      const existingState = { urls: { 'file-1': 'blob:same' } };

      const state = imagePreviewsReducer(
        existingState,
        setImagePreview({ fileId: 'file-1', url: 'blob:same' }),
      );

      expect(revokeSpy).not.toHaveBeenCalled();
      expect(state.urls).toEqual({ 'file-1': 'blob:same' });
    });

    it('should keep urls for other fileIds intact', () => {
      const existingState = { urls: { 'file-1': 'blob:1' } };

      const state = imagePreviewsReducer(
        existingState,
        setImagePreview({ fileId: 'file-2', url: 'blob:2' }),
      );

      expect(state.urls).toEqual({ 'file-1': 'blob:1', 'file-2': 'blob:2' });
      expect(revokeSpy).not.toHaveBeenCalled();
    });
  });

  describe('clearImagePreviews', () => {
    it('should revoke all urls and reset to empty', () => {
      const existingState = {
        urls: { 'file-1': 'blob:1', 'file-2': 'blob:2' },
      };

      const state = imagePreviewsReducer(existingState, clearImagePreviews());

      expect(revokeSpy).toHaveBeenCalledTimes(2);
      expect(revokeSpy).toHaveBeenCalledWith('blob:1');
      expect(revokeSpy).toHaveBeenCalledWith('blob:2');
      expect(state.urls).toEqual({});
    });

    it('should be a no-op revocation when there are no urls', () => {
      const state = imagePreviewsReducer(initialState, clearImagePreviews());

      expect(revokeSpy).not.toHaveBeenCalled();
      expect(state.urls).toEqual({});
    });
  });

  describe('selectors', () => {
    const rootState = {
      imagePreviews: { urls: { 'file-1': 'blob:1' } },
    } as never;

    it('selectImagePreviews should return the urls map', () => {
      expect(selectImagePreviews(rootState)).toEqual({ 'file-1': 'blob:1' });
    });

    it('selectImagePreviewByFileId should return the url for a known fileId', () => {
      expect(selectImagePreviewByFileId('file-1')(rootState)).toBe('blob:1');
    });

    it('selectImagePreviewByFileId should return undefined for an unknown fileId', () => {
      expect(selectImagePreviewByFileId('missing')(rootState)).toBeUndefined();
    });

    it('selectImagePreviewByFileId should return undefined when fileId is undefined', () => {
      expect(selectImagePreviewByFileId(undefined)(rootState)).toBeUndefined();
    });
  });

  describe('action creators', () => {
    it('should create setImagePreview action', () => {
      const action = setImagePreview({ fileId: 'f', url: 'u' });
      expect(action.type).toBe('imagePreviews/setImagePreview');
      expect(action.payload).toEqual({ fileId: 'f', url: 'u' });
    });

    it('should create clearImagePreviews action', () => {
      const action = clearImagePreviews();
      expect(action.type).toBe('imagePreviews/clearImagePreviews');
    });
  });
});
