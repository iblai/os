import { RootState } from '@/store';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ImagePreviewsState = {
  // Map of backend fileId -> local object URL for the uploaded image.
  urls: Record<string, string>;
};

const initialState: ImagePreviewsState = {
  urls: {},
};

const imagePreviewsSlice = createSlice({
  name: 'imagePreviews',
  initialState,
  reducers: {
    setImagePreview: (
      state,
      action: PayloadAction<{ fileId: string; url: string }>,
    ) => {
      const { fileId, url } = action.payload;
      // Revoke any previous object URL for this fileId before replacing it to
      // avoid leaking the old blob.
      const existing = state.urls[fileId];
      if (existing && existing !== url) {
        URL.revokeObjectURL(existing);
      }
      state.urls[fileId] = url;
    },
    clearImagePreviews: (state) => {
      Object.values(state.urls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
      state.urls = {};
    },
  },
});

export const { setImagePreview, clearImagePreviews } =
  imagePreviewsSlice.actions;

export default imagePreviewsSlice.reducer;

export const selectImagePreviews = (state: RootState) =>
  state.imagePreviews.urls;

export const selectImagePreviewByFileId =
  (fileId: string | undefined) => (state: RootState) =>
    fileId ? state.imagePreviews.urls[fileId] : undefined;
