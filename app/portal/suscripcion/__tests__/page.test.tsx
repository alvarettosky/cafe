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
import PortalSuscripcionPage from '../page';

const mockCustomer = {
  customer_id: '123e4567-e89b-12d3-a456-426614174000',
  customer_name: 'Juan Perez',
  customer_phone: '3001234567',
  customer_email: 'juan@example.com',
  typical_recurrence_days: 15,
  last_purchase_date: '2026-01-10T10:00:00Z',
};

const mockProducts = [
  { id: 'prod-1', name: 'Cafe Origen', available: true },
  { id: 'prod-2', name: 'Cafe Premium', available: true },
  { id: 'prod-3', name: 'Cafe Especial', available: false },
];

const mockSubscription = {
  id: 'sub-1',
  frequency_days: 14,
  status: 'active' as const,
  next_delivery_date: '2026-02-01T10:00:00Z',
  skip_next: false,
  items: [
    {
      product_id: 'prod-1',
      product_name: 'Cafe Origen',
      quantity: 2,
      unit_type: 'libra' as const,
    },
  ],
  created_at: '2026-01-01T10:00:00Z',
};

const mockPausedSubscription = {
  ...mockSubscription,
  status: 'paused' as const,
};

const mockCancelledSubscription = {
  ...mockSubscription,
  status: 'cancelled' as const,
};

