import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Supabase
const mockSupabaseRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
}));

// Mock chart components - these are complex and we just want to verify they render
vi.mock('@/components/charts/revenue-chart', () => ({
  RevenueChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="revenue-chart" data-count={data?.length || 0}>Revenue Chart</div>
  ),
}));

vi.mock('@/components/charts/payment-chart', () => ({
  PaymentChart: () => (
    <div data-testid="payment-chart">Payment Chart</div>
  ),
}));

vi.mock('@/components/charts/product-chart', () => ({
  ProductChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="product-chart" data-count={data?.length || 0}>Product Chart</div>
  ),
}));

// Mock KPI Card
vi.mock('@/components/metrics/advanced-kpi-card', () => ({
  AdvancedKPICard: ({ title, value, subtitle }: { title: string; value: string; subtitle: string }) => (
    <div data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <span data-testid="kpi-title">{title}</span>
      <span data-testid="kpi-value">{value}</span>
      <span data-testid="kpi-subtitle">{subtitle}</span>
    </div>
  ),
}));

// Mock DateRangeSelector
vi.mock('@/components/date-range-selector', () => ({
  DateRangeSelector: ({ onPresetChange, activePreset }: { onPresetChange: (preset: string) => void; activePreset: string }) => (
    <div data-testid="date-range-selector">
      <button data-testid="preset-hoy" onClick={() => onPresetChange('hoy')}>Hoy</button>
      <button data-testid="preset-esta-semana" onClick={() => onPresetChange('esta-semana')}>Esta Semana</button>
      <button data-testid="preset-este-mes" onClick={() => onPresetChange('este-mes')}>Este Mes</button>
      <span data-testid="active-preset">{activePreset}</span>
    </div>
  ),
}));

// Mock DownloadButton
vi.mock('@/components/export', () => ({
  DownloadButton: ({ label }: { label: string }) => (
    <button data-testid="download-button">{label}</button>
  ),
}));

// Import after mocks
import AnalyticsPage from '../page';

