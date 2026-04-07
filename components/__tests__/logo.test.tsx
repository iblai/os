import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Logo from '../logo';

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    onError,
    className,
    ...props
  }: {
    src: string;
    alt: string;
    onError?: () => void;
    className?: string;
    [key: string]: any;
  }) => (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={onError}
      data-testid="logo-image"
      {...props}
    />
  ),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    dmUrl: () => 'https://dm.example.com',
  },
}));

// Mock use-header
const mockUseHeader = vi.fn();
vi.mock('@/hooks/use-header', () => ({
  useHeader: () => mockUseHeader(),
}));

// Mock user-navigate
const mockNavigateToHome = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToHome: mockNavigateToHome,
  }),
}));

// Mock use-mentor-settings
const mockUseMentorSettings = vi.fn();
vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

// Mock cn util
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('Logo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant' });
    mockUseHeader.mockReturnValue({ useSpecialIframeLogo: false });
    mockUseMentorSettings.mockReturnValue({ data: null });
  });

  it('renders the logo button', async () => {
    render(<Logo />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('flex cursor-pointer items-center');
  });

  it('loads logo from dmUrl with tenantKey from params', async () => {
    render(<Logo />);
    await waitFor(() => {
      expect(screen.getByTestId('logo-image')).toHaveAttribute(
        'src',
        'https://dm.example.com/api/core/orgs/test-tenant/logo/',
      );
    });
  });

  it('uses tenantKey from props over params', async () => {
    render(<Logo tenantKey="props-tenant" />);
    await waitFor(() => {
      expect(screen.getByTestId('logo-image')).toHaveAttribute(
        'src',
        'https://dm.example.com/api/core/orgs/props-tenant/logo/',
      );
    });
  });

  it("renders image with alt text 'logo'", async () => {
    render(<Logo />);
    await waitFor(() => {
      expect(screen.getByAltText('logo')).toBeInTheDocument();
    });
  });

  it('applies default className to image', async () => {
    render(<Logo />);
    await waitFor(() => {
      expect(screen.getByTestId('logo-image')).toHaveClass(
        'max-h-[50px] w-auto',
      );
    });
  });

  it('applies custom className to image', async () => {
    render(<Logo className="custom-class" />);
    await waitFor(() => {
      const img = screen.getByTestId('logo-image');
      expect(img.className).toContain('custom-class');
      expect(img.className).toContain('max-h-[50px] w-auto');
    });
  });

  it('navigates to home on click', async () => {
    render(<Logo />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockNavigateToHome).toHaveBeenCalledTimes(1);
  });

  it('does not render image when logoUrl is empty', () => {
    // useSpecialIframeLogo true + no profileImage => empty logoUrl
    mockUseHeader.mockReturnValue({ useSpecialIframeLogo: true });
    mockUseMentorSettings.mockReturnValue({ data: null });
    render(<Logo />);
    expect(screen.queryByTestId('logo-image')).not.toBeInTheDocument();
  });

  describe('when useSpecialIframeLogo is true', () => {
    beforeEach(() => {
      mockUseHeader.mockReturnValue({ useSpecialIframeLogo: true });
    });

    it('uses mentorSettings profileImage as logo', async () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          profileImage: 'https://example.com/mentor-avatar.png',
          mentorName: 'Test Mentor',
        },
      });
      render(<Logo />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          'https://example.com/mentor-avatar.png',
        );
      });
    });

    it('displays mentor name', async () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          profileImage: 'https://example.com/avatar.png',
          mentorName: 'My Mentor',
        },
      });
      render(<Logo />);
      expect(screen.getByText('My Mentor')).toBeInTheDocument();
    });

    it('does not display mentor name when mentorSettings is null', () => {
      mockUseMentorSettings.mockReturnValue({ data: null });
      render(<Logo />);
      expect(screen.queryByText('My Mentor')).not.toBeInTheDocument();
    });

    it('falls back to /logo-iframe.gif on image error', async () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          profileImage: 'https://example.com/bad-image.png',
          mentorName: 'Test',
        },
      });
      render(<Logo />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toBeInTheDocument();
      });
      fireEvent.error(screen.getByTestId('logo-image'));
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          '/logo-iframe.gif',
        );
      });
    });

    it('sets empty logoUrl when profileImage is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { mentorName: 'Test' },
      });
      render(<Logo />);
      expect(screen.queryByTestId('logo-image')).not.toBeInTheDocument();
    });
  });

  describe('when useSpecialIframeLogo is false', () => {
    beforeEach(() => {
      mockUseHeader.mockReturnValue({ useSpecialIframeLogo: false });
    });

    it('falls back to /logo.gif on image error', async () => {
      render(<Logo />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toBeInTheDocument();
      });
      fireEvent.error(screen.getByTestId('logo-image'));
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          '/logo.gif',
        );
      });
    });

    it('does not display mentor name', async () => {
      mockUseMentorSettings.mockReturnValue({
        data: { mentorName: 'Hidden Mentor' },
      });
      render(<Logo />);
      expect(screen.queryByText('Hidden Mentor')).not.toBeInTheDocument();
    });
  });

  describe('useEffect dependencies', () => {
    it('reloads logo when tenantKey changes', async () => {
      const { rerender } = render(<Logo tenantKey="tenant-a" />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          'https://dm.example.com/api/core/orgs/tenant-a/logo/',
        );
      });

      rerender(<Logo tenantKey="tenant-b" />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          'https://dm.example.com/api/core/orgs/tenant-b/logo/',
        );
      });
    });

    it('switches to profileImage when useSpecialIframeLogo becomes true', async () => {
      mockUseHeader.mockReturnValue({ useSpecialIframeLogo: false });
      const { rerender } = render(<Logo />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          'https://dm.example.com/api/core/orgs/test-tenant/logo/',
        );
      });

      mockUseHeader.mockReturnValue({ useSpecialIframeLogo: true });
      mockUseMentorSettings.mockReturnValue({
        data: {
          profileImage: 'https://example.com/profile.png',
          mentorName: 'Mentor',
        },
      });
      rerender(<Logo />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          'https://example.com/profile.png',
        );
      });
    });

    it('updates logo when mentorSettings profileImage changes', async () => {
      mockUseHeader.mockReturnValue({ useSpecialIframeLogo: true });
      mockUseMentorSettings.mockReturnValue({
        data: {
          profileImage: 'https://example.com/avatar-v1.png',
          mentorName: 'Mentor',
        },
      });
      const { rerender } = render(<Logo />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          'https://example.com/avatar-v1.png',
        );
      });

      mockUseMentorSettings.mockReturnValue({
        data: {
          profileImage: 'https://example.com/avatar-v2.png',
          mentorName: 'Mentor',
        },
      });
      rerender(<Logo />);
      await waitFor(() => {
        expect(screen.getByTestId('logo-image')).toHaveAttribute(
          'src',
          'https://example.com/avatar-v2.png',
        );
      });
    });
  });

  it('uses tenantKey from params when no prop is provided', async () => {
    mockUseParams.mockReturnValue({ tenantKey: 'param-tenant' });
    render(<Logo />);
    await waitFor(() => {
      expect(screen.getByTestId('logo-image')).toHaveAttribute(
        'src',
        'https://dm.example.com/api/core/orgs/param-tenant/logo/',
      );
    });
  });
});