describe('PortalSuscripcionPage', () => {
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

      render(<PortalSuscripcionPage />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading spinner while fetching subscription', () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      // RPC that never resolves
      mockSupabaseRpc.mockReturnValue(new Promise(() => {}));

      render(<PortalSuscripcionPage />);

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

      render(<PortalSuscripcionPage />);

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

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Mi Suscripcion')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalledWith('/portal/auth');
    });
  });

  describe('Page Content - No Subscription', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should display page header', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Mi Suscripcion')).toBeInTheDocument();
      });
    });

    it('should display back button to portal', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: '' })).toHaveAttribute('href', '/portal');
      });
    });

    it('should display no subscription message', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('No tienes una suscripcion activa')).toBeInTheDocument();
      });
    });

    it('should display subscription benefits message', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText(/Crea una suscripcion para recibir tu cafe automaticamente/i)).toBeInTheDocument();
      });
    });

    it('should display create subscription button', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });
    });
  });

  describe('Active Subscription View', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should display subscription status as active', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Estado')).toBeInTheDocument();
        expect(screen.getByText('Activa')).toBeInTheDocument();
      });
    });

    it('should display next delivery date', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Proxima entrega')).toBeInTheDocument();
      });
    });

    it('should display frequency', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Frecuencia')).toBeInTheDocument();
        expect(screen.getByText('Cada 14 dias')).toBeInTheDocument();
      });
    });

    it('should display subscription products', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Productos en suscripcion')).toBeInTheDocument();
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
        expect(screen.getByText(/2 libra/i)).toBeInTheDocument();
      });
    });

    it('should display action buttons for active subscription', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Acciones')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /editar productos y frecuencia/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /omitir proxima entrega/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /pausar suscripcion/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancelar suscripcion/i })).toBeInTheDocument();
      });
    });
  });

  describe('Paused Subscription View', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockPausedSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should display subscription status as paused', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Pausada')).toBeInTheDocument();
      });
    });

    it('should display resume button for paused subscription', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reanudar suscripcion/i })).toBeInTheDocument();
      });
    });

    it('should not display pause button for paused subscription', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Pausada')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /pausar suscripcion/i })).not.toBeInTheDocument();
    });
  });

  describe('Cancelled Subscription View', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockCancelledSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should display subscription status as cancelled', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Cancelada')).toBeInTheDocument();
      });
    });

    it('should disable edit button for cancelled subscription', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /editar productos y frecuencia/i });
        expect(editButton).toBeDisabled();
      });
    });

    it('should not display cancel button for already cancelled subscription', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Cancelada')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /cancelar suscripcion/i })).not.toBeInTheDocument();
    });
  });

  describe('Skip Next Delivery', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should display skip next delivery button', async () => {
      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /omitir proxima entrega/i })).toBeInTheDocument();
      });
    });

    it('should display "Omitida" in delivery date when skip_next is true', async () => {
      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({
            data: { ...mockSubscription, skip_next: true },
            error: null,
          });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText('Omitida')).toBeInTheDocument();
      });
    });

    it('should disable skip button when already skipped', async () => {
      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({
            data: { ...mockSubscription, skip_next: true },
            error: null,
          });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        const skipButton = screen.getByRole('button', { name: /ya omitida la proxima/i });
        expect(skipButton).toBeDisabled();
      });
    });
  });

  describe('Subscription Actions', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should call toggle_subscription_status RPC when pausing', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pausar suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /pausar suscripcion/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('toggle_subscription_status', {
          p_customer_id: mockCustomer.customer_id,
          p_action: 'pause',
        });
      });
    });

    it('should call toggle_subscription_status RPC when resuming', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockPausedSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reanudar suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /reanudar suscripcion/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('toggle_subscription_status', {
          p_customer_id: mockCustomer.customer_id,
          p_action: 'resume',
        });
      });
    });

    it('should call toggle_subscription_status RPC when skipping', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /omitir proxima entrega/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /omitir proxima entrega/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('toggle_subscription_status', {
          p_customer_id: mockCustomer.customer_id,
          p_action: 'skip',
        });
      });
    });

    it('should call toggle_subscription_status RPC when cancelling', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancelar suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancelar suscripcion/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('toggle_subscription_status', {
          p_customer_id: mockCustomer.customer_id,
          p_action: 'cancel',
        });
      });
    });

    it('should show success message after action', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pausar suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /pausar suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Suscripcion pausada')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should enter edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /editar productos y frecuencia/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /editar productos y frecuencia/i }));

      await waitFor(() => {
        expect(screen.getByText('Frecuencia de entrega')).toBeInTheDocument();
        expect(screen.getByText('Selecciona productos')).toBeInTheDocument();
      });
    });

    it('should enter edit mode when create button is clicked', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Frecuencia de entrega')).toBeInTheDocument();
      });
    });

    it('should display frequency options in edit mode', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^7 dias$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^14 dias$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^21 dias$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^28 dias$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^30 dias$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^45 dias$/i })).toBeInTheDocument();
      });
    });

    it('should display products in edit mode', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
        expect(screen.getByText('Cafe Premium')).toBeInTheDocument();
      });
    });

    it('should add product to selection in edit mode', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('Productos seleccionados (1)')).toBeInTheDocument();
      });
    });

    it('should display cancel button in edit mode', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        // In edit mode, there's a "Cancelar" button to exit edit mode
        const cancelButton = screen.getByRole('button', { name: /^cancelar$/i });
        expect(cancelButton).toBeInTheDocument();
      });
    });

    it('should exit edit mode when cancel is clicked', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Frecuencia de entrega')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^cancelar$/i }));

      await waitFor(() => {
        expect(screen.getByText('No tienes una suscripcion activa')).toBeInTheDocument();
      });
    });

    it('should display empty selection message when no products selected', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Selecciona al menos un producto')).toBeInTheDocument();
      });
    });
  });

  describe('Save Subscription', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should call upsert_customer_subscription RPC when saving', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'upsert_customer_subscription') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('upsert_customer_subscription', {
          p_customer_id: mockCustomer.customer_id,
          p_frequency_days: 14,
          p_items: [
            {
              product_id: 'prod-1',
              quantity: 1,
              unit_type: 'libra',
            },
          ],
        });
      });
    });

    it('should show success message after creating subscription', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'upsert_customer_subscription') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));
      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Suscripcion creada')).toBeInTheDocument();
      });
    });

    it('should disable save button when no products selected', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        // The save/create button in edit mode should be disabled when no products selected
        const buttons = screen.getAllByRole('button', { name: /crear suscripcion/i });
        const saveButton = buttons[buttons.length - 1]; // Get the one in the edit form
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should show error when action fails', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.resolve({ data: null, error: { message: 'Error' } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pausar suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /pausar suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Error al procesar la accion')).toBeInTheDocument();
      });
    });

    it('should show error from API response', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.resolve({ data: { error: 'No se puede pausar' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pausar suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /pausar suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('No se puede pausar')).toBeInTheDocument();
      });
    });

    it('should show connection error when action throws', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'toggle_subscription_status') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pausar suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /pausar suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Error de conexion')).toBeInTheDocument();
      });
    });

    it('should show error when save fails', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'upsert_customer_subscription') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));
      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));

      await waitFor(() => {
        expect(screen.getByText('Error al guardar suscripcion')).toBeInTheDocument();
      });
    });
  });

  describe('Product Management in Edit Mode', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should increase quantity when plus button is clicked', async () => {
      const user = userEvent.setup();

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));
      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Find plus button
      const buttons = screen.getAllByRole('button');
      const plusButton = buttons.find(btn => btn.querySelector('svg.lucide-plus'));
      if (plusButton) {
        await user.click(plusButton);
      }

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should toggle unit type', async () => {
      const user = userEvent.setup();

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));
      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText(/Libra/)).toBeInTheDocument();
      });

      const toggleButton = screen.getByText(/cambiar/i);
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText(/Media libra/)).toBeInTheDocument();
      });
    });

    it('should remove product when trash button is clicked', async () => {
      const user = userEvent.setup();

      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear suscripcion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /crear suscripcion/i }));
      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('Productos seleccionados (1)')).toBeInTheDocument();
      });

      // Find trash button
      const buttons = screen.getAllByRole('button');
      const trashButton = buttons.find(btn => btn.querySelector('svg.lucide-trash-2'));
      if (trashButton) {
        await user.click(trashButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Selecciona al menos un producto')).toBeInTheDocument();
      });
    });
  });

  describe('Info Card', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_subscription') {
          return Promise.resolve({ data: mockSubscription, error: null });
        }
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
    });

    it('should display info message about subscription', async () => {
      render(<PortalSuscripcionPage />);

      await waitFor(() => {
        expect(screen.getByText(/Con la suscripcion, recibiras tu cafe automaticamente/i)).toBeInTheDocument();
      });
    });
  });
});
