import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the auth provider
const mockPush = vi.fn();
const mockUseAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Supabase
const mockSupabaseRpc = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

// Mock child components to simplify testing
vi.mock('@/components/inventory-list', () => ({
  InventoryList: () => <div data-testid="inventory-list">Inventory List Mock</div>,
}));

vi.mock('@/components/new-customer-modal', () => ({
  NewCustomerModal: () => <button data-testid="new-customer-modal">Nuevo Cliente</button>,
}));

vi.mock('@/components/diagnostics', () => ({
  Diagnostics: () => <div data-testid="diagnostics">Diagnostics Mock</div>,
}));

vi.mock('@/components/pending-users-modal', () => ({
  PendingUsersModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="pending-users-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

vi.mock('@/components/export', () => ({
  DownloadButton: ({ label }: { label: string }) => (
    <button data-testid="download-button">{label}</button>
  ),
}));

// Import after mocks are set up
import Dashboard from '../page';

describe('Dashboard Page', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockStats = {
    total_inventory_grams: 10000,
    sales_today: 25000,
    roasted_coffee_lbs: 22.5,
    low_stock_count: 3,
  };

  const mockRecentSales = [
    {
      id: 'sale-1',
      created_at: '2026-01-23T10:30:00Z',
      total_amount: 150.00,
      payment_method: 'cash',
      customers: {
        full_name: 'Juan Perez',
        address: 'Calle 123',
        phone: '3001234567',
      },
    },
    {
      id: 'sale-2',
      created_at: '2026-01-23T09:15:00Z',
      total_amount: 75.50,
      payment_method: 'credit',
      customers: null,
    },
  ];

  beforeEach(() => {
    mockPush.mockClear();
    mockUseAuth.mockClear();
    mockSignOut.mockClear();
    mockSupabaseRpc.mockClear();
    mockSupabaseFrom.mockClear();

    // Default mock implementations
    mockSupabaseRpc.mockImplementation((functionName: string) => {
      if (functionName === 'get_dashboard_stats') {
        return Promise.resolve({ data: mockStats, error: null });
      }
      if (functionName === 'get_pending_users') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: mockRecentSales, error: null }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAdmin: false,
        signOut: mockSignOut,
      });

      render(<Dashboard />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Unauthenticated State', () => {
    it('should return null when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAdmin: false,
        signOut: mockSignOut,
      });

      const { container } = render(<Dashboard />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Authenticated User - Seller Role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAdmin: false,
        signOut: mockSignOut,
      });
    });

    it('should render main dashboard elements', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Mirador Montañero')).toBeInTheDocument();
        expect(screen.getByText('Café Selecto')).toBeInTheDocument();
        expect(screen.getByText('Panel de Control & Inventario')).toBeInTheDocument();
      });
    });

    it('should render KPI cards', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total en Inventario')).toBeInTheDocument();
        expect(screen.getByText('Ventas Hoy')).toBeInTheDocument();
        expect(screen.getByText('Café Tostado')).toBeInTheDocument();
        expect(screen.getByText('Alertas Stock')).toBeInTheDocument();
      });
    });

    it('should display stats data in KPI cards', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        // Check for stats values (locale-agnostic matching)
        expect(screen.getByText(/10[\.,]?000 g/)).toBeInTheDocument();
        expect(screen.getByText(/\$ 25[\.,]?000/)).toBeInTheDocument();
        expect(screen.getByText('22.5 lbs')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('should render recent sales section', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Ventas Recientes')).toBeInTheDocument();
      });
    });

    it('should display recent sales data', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.getByText('$ 150.00')).toBeInTheDocument();
        expect(screen.getByText('Cliente General')).toBeInTheDocument();
        expect(screen.getByText('$ 75.50')).toBeInTheDocument();
      });
    });

    it('should show "No hay ventas recientes" when sales list is empty', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('No hay ventas recientes')).toBeInTheDocument();
      });
    });

    it('should render navigation buttons', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clientes/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /contactos/i })).toBeInTheDocument();
      });
    });

    it('should not show admin-only buttons for sellers', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /precios/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /backups/i })).not.toBeInTheDocument();
        expect(screen.queryByTestId('download-button')).not.toBeInTheDocument();
      });
    });

    it('should navigate to analytics page when button clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /analytics/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /analytics/i }));
      expect(mockPush).toHaveBeenCalledWith('/analytics');
    });

    it('should navigate to clientes page when button clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clientes/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /clientes/i }));
      expect(mockPush).toHaveBeenCalledWith('/clientes');
    });

    it('should navigate to contactos page when button clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /contactos/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /contactos/i }));
      expect(mockPush).toHaveBeenCalledWith('/contactos');
    });

    it('should call signOut when logout button clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        // Find logout button by its icon (LogOut)
        const buttons = screen.getAllByRole('button');
        const logoutButton = buttons.find(btn =>
          btn.querySelector('svg.lucide-log-out') !== null
        );
        expect(logoutButton).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const logoutButton = buttons.find(btn =>
        btn.querySelector('svg.lucide-log-out') !== null
      );
      await user.click(logoutButton!);

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should render inventory list component', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
      });
    });

    it('should render new customer modal component', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('new-customer-modal')).toBeInTheDocument();
      });
    });

    it('should have Nueva Venta link', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /nueva venta/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /nueva venta/i })).toHaveAttribute('href', '/ventas/nueva');
      });
    });
  });

  describe('Authenticated User - Admin Role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAdmin: true,
        signOut: mockSignOut,
      });
    });

    it('should show admin-only buttons for admins', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /precios/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /backups/i })).toBeInTheDocument();
        expect(screen.getByTestId('download-button')).toBeInTheDocument();
      });
    });

    it('should navigate to precios page when button clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /precios/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /precios/i }));
      expect(mockPush).toHaveBeenCalledWith('/precios');
    });

    it('should navigate to backups page when button clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /backups/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /backups/i }));
      expect(mockPush).toHaveBeenCalledWith('/backups');
    });

    it('should show pending users badge when there are pending users', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_dashboard_stats') {
          return Promise.resolve({ data: mockStats, error: null });
        }
        if (functionName === 'get_pending_users') {
          return Promise.resolve({
            data: [{ id: '1' }, { id: '2' }],
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pendientes/i })).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should not show pending users button when count is 0', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /pendientes/i })).not.toBeInTheDocument();
      });
    });

    it('should open pending users modal when button clicked', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_dashboard_stats') {
          return Promise.resolve({ data: mockStats, error: null });
        }
        if (functionName === 'get_pending_users') {
          return Promise.resolve({
            data: [{ id: '1' }],
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pendientes/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /pendientes/i }));

      await waitFor(() => {
        expect(screen.getByTestId('pending-users-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAdmin: false,
        signOut: mockSignOut,
      });
    });

    it('should refresh data when refresh button clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        // Find refresh button by its icon
        const buttons = screen.getAllByRole('button');
        const refreshButton = buttons.find(btn =>
          btn.querySelector('svg.lucide-refresh-ccw') !== null
        );
        expect(refreshButton).toBeInTheDocument();
      });

      // Clear previous calls
      mockSupabaseRpc.mockClear();
      mockSupabaseFrom.mockClear();

      const buttons = screen.getAllByRole('button');
      const refreshButton = buttons.find(btn =>
        btn.querySelector('svg.lucide-refresh-ccw') !== null
      );
      await user.click(refreshButton!);

      // Verify data is fetched again
      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_dashboard_stats');
      });
    });
  });

  describe('KPI Card Styling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAdmin: false,
        signOut: mockSignOut,
      });
    });

    it('should show alert count when low stock count is greater than 0', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        // Verify the alerts card shows the low stock count
        expect(screen.getByText('Alertas Stock')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument(); // low_stock_count from mockStats
        expect(screen.getByText('Items bajo mínimo')).toBeInTheDocument();
      });
    });

    it('should show active trend when sales today is greater than 0', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Activo')).toBeInTheDocument();
      });
    });

    it('should show "Sin ventas" when sales today is 0', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_dashboard_stats') {
          return Promise.resolve({
            data: { ...mockStats, sales_today: 0 },
            error: null
          });
        }
        if (functionName === 'get_pending_users') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Sin ventas')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAdmin: false,
        signOut: mockSignOut,
      });
    });

    it('should handle stats fetch error gracefully', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'get_dashboard_stats') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<Dashboard />);

      // Should still render the page structure
      await waitFor(() => {
        expect(screen.getByText('Mirador Montañero')).toBeInTheDocument();
        // Stats should show "..." when not loaded
        expect(screen.getAllByText('...')).toHaveLength(4);
      });
    });

    it('should handle sales fetch error gracefully', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            }),
          }),
        }),
      });

      render(<Dashboard />);

      // Should still render the page and show empty sales
      await waitFor(() => {
        expect(screen.getByText('Ventas Recientes')).toBeInTheDocument();
        expect(screen.getByText('No hay ventas recientes')).toBeInTheDocument();
      });
    });
  });
});
