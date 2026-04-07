import { render, screen } from '@testing-library/react';

const mockUseParams = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  AnalyticsReportDownload: ({
    platform_key,
    report_name,
  }: {
    platform_key: string;
    report_name: string;
  }) => (
    <div
      data-testid="analytics-report-download"
      data-platform-key={platform_key}
      data-report-name={report_name}
    >
      AnalyticsReportDownload
    </div>
  ),
}));

import ReportDownloadPage from '../page';

describe('ReportDownloadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      reportName: 'monthly-usage',
    });
  });

  it('renders AnalyticsReportDownload with route params', () => {
    render(<ReportDownloadPage />);

    const component = screen.getByTestId('analytics-report-download');
    expect(component).toBeInTheDocument();
    expect(component).toHaveAttribute('data-platform-key', 'test-tenant');
    expect(component).toHaveAttribute('data-report-name', 'monthly-usage');
  });

  it('passes different route params correctly', () => {
    mockUseParams.mockReturnValue({
      tenantKey: 'another-org',
      reportName: 'daily-active-users',
    });

    render(<ReportDownloadPage />);

    const component = screen.getByTestId('analytics-report-download');
    expect(component).toHaveAttribute('data-platform-key', 'another-org');
    expect(component).toHaveAttribute('data-report-name', 'daily-active-users');
  });
});
