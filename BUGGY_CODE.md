# Buggy Code Documentation

This file tracks failing tests that indicate bugs in the codebase.

## Failing Tests (as of 2026-01-19)

### 1. `hooks/__tests__/use-dropdox-picker.test.ts`

**Test:** `useDropboxPicker > credential fetching > should show error toast when credentials fail to load`

**Issue:** `toast.error` is expected to be called with `'Failed to load Dropbox credentials'` but is never called (0 calls).

**File:** `hooks/use-dropdox-picker.ts`

---

### 2. `hooks/__tests__/use-mentor-time-tracking.test.tsx`

**Test:** `useMentorTimeTrackingConfig > getTenantKey > returns undefined when tenant key is not present`

**Issue:** Expected `getTenantKey()` to return `undefined` but it returns an empty string `""`.

**File:** `hooks/use-mentor-time-tracking.tsx`

---

### 3. `hooks/__tests__/use-one-drive-picker.test.ts`

**Test 1:** `useOneDrivePicker > credential fetching > should show error toast when credentials fail to load`

**Issue:** `toast.error` is expected to be called with `'Failed to load OneDrive credentials'` but is never called (0 calls).

**Test 2:** `useOneDrivePicker > credential fetching > should show error toast when credentials array is empty`

**Issue:** `toast.error` is expected to be called with `'OneDrive credentials not found'` but is never called (0 calls).

**File:** `hooks/use-one-drive-picker.ts`

---

## Summary

- **Total failing tests:** 4
- **Files with bugs:** 3
  - `hooks/use-dropdox-picker.ts`
  - `hooks/use-mentor-time-tracking.tsx`
  - `hooks/use-one-drive-picker.ts`
