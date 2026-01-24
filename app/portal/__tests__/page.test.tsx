import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock functions
const mockPush = vi.fn();
const mockUseCustomerPortal = vi.fn();
const mockLogout = vi.fn();
const mockSupabaseRpc = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the customer portal context
vi.mock('@/context/customer-portal-context', () => ({
  useCustomerPortal: () => mockUseCustomerPortal(),
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
    p: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <p {...props}>{children}</p>
    ),
    button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
      ({ children, ...props }, ref) => (
        <button ref={ref} {...props}>{children}</button>
      )
    ),
  },
}));

// Import after mocks
import PortalDashboard from '../page';

const mockCustomer = {
  customer_id: '123e4567-e89b-12d3-a456-426614174000',
  customer_name: 'Juan Perez',
  customer_phone: '3001234567',
  customer_email: 'juan@example.com',
  typical_recurrence_days: 15,
  last_purchase_date: '2026-01-10T10:00:00Z',
};

const mockDashboardData = {
  customer: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Juan Perez',
    phone: '3001234567',
    email: 'juan@example.com',
    address: 'Calle 123',
    typical_recurrence_days: 15,
  },
  last_sale: {
    id: 'sale-001',
    created_at: '2026-01-10T10:00:00Z',
    total_amount: 45000,
    payment_method: 'efectivo',
    items: [
      {
        product_name: 'Cafe Origen',
        quantity: 1,
        unit: 'libra',
        price_per_unit: 45000,
        total_price: 45000,
      },
    ],
  },
  days_since_purchase: 13,
  days_until_next: 2,
  recent_sales: [
    {
      id: 'sale-001',
      created_at: '2026-01-10T10:00:00Z',
      total_amount: 45000,
      items_summary: '1 libra Cafe Origen',
    },
    {
      id: 'sale-002',
      created_at: '2025-12-26T10:00:00Z',
      total_amount: 90000,
      items_summary: '2 libras Cafe Premium',
    },
  ],
  status: 'soon' as const,
  has_subscription: false,
  subscription: null,
};

