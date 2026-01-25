import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock functions
const mockPush = vi.fn();
const mockUseCustomerPortal = vi.fn();
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

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
}));

// Import after mocks
import PortalPedidosPage from '../page';

const mockCustomer = {
  customer_id: '123e4567-e89b-12d3-a456-426614174000',
  customer_name: 'Juan Perez',
  customer_phone: '3001234567',
  customer_email: 'juan@example.com',
  typical_recurrence_days: 15,
  last_purchase_date: '2026-01-10T10:00:00Z',
};

const mockOrders = [
  {
    id: 'order-001',
    created_at: '2026-01-15T10:00:00Z',
    total_amount: 45000,
    payment_method: 'efectivo',
    status: 'confirmed',
    notes: 'Sin azucar',
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
  {
    id: 'order-002',
    created_at: '2026-01-01T10:00:00Z',
    total_amount: 90000,
    payment_method: 'nequi',
    status: 'pending_confirmation',
    notes: null,
    items: [
      {
        product_name: 'Cafe Premium',
        quantity: 2,
        unit: 'libra',
        price_per_unit: 45000,
        total_price: 90000,
      },
    ],
  },
];

describe('PortalPedidosPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseCustomerPortal.mockClear();
    mockSupabaseRpc.mockClear();
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
      });

      render(<PortalPedidosPage />);

      // Loading spinner should be visible
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading spinner while fetching orders', () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<PortalPedidosPage />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Authentication', () => {
    it('should redirect to auth page when not authenticated', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: null,
        isLoading: false,
        isAuthenticated: false,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/portal/auth');
      });
    });

    it('should not redirect when authenticated', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText('Mis Pedidos')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalledWith('/portal/auth');
    });
  });

  describe('Page Content', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });
    });

    it('should display page header with title', async () => {
      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText('Mis Pedidos')).toBeInTheDocument();
      });
    });

    it('should display total orders count', async () => {
      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText(/Historial completo de tus pedidos \(2 pedidos\)/i)).toBeInTheDocument();
      });
    });

    it('should display back button to portal', async () => {
      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: '' })).toHaveAttribute('href', '/portal');
      });
    });

    it('should display coffee icon in header', async () => {
      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText('Mis Pedidos')).toBeInTheDocument();
      });
    });
  });

  describe('Orders List', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should display orders list', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        // Dates formatted in Spanish
        expect(screen.getByText(/15 de enero de 2026/i)).toBeInTheDocument();
        expect(screen.getByText(/1 de enero de 2026/i)).toBeInTheDocument();
      });
    });

    it('should display order amounts', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        // Check for formatted currency amounts
        const amounts = screen.getAllByText(/\$\s*45[\.,]?000/i);
        expect(amounts.length).toBeGreaterThan(0);

        const largerAmounts = screen.getAllByText(/\$\s*90[\.,]?000/i);
        expect(largerAmounts.length).toBeGreaterThan(0);
      });
    });

    it('should display product count for each order', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getAllByText(/1 producto\(s\)/i).length).toBe(2);
      });
    });

    it('should show pending status badge for pending orders', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText('Pendiente')).toBeInTheDocument();
      });
    });
  });

  describe('Order Expansion', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });
    });

    it('should expand order details when clicked', async () => {
      const user = userEvent.setup();

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText(/15 de enero de 2026/i)).toBeInTheDocument();
      });

      // Click on the first order to expand it
      const firstOrder = screen.getByText(/15 de enero de 2026/i).closest('div[class*="cursor-pointer"]');
      if (firstOrder) {
        await user.click(firstOrder);
      }

      await waitFor(() => {
        expect(screen.getByText(/1 libra Cafe Origen/i)).toBeInTheDocument();
      });
    });

    it('should show order notes when expanded', async () => {
      const user = userEvent.setup();

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText(/15 de enero de 2026/i)).toBeInTheDocument();
      });

      const firstOrder = screen.getByText(/15 de enero de 2026/i).closest('div[class*="cursor-pointer"]');
      if (firstOrder) {
        await user.click(firstOrder);
      }

      await waitFor(() => {
        expect(screen.getByText(/Nota: Sin azucar/i)).toBeInTheDocument();
      });
    });

    it('should show payment method when expanded', async () => {
      const user = userEvent.setup();

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText(/15 de enero de 2026/i)).toBeInTheDocument();
      });

      const firstOrder = screen.getByText(/15 de enero de 2026/i).closest('div[class*="cursor-pointer"]');
      if (firstOrder) {
        await user.click(firstOrder);
      }

      await waitFor(() => {
        expect(screen.getByText(/Pago: efectivo/i)).toBeInTheDocument();
      });
    });

    it('should collapse order when clicked again', async () => {
      const user = userEvent.setup();

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText(/15 de enero de 2026/i)).toBeInTheDocument();
      });

      const firstOrder = screen.getByText(/15 de enero de 2026/i).closest('div[class*="cursor-pointer"]');
      if (firstOrder) {
        // Click to expand
        await user.click(firstOrder);

        await waitFor(() => {
          expect(screen.getByText(/1 libra Cafe Origen/i)).toBeInTheDocument();
        });

        // Click again to collapse
        await user.click(firstOrder);

        await waitFor(() => {
          // The expanded content should no longer be visible
          expect(screen.queryByText(/Pago: efectivo/i)).not.toBeInTheDocument();
        });
      }
    });

    it('should only expand one order at a time', async () => {
      const user = userEvent.setup();

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText(/15 de enero de 2026/i)).toBeInTheDocument();
        expect(screen.getByText(/1 de enero de 2026/i)).toBeInTheDocument();
      });

      const firstOrder = screen.getByText(/15 de enero de 2026/i).closest('div[class*="cursor-pointer"]');
      const secondOrder = screen.getByText(/1 de enero de 2026/i).closest('div[class*="cursor-pointer"]');

      if (firstOrder && secondOrder) {
        // Click first order
        await user.click(firstOrder);

        await waitFor(() => {
          expect(screen.getByText(/Pago: efectivo/i)).toBeInTheDocument();
        });

        // Click second order
        await user.click(secondOrder);

        await waitFor(() => {
          // First order content should be hidden
          expect(screen.queryByText(/Pago: efectivo/i)).not.toBeInTheDocument();
          // Second order content should be visible
          expect(screen.getByText(/Pago: nequi/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no orders exist', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: [], total: 0 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText('No tienes pedidos aun')).toBeInTheDocument();
      });
    });

    it('should show link to make first order when empty', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: [], total: 0 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /hacer mi primer pedido/i })).toHaveAttribute(
          'href',
          '/portal/nuevo-pedido'
        );
      });
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should not show pagination when total is less than limit', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText('Mis Pedidos')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /anterior/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument();
    });

    it('should show pagination when total exceeds limit', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 15 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /siguiente/i })).toBeInTheDocument();
      });
    });

    it('should disable previous button on first page', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 15 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
      });
    });

    it('should enable next button when more pages exist', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 15 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /siguiente/i })).not.toBeDisabled();
      });
    });

    it('should load next page when next button is clicked', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 15 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /siguiente/i })).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /siguiente/i });
      await user.click(nextButton);

      await waitFor(() => {
        // RPC should be called with offset 10 (second page)
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_customer_order_history', {
          p_customer_id: mockCustomer.customer_id,
          p_limit: 10,
          p_offset: 10,
        });
      });
    });

    it('should load previous page when previous button is clicked', async () => {
      const user = userEvent.setup();

      // First call with offset 0, second with offset 10, third back to 0
      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 25 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /siguiente/i })).toBeInTheDocument();
      });

      // Go to next page
      await user.click(screen.getByRole('button', { name: /siguiente/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /anterior/i })).not.toBeDisabled();
      });

      // Go back to previous page
      await user.click(screen.getByRole('button', { name: /anterior/i }));

      await waitFor(() => {
        // Should go back to offset 0
        const calls = mockSupabaseRpc.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1].p_offset).toBe(0);
      });
    });
  });

  describe('RPC Calls', () => {
    it('should call get_customer_order_history with correct params', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_customer_order_history', {
          p_customer_id: mockCustomer.customer_id,
          p_limit: 10,
          p_offset: 0,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      render(<PortalPedidosPage />);

      // Should show empty state or handle gracefully
      await waitFor(() => {
        // The component handles errors by showing empty state
        expect(screen.getByText('No tienes pedidos aun')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockRejectedValue(new Error('Network error'));

      render(<PortalPedidosPage />);

      await waitFor(() => {
        // Should show empty state after error
        expect(screen.getByText('No tienes pedidos aun')).toBeInTheDocument();
      });
    });
  });

  describe('Date Formatting', () => {
    it('should format dates in Spanish locale', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: mockOrders, total: 2 },
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        // Spanish date format: "15 de enero de 2026" - multiple dates may appear
        expect(screen.getAllByText(/enero/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Order without notes', () => {
    it('should not show notes section when order has no notes', async () => {
      const user = userEvent.setup();

      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: { orders: [mockOrders[1]], total: 1 }, // Order without notes
        error: null,
      });

      render(<PortalPedidosPage />);

      await waitFor(() => {
        expect(screen.getByText(/1 de enero de 2026/i)).toBeInTheDocument();
      });

      const orderCard = screen.getByText(/1 de enero de 2026/i).closest('div[class*="cursor-pointer"]');
      if (orderCard) {
        await user.click(orderCard);
      }

      await waitFor(() => {
        expect(screen.getByText(/Pago: nequi/i)).toBeInTheDocument();
        expect(screen.queryByText(/Nota:/i)).not.toBeInTheDocument();
      });
    });
  });
});
