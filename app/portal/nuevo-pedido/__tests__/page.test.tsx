import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock functions
const mockPush = vi.fn();
const mockUseCustomerPortal = vi.fn();
const mockSupabaseRpc = vi.fn();
const mockSearchParamsGet = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
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
import NuevoPedidoPage from '../page';

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

describe('NuevoPedidoPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseCustomerPortal.mockClear();
    mockSupabaseRpc.mockClear();
    mockSearchParamsGet.mockClear();

    // Default: not repeat order
    mockSearchParamsGet.mockReturnValue(null);

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn().mockReturnValue(null),
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
      });

      render(<NuevoPedidoPage />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading spinner while fetching products', () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      // RPC that never resolves
      mockSupabaseRpc.mockReturnValue(new Promise(() => {}));

      render(<NuevoPedidoPage />);

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

      render(<NuevoPedidoPage />);

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

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Nuevo Pedido')).toBeInTheDocument();
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

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });
    });

    it('should display page header', async () => {
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Nuevo Pedido')).toBeInTheDocument();
      });
    });

    it('should display back button to portal', async () => {
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: '' })).toHaveAttribute('href', '/portal');
      });
    });

    it('should display products section', async () => {
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Selecciona productos')).toBeInTheDocument();
      });
    });

    it('should display available products', async () => {
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
        expect(screen.getByText('Cafe Premium')).toBeInTheDocument();
      });
    });

    it('should display unavailable product with stock warning', async () => {
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
        expect(screen.getByText('Sin stock')).toBeInTheDocument();
      });
    });

    it('should display empty cart message initially', async () => {
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Selecciona los productos que deseas pedir')).toBeInTheDocument();
      });
    });
  });

  describe('Adding Products to Cart', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });
    });

    it('should add product to cart when clicked', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('Tu pedido (1)')).toBeInTheDocument();
        expect(screen.getByText('En carrito')).toBeInTheDocument();
      });
    });

    it('should not add unavailable product to cart', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Find the button for the unavailable product
      const unavailableButton = screen.getByText('Cafe Especial').closest('button');
      expect(unavailableButton).toBeDisabled();
    });

    it('should increase quantity when clicking same product again', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      // Click once
      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('En carrito')).toBeInTheDocument();
      });

      // Click again - need to find the button in the product grid
      const productButtons = screen.getAllByText('Cafe Origen');
      await user.click(productButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Cart Management', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });
    });

    it('should display cart with products', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('Tu pedido (1)')).toBeInTheDocument();
      });
    });

    it('should toggle unit type from libra to media libra', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText(/Libra/)).toBeInTheDocument();
      });

      // Click the unit toggle button
      const toggleButton = screen.getByText(/cambiar/i);
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText(/Media libra/)).toBeInTheDocument();
      });
    });

    it('should increase quantity when plus button is clicked', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Find and click plus button
      const buttons = screen.getAllByRole('button');
      const plusButton = buttons.find(btn => btn.querySelector('svg.lucide-plus'));
      if (plusButton) {
        await user.click(plusButton);
      }

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should decrease quantity when minus button is clicked', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      // Add product once first
      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('En carrito')).toBeInTheDocument();
      });

      // Add again to get quantity 2 (use getAllByText since text appears twice now)
      const productButtons = screen.getAllByText('Cafe Origen');
      await user.click(productButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });

      // Find and click minus button
      const buttons = screen.getAllByRole('button');
      const minusButton = buttons.find(btn => btn.querySelector('svg.lucide-minus'));
      if (minusButton) {
        await user.click(minusButton);
      }

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should remove product from cart when quantity reaches zero', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('Tu pedido (1)')).toBeInTheDocument();
      });

      // Find and click minus button
      const buttons = screen.getAllByRole('button');
      const minusButton = buttons.find(btn => btn.querySelector('svg.lucide-minus'));
      if (minusButton) {
        await user.click(minusButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Selecciona los productos que deseas pedir')).toBeInTheDocument();
      });
    });

    it('should remove product when trash button is clicked', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('Tu pedido (1)')).toBeInTheDocument();
      });

      // Find and click trash button
      const buttons = screen.getAllByRole('button');
      const trashButton = buttons.find(btn => btn.querySelector('svg.lucide-trash-2'));
      if (trashButton) {
        await user.click(trashButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Selecciona los productos que deseas pedir')).toBeInTheDocument();
      });
    });
  });

  describe('Notes Field', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });
    });

    it('should display notes textarea in cart', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByText('Notas adicionales (opcional)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Entregar en la tarde/i)).toBeInTheDocument();
      });
    });

    it('should allow typing notes', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Entregar en la tarde/i)).toBeInTheDocument();
      });

      const notesField = screen.getByPlaceholderText(/Entregar en la tarde/i);
      await user.type(notesField, 'Molienda fina por favor');

      expect(notesField).toHaveValue('Molienda fina por favor');
    });
  });

  describe('Order Submission', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });
    });

    it('should display submit button when cart has items', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enviar pedido/i })).toBeInTheDocument();
      });
    });

    it('should call create_customer_order RPC when submitting', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enviar pedido/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('create_customer_order', {
          p_customer_id: mockCustomer.customer_id,
          p_items: [
            {
              product_id: 'prod-1',
              quantity: 1,
              unit_type: 'libra',
            },
          ],
          p_notes: null,
        });
      });
    });

    it('should show success screen after successful submission', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(screen.getByText('Pedido Recibido!')).toBeInTheDocument();
        expect(screen.getByText(/Te confirmaremos pronto por WhatsApp/i)).toBeInTheDocument();
      });
    });

    it('should display back to home link on success', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /volver al inicio/i })).toHaveAttribute(
          'href',
          '/portal'
        );
      });
    });

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup();

      let resolveSubmit: (value: { data: unknown; error: null }) => void;
      const submitPromise = new Promise<{ data: unknown; error: null }>((resolve) => {
        resolveSubmit = resolve;
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return submitPromise;
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      const submitButton = screen.getByRole('button', { name: /enviar pedido/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      // Cleanup
      resolveSubmit!({ data: { success: true }, error: null });
    });

    it('should include notes in submission', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      const notesField = screen.getByPlaceholderText(/Entregar en la tarde/i);
      await user.type(notesField, 'Molienda fina');

      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('create_customer_order', {
          p_customer_id: mockCustomer.customer_id,
          p_items: expect.any(Array),
          p_notes: 'Molienda fina',
        });
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

    it('should show error when submission fails with Supabase error', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(screen.getByText('Error al enviar pedido')).toBeInTheDocument();
      });
    });

    it('should show error from API response', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.resolve({ data: { error: 'Producto no disponible' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(screen.getByText('Producto no disponible')).toBeInTheDocument();
      });
    });

    it('should show connection error when submission throws', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(screen.getByText('Error de conexion')).toBeInTheDocument();
      });
    });
  });

  describe('Repeat Order', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });
    });

    it('should load cart from sessionStorage when repeat=true', async () => {
      mockSearchParamsGet.mockReturnValue('true');

      const repeatOrderData = JSON.stringify([
        { product_id: 'prod-1', product_name: 'Cafe Origen', quantity: 2, unit: 'libra' },
      ]);

      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: vi.fn().mockReturnValue(repeatOrderData),
          removeItem: vi.fn(),
          setItem: vi.fn(),
        },
        writable: true,
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(window.sessionStorage.getItem).toHaveBeenCalledWith('repeat_order');
      });
    });

    it('should remove repeat_order from sessionStorage after loading', async () => {
      mockSearchParamsGet.mockReturnValue('true');

      const repeatOrderData = JSON.stringify([
        { product_id: 'prod-1', product_name: 'Cafe Origen', quantity: 2, unit: 'libra' },
      ]);

      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: vi.fn().mockReturnValue(repeatOrderData),
          removeItem: vi.fn(),
          setItem: vi.fn(),
        },
        writable: true,
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('repeat_order');
      });
    });

    it('should handle invalid JSON in sessionStorage', async () => {
      mockSearchParamsGet.mockReturnValue('true');

      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: vi.fn().mockReturnValue('invalid json'),
          removeItem: vi.fn(),
          setItem: vi.fn(),
        },
        writable: true,
      });

      // Should not throw
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Nuevo Pedido')).toBeInTheDocument();
      });
    });
  });

  describe('Price Information', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });
    });

    it('should display price confirmation message', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));

      await waitFor(() => {
        expect(
          screen.getByText('El precio final te lo confirmaremos por WhatsApp')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Products', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
      });

      mockSupabaseRpc.mockResolvedValue({ data: mockProducts, error: null });
    });

    it('should handle multiple products in cart', async () => {
      const user = userEvent.setup();
      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByText('Cafe Premium'));

      await waitFor(() => {
        expect(screen.getByText('Tu pedido (2)')).toBeInTheDocument();
      });
    });

    it('should submit all products in cart', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_products_for_customer_order') {
          return Promise.resolve({ data: mockProducts, error: null });
        }
        if (rpcName === 'create_customer_order') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<NuevoPedidoPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Origen')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cafe Origen'));
      await user.click(screen.getByText('Cafe Premium'));

      await user.click(screen.getByRole('button', { name: /enviar pedido/i }));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('create_customer_order', {
          p_customer_id: mockCustomer.customer_id,
          p_items: [
            { product_id: 'prod-1', quantity: 1, unit_type: 'libra' },
            { product_id: 'prod-2', quantity: 1, unit_type: 'libra' },
          ],
          p_notes: null,
        });
      });
    });
  });
});
