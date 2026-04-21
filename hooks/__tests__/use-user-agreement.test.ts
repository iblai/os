import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserAgreement } from '../use-user-agreement';

// Mock dependencies
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import toast after mock is set up
import { toast as mockToast } from 'sonner';

vi.mock('@/constants/disclaimer', () => ({
  DEFAULT_DISCLAIMER_CONTENT: 'Default disclaimer content',
}));

// Mock data-layer hooks
const mockUseGetDisclaimersQuery = vi.fn();
const mockAgreeToDisclaimer = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetDisclaimersQuery: (...args: unknown[]) =>
    mockUseGetDisclaimersQuery(...args),
  useAgreeToDisclaimerMutation: () => [mockAgreeToDisclaimer],
}));

describe('useUserAgreement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUsername.mockReturnValue('testuser');
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-1',
      tenantKey: 'tenant-1',
    });
    mockUseGetDisclaimersQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockAgreeToDisclaimer.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  describe('initial state', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() => useUserAgreement());

      expect(result.current.showDisclaimerModal).toBe(false);
      expect(result.current.isAgreeing).toBe(false);
      expect(result.current.pendingSubmitContent).toBe('');
    });

    it('should return default user agreement when no disclaimers exist', () => {
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
      });

      const { result } = renderHook(() => useUserAgreement());

      expect(result.current.userAgreement.content).toBe(
        'Default disclaimer content',
      );
      expect(result.current.userAgreement.active).toBe(false);
      expect(result.current.hasUserAgreement).toBe(false);
    });

    it('should return user agreement when disclaimers exist', () => {
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 1,
              content: 'Custom disclaimer',
              active: true,
              has_agreed: false,
            },
          ],
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useUserAgreement());

      expect(result.current.userAgreement.content).toBe('Custom disclaimer');
      expect(result.current.hasUserAgreement).toBe(true);
      expect(result.current.hasUserAgreedToDisclaimer).toBe(false);
    });
  });

  describe('hasUserAgreedToDisclaimer', () => {
    it('should return true when user has already agreed', () => {
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 1,
              content: 'Custom disclaimer',
              active: true,
              has_agreed: true,
            },
          ],
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useUserAgreement());

      expect(result.current.hasUserAgreedToDisclaimer).toBe(true);
    });
  });

  describe('handleDisclaimerAgree', () => {
    it('should call agreeToDisclaimer and update state on success', async () => {
      mockAgreeToDisclaimer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 123,
              content: 'Custom disclaimer',
              active: true,
              has_agreed: false,
            },
          ],
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useUserAgreement());

      await act(async () => {
        await result.current.handleDisclaimerAgree();
      });

      expect(mockAgreeToDisclaimer).toHaveBeenCalledWith({
        org: 'tenant-1',
        userId: 'testuser',
        formData: { disclaimer: 123 },
      });
      expect(mockToast.success).toHaveBeenCalledWith('User Agreement accepted');
      expect(result.current.hasUserAgreedToDisclaimer).toBe(true);
      expect(result.current.showDisclaimerModal).toBe(false);
    });

    it('should handle error when agreeing fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAgreeToDisclaimer.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
      });
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: {
          results: [
            {
              id: 123,
              content: 'Custom disclaimer',
              active: true,
              has_agreed: false,
            },
          ],
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useUserAgreement());

      await act(async () => {
        await result.current.handleDisclaimerAgree();
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to update user agreement status',
      );
      expect(result.current.isAgreeing).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should not call API when no user agreement ID exists', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
      });

      const { result } = renderHook(() => useUserAgreement());

      await act(async () => {
        await result.current.handleDisclaimerAgree();
      });

      expect(mockAgreeToDisclaimer).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No user agreement ID available');
      consoleSpy.mockRestore();
    });
  });

  describe('checkAgreementAndExecute', () => {
    it('should execute immediately when no user agreement required', () => {
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
      });

      const executeCallback = vi.fn();
      const { result } = renderHook(() => useUserAgreement());

      act(() => {
        result.current.checkAgreementAndExecute(
          'test content',
          executeCallback,
        );
      });

      expect(executeCallback).toHaveBeenCalledWith('test content');
      expect(result.current.showDisclaimerModal).toBe(false);
    });

    it('should show modal when user has not agreed to disclaimer', () => {
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: {
          results: [
            { id: 1, content: 'Disclaimer', active: true, has_agreed: false },
          ],
        },
        isLoading: false,
      });

      const executeCallback = vi.fn();
      const { result } = renderHook(() => useUserAgreement());

      act(() => {
        result.current.checkAgreementAndExecute(
          'test content',
          executeCallback,
        );
      });

      expect(executeCallback).not.toHaveBeenCalled();
      expect(result.current.showDisclaimerModal).toBe(true);
      expect(result.current.pendingSubmitContent).toBe('test content');
    });

    it('should execute immediately when user has agreed to disclaimer', () => {
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: {
          results: [
            { id: 1, content: 'Disclaimer', active: true, has_agreed: true },
          ],
        },
        isLoading: false,
      });

      const executeCallback = vi.fn();
      const { result } = renderHook(() => useUserAgreement());

      act(() => {
        result.current.checkAgreementAndExecute(
          'test content',
          executeCallback,
        );
      });

      expect(executeCallback).toHaveBeenCalledWith('test content');
    });
  });

  describe('executePendingSubmit', () => {
    it('should execute pending content and clear it', () => {
      mockUseGetDisclaimersQuery.mockReturnValue({
        data: {
          results: [
            { id: 1, content: 'Disclaimer', active: true, has_agreed: false },
          ],
        },
        isLoading: false,
      });

      const executeCallback = vi.fn();
      const { result } = renderHook(() => useUserAgreement());

      // First set pending content
      act(() => {
        result.current.checkAgreementAndExecute('pending content', vi.fn());
      });

      expect(result.current.pendingSubmitContent).toBe('pending content');

      // Execute pending
      act(() => {
        result.current.executePendingSubmit(executeCallback);
      });

      expect(executeCallback).toHaveBeenCalledWith('pending content');
      expect(result.current.pendingSubmitContent).toBe('');
    });

    it('should not execute when pending content is empty', () => {
      const executeCallback = vi.fn();
      const { result } = renderHook(() => useUserAgreement());

      act(() => {
        result.current.executePendingSubmit(executeCallback);
      });

      expect(executeCallback).not.toHaveBeenCalled();
    });
  });

  describe('setShowDisclaimerModal', () => {
    it('should update showDisclaimerModal state', () => {
      const { result } = renderHook(() => useUserAgreement());

      act(() => {
        result.current.setShowDisclaimerModal(true);
      });

      expect(result.current.showDisclaimerModal).toBe(true);

      act(() => {
        result.current.setShowDisclaimerModal(false);
      });

      expect(result.current.showDisclaimerModal).toBe(false);
    });
  });

  describe('query skip conditions', () => {
    it('should skip query when mentorId is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'tenant-1' });

      renderHook(() => useUserAgreement());

      expect(mockUseGetDisclaimersQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should skip query when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ mentorId: 'mentor-1' });

      renderHook(() => useUserAgreement());

      expect(mockUseGetDisclaimersQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should skip query when username is missing', () => {
      mockUseUsername.mockReturnValue(null);

      renderHook(() => useUserAgreement());

      expect(mockUseGetDisclaimersQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });
  });
});