describe('AnalyticsPage', () => {
  const mockMetrics = {
    total_revenue: 1500000,
    total_profit: 450000,
    avg_profit_margin: 30.5,
    avg_ticket: 75000,
    sales_count: 20,
    inventory_value: 2500000,
    low_stock_items: 3,
    pending_credits: 150000,
    payment_breakdown: [
      { method: 'Efectivo', count: 15, total: 1125000 },
      { method: 'Nequi', count: 5, total: 375000 },
    ],
  };

  const mockTimeSeries = [
    { date: '2026-01-20', revenue: 200000, profit: 60000, count: 5 },
    { date: '2026-01-21', revenue: 300000, profit: 90000, count: 7 },
    { date: '2026-01-22', revenue: 250000, profit: 75000, count: 4 },
  ];

  const mockProductPerformance = [
    { product_id: '1', product_name: 'Cafe Especial', quantity_sold: 25, revenue: 500000, profit: 150000 },
    { product_id: '2', product_name: 'Cafe Premium', quantity_sold: 15, revenue: 375000, profit: 112500 },
  ];

  const mockPendingCredits = [
    {
      sale_id: 'sale-1',
      customer_name: 'Juan Perez',
      sale_date: '2026-01-15T10:00:00Z',
      amount_due: 75000,
      days_pending: 8,
    },
    {
      sale_id: 'sale-2',
      customer_name: 'Maria Garcia',
      sale_date: '2025-12-20T10:00:00Z',
      amount_due: 75000,
      days_pending: 34,
    },
  ];

  const mockAuthenticatedUser = {
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'token' },
    role: 'admin' as const,
    approved: true,
    isLoading: false,
    isAdmin: true,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockSupabaseRpc.mockClear();
    mockUseAuth.mockClear();

    // Default authenticated user
    mockUseAuth.mockReturnValue(mockAuthenticatedUser);

    // Default RPC implementations
    mockSupabaseRpc.mockImplementation((functionName: string) => {
      switch (functionName) {
        case 'get_advanced_metrics':
          return Promise.resolve({ data: mockMetrics, error: null });
        case 'get_sales_time_series':
          return Promise.resolve({ data: mockTimeSeries, error: null });
        case 'get_product_performance':
          return Promise.resolve({ data: mockProductPerformance, error: null });
        case 'get_pending_credits':
          return Promise.resolve({ data: mockPendingCredits, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should show loading spinner while authenticating', () => {
      mockUseAuth.mockReturnValue({
        ...mockAuthenticatedUser,
        user: null,
        isLoading: true,
      });

      render(<AnalyticsPage />);

      // Look for a loading spinner (Loader2 icon causes animation)
      const loadingElement = document.querySelector('.animate-spin');
      expect(loadingElement).toBeInTheDocument();
    });

    it('should redirect to login if not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        ...mockAuthenticatedUser,
        user: null,
        isLoading: false,
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should not render content when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        ...mockAuthenticatedUser,
        user: null,
        isLoading: false,
      });

      const { container } = render(<AnalyticsPage />);

      // Should render nothing
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Page Header', () => {
    it('should render page title', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/anal[ií]ticas avanzadas/i);
      });
    });

    it('should render back button', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const backButton = buttons.find(btn => btn.querySelector('svg'));
        expect(backButton).toBeInTheDocument();
      });
    });

    it('should navigate to home when back button clicked', async () => {
      const user = userEvent.setup();
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Find the back button (first button with icon)
      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);

      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should render download button', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('download-button')).toBeInTheDocument();
        expect(screen.getByText('Exportar Ventas')).toBeInTheDocument();
      });
    });
  });

  describe('Date Range Selector', () => {
    it('should render date range selector', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('date-range-selector')).toBeInTheDocument();
      });
    });

    it('should have "este-mes" as default active preset', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('active-preset')).toHaveTextContent('este-mes');
      });
    });

    it('should change preset when clicked', async () => {
      const user = userEvent.setup();
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('date-range-selector')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('preset-hoy'));

      await waitFor(() => {
        expect(screen.getByTestId('active-preset')).toHaveTextContent('hoy');
      });
    });

    it('should refetch data when preset changes', async () => {
      const user = userEvent.setup();
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('date-range-selector')).toBeInTheDocument();
      });

      // Clear previous calls
      mockSupabaseRpc.mockClear();

      await user.click(screen.getByTestId('preset-hoy'));

      await waitFor(() => {
        // Should call RPCs with new date range
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_advanced_metrics', expect.any(Object));
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_sales_time_series', expect.any(Object));
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_product_performance', expect.any(Object));
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state while fetching data', async () => {
      mockSupabaseRpc.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AnalyticsPage />);

      await waitFor(() => {
        const loadingElement = document.querySelector('.animate-spin');
        expect(loadingElement).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards', () => {
    it('should render all KPI cards after data loads', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-card-ingresos-totales')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-card-ganancia-total')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-card-ticket-promedio')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-card-valor-de-inventario')).toBeInTheDocument();
      });
    });

    it('should display formatted currency values', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        // Check that currency values are formatted (contains $ symbol)
        const kpiCards = screen.getAllByTestId('kpi-value');
        expect(kpiCards.length).toBeGreaterThan(0);
        kpiCards.forEach(card => {
          expect(card.textContent).toMatch(/\$/);
        });
      });
    });

    it('should display sales count in subtitle', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        const subtitles = screen.getAllByTestId('kpi-subtitle');
        const salesSubtitle = subtitles.find(s => s.textContent?.includes('20 ventas'));
        expect(salesSubtitle).toBeInTheDocument();
      });
    });

    it('should display margin percentage in subtitle', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        const subtitles = screen.getAllByTestId('kpi-subtitle');
        const marginSubtitle = subtitles.find(s => s.textContent?.includes('30.5%'));
        expect(marginSubtitle).toBeInTheDocument();
      });
    });

    it('should display low stock count', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        const subtitles = screen.getAllByTestId('kpi-subtitle');
        const stockSubtitle = subtitles.find(s => s.textContent?.includes('3 productos con poco stock'));
        expect(stockSubtitle).toBeInTheDocument();
      });
    });
  });

  describe('Charts', () => {
    it('should render revenue chart', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('revenue-chart')).toBeInTheDocument();
      });
    });

    it('should pass time series data to revenue chart', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        const chart = screen.getByTestId('revenue-chart');
        expect(chart).toHaveAttribute('data-count', '3');
      });
    });

    it('should render payment chart when payment breakdown exists', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('payment-chart')).toBeInTheDocument();
      });
    });

    it('should render product chart', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('product-chart')).toBeInTheDocument();
      });
    });

    it('should pass product data to product chart', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        const chart = screen.getByTestId('product-chart');
        expect(chart).toHaveAttribute('data-count', '2');
      });
    });
  });

  describe('Pending Credits Table', () => {
    it('should render pending credits table when there are pending credits', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        // The table has a heading with "Pagos Pendientes"
        const headings = screen.getAllByText('Pagos Pendientes');
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    it('should display customer names in table', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
      });
    });

    it('should display days pending with color coding', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        // Days can be "días" or "dias" depending on encoding
        expect(screen.getByText(/8\s*d[ií]as/)).toBeInTheDocument();
        expect(screen.getByText(/34\s*d[ií]as/)).toBeInTheDocument();
      });
    });

    it('should display total pending credits', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        // Total row should exist in the table footer
        // Look for the "Total:" text and verify the table exists
        expect(screen.getByText('Total:')).toBeInTheDocument();
      });
    });

    it('should display count of pending payments', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByText('2 pagos')).toBeInTheDocument();
      });
    });

    it('should not render credits table when no pending credits list', async () => {
      const metricsNoPending = { ...mockMetrics, pending_credits: 0 };

      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_pending_credits') {
          return Promise.resolve({ data: [], error: null });
        }
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: metricsNoPending, error: null });
        }
        if (functionName === 'get_sales_time_series') {
          return Promise.resolve({ data: mockTimeSeries, error: null });
        }
        if (functionName === 'get_product_performance') {
          return Promise.resolve({ data: mockProductPerformance, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-card-ingresos-totales')).toBeInTheDocument();
      });

      // The table should not be rendered (no pending credits array)
      // But the warning might still show if metrics.pending_credits > 0
      // So we check that there's no table with customer names
      expect(screen.queryByText('Juan Perez')).not.toBeInTheDocument();
      expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
    });
  });

  describe('Pending Credits Warning', () => {
    it('should show warning when metrics has pending_credits > 0', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        // Should find the warning text about pending credits
        const warningText = screen.getAllByText('Pagos Pendientes');
        expect(warningText.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when metrics fetch fails', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
      });
    });

    it('should display error message when time series fetch fails', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_sales_time_series') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: mockMetrics, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load time series data')).toBeInTheDocument();
      });
    });

    it('should display error message when product performance fetch fails', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_product_performance') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: mockMetrics, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load product performance')).toBeInTheDocument();
      });
    });

    it('should handle pending credits fetch error silently', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_pending_credits') {
          return Promise.resolve({ data: null, error: { message: 'Error' } });
        }
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: mockMetrics, error: null });
        }
        if (functionName === 'get_sales_time_series') {
          return Promise.resolve({ data: mockTimeSeries, error: null });
        }
        if (functionName === 'get_product_performance') {
          return Promise.resolve({ data: mockProductPerformance, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-card-ingresos-totales')).toBeInTheDocument();
      });

      // Should log error but not display it (not critical)
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Empty States', () => {
    it('should handle empty time series data', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_sales_time_series') {
          return Promise.resolve({ data: [], error: null });
        }
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: mockMetrics, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        const chart = screen.getByTestId('revenue-chart');
        expect(chart).toHaveAttribute('data-count', '0');
      });
    });

    it('should handle empty product performance data', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_product_performance') {
          return Promise.resolve({ data: [], error: null });
        }
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: mockMetrics, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        const chart = screen.getByTestId('product-chart');
        expect(chart).toHaveAttribute('data-count', '0');
      });
    });

    it('should not show payment chart when no payment breakdown', async () => {
      const metricsNoBreakdown = { ...mockMetrics, payment_breakdown: undefined };

      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_advanced_metrics') {
          return Promise.resolve({ data: metricsNoBreakdown, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-card-ingresos-totales')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('payment-chart')).not.toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('should format large numbers with currency symbol', async () => {
      render(<AnalyticsPage />);

      await waitFor(() => {
        // Check KPI values are formatted as Colombian pesos
        const kpiValues = screen.getAllByTestId('kpi-value');
        kpiValues.forEach(value => {
          expect(value.textContent).toMatch(/\$/);
        });
      });
    });
  });
});