describe('PortalDashboard', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseCustomerPortal.mockClear();
    mockLogout.mockClear();
    mockSupabaseRpc.mockClear();

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when authLoading is true', () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: null,
        isLoading: true,
        isAuthenticated: false,
        logout: mockLogout,
      });

      render(<PortalDashboard />);

      expect(screen.getByText('Cargando...')).toBeInTheDocument();
    });

    it('should show loading spinner when data is loading', () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      // RPC that never resolves to keep loading state
      mockSupabaseRpc.mockReturnValue(new Promise(() => {}));

      render(<PortalDashboard />);

      expect(screen.getByText('Cargando...')).toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    it('should redirect to auth page when not authenticated', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: null,
        isLoading: false,
        isAuthenticated: false,
        logout: mockLogout,
      });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/portal/auth');
      });
    });

    it('should not redirect when authenticated', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockDashboardData, error: null });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Hola, Juan Perez!/i)).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalledWith('/portal/auth');
    });
  });

  describe('Dashboard Content', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockDashboardData, error: null });
    });

    it('should display customer greeting', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Hola, Juan Perez!/i)).toBeInTheDocument();
      });
    });

    it('should display status badge', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Pedido pronto')).toBeInTheDocument();
      });
    });

    it('should display last order information', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/hace 13 dias/i)).toBeInTheDocument();
      });
    });

    it('should display next order information', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/en ~2 dias/i)).toBeInTheDocument();
      });
    });

    it('should display recent orders', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Mis pedidos recientes')).toBeInTheDocument();
        // Recent sales show items_summary - use getAllByText since text may appear multiple places
        expect(screen.getAllByText('1 libra Cafe Origen').length).toBeGreaterThan(0);
        expect(screen.getByText('2 libras Cafe Premium')).toBeInTheDocument();
      });
    });

    it('should display header with logo and navigation', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Mirador')).toBeInTheDocument();
      });
    });

    it('should display referrals card', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Programa de Referidos')).toBeInTheDocument();
        expect(screen.getByText('Invita amigos y gana descuentos')).toBeInTheDocument();
      });
    });

    it('should display help section with WhatsApp link', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Necesitas ayuda?')).toBeInTheDocument();
        expect(screen.getByText('Escribir por WhatsApp')).toBeInTheDocument();
      });
    });
  });

  describe('Subscription Card', () => {
    it('should show subscription prompt when no subscription', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockDashboardData, error: null });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suscripcion automatica')).toBeInTheDocument();
        expect(screen.getByText('Recibe tu cafe sin hacer pedidos')).toBeInTheDocument();
      });
    });

    it('should show subscription details when subscription exists', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      const dataWithSubscription = {
        ...mockDashboardData,
        has_subscription: true,
        subscription: {
          id: 'sub-001',
          frequency_days: 15,
          next_order_date: '2026-01-25T10:00:00Z',
          status: 'active',
        },
      };

      mockSupabaseRpc.mockResolvedValue({ data: dataWithSubscription, error: null });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suscripcion Activa')).toBeInTheDocument();
        expect(screen.getByText(/cada 15 dias/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Actions', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockDashboardData, error: null });
    });

    it('should call logout and redirect when logout button is clicked', async () => {
      const user = userEvent.setup();
      mockLogout.mockResolvedValue(undefined);

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Hola, Juan Perez!/i)).toBeInTheDocument();
      });

      // Find the logout button by aria-label or position
      const buttons = screen.getAllByRole('button');
      const logoutButton = buttons.find(btn => btn.querySelector('svg'));

      // Click the last icon button (logout) in the header
      const headerButtons = within(screen.getByRole('banner')).getAllByRole('button');
      await user.click(headerButtons[headerButtons.length - 1]);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/portal/auth');
      });
    });

    it('should navigate to new order and store items when repeat button is clicked', async () => {
      const user = userEvent.setup();

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Repetir')).toBeInTheDocument();
      });

      const repeatButton = screen.getByRole('button', { name: /repetir/i });
      await user.click(repeatButton);

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        'repeat_order',
        expect.any(String)
      );
      expect(mockPush).toHaveBeenCalledWith('/portal/nuevo-pedido?repeat=true');
    });

    it('should have link to make new order', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /hacer pedido/i })).toHaveAttribute(
          'href',
          '/portal/nuevo-pedido'
        );
      });
    });

    it('should have link to view all orders', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /ver todos/i })).toHaveAttribute(
          'href',
          '/portal/pedidos'
        );
      });
    });

    it('should have link to profile', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        // Profile link is in the header
        const profileLink = screen.getByRole('link', { name: '' });
        expect(profileLink).toHaveAttribute('href', '/portal/perfil');
      });
    });

    it('should have link to referrals page', async () => {
      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /ver mas/i })).toHaveAttribute(
          'href',
          '/portal/referidos'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error state when data fetch fails', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Error al cargar datos')).toBeInTheDocument();
      });
    });

    it('should display error from API response', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { error: 'Cliente no encontrado' },
        error: null
      });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Cliente no encontrado')).toBeInTheDocument();
      });
    });

    it('should have retry button on error', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Error' }
      });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
      });
    });
  });

  describe('Status Display', () => {
    const testCases = [
      { status: 'new', label: 'Nuevo cliente' },
      { status: 'ok', label: 'Todo bien' },
      { status: 'soon', label: 'Pedido pronto' },
      { status: 'due', label: 'Es hora de pedir' },
    ];

    testCases.forEach(({ status, label }) => {
      it(`should display correct label for status "${status}"`, async () => {
        mockUseCustomerPortal.mockReturnValue({
          customer: mockCustomer,
          isLoading: false,
          isAuthenticated: true,
          logout: mockLogout,
        });

        mockSupabaseRpc.mockResolvedValue({
          data: { ...mockDashboardData, status },
          error: null
        });

        render(<PortalDashboard />);

        await waitFor(() => {
          expect(screen.getByText(label)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Empty States', () => {
    it('should show message when no orders exist', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      const dataWithNoOrders = {
        ...mockDashboardData,
        last_sale: null,
        recent_sales: [],
        days_since_purchase: null,
        days_until_next: null,
        status: 'new' as const,
      };

      mockSupabaseRpc.mockResolvedValue({ data: dataWithNoOrders, error: null });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Sin pedidos aun')).toBeInTheDocument();
        expect(screen.getByText('No tienes pedidos aun')).toBeInTheDocument();
      });
    });

    it('should show "Aun no hay datos" when no recurrence data', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      const dataWithNoRecurrence = {
        ...mockDashboardData,
        days_until_next: null,
      };

      mockSupabaseRpc.mockResolvedValue({ data: dataWithNoRecurrence, error: null });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Aun no hay datos')).toBeInTheDocument();
      });
    });
  });

  describe('Formatting', () => {
    it('should format currency correctly', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockDashboardData, error: null });

      render(<PortalDashboard />);

      await waitFor(() => {
        // COP format should show $ sign with thousand separators
        const amounts = screen.getAllByText(/\$\s*45[\.,]?000/i);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('should display "Hoy!" when days_until_next is 0', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { ...mockDashboardData, days_until_next: 0 },
        error: null
      });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Hoy!')).toBeInTheDocument();
      });
    });

    it('should display overdue message when days_until_next is negative', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        logout: mockLogout,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { ...mockDashboardData, days_until_next: -5 },
        error: null
      });

      render(<PortalDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/hace 5 dias/i)).toBeInTheDocument();
      });
    });
  });
});
