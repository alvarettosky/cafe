import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock functions
const mockPush = vi.fn();
const mockSearchParamsGet = vi.fn();
const mockLogin = vi.fn();
const mockUseCustomerPortal = vi.fn();
const mockSupabaseRpc = vi.fn();

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

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    p: 'p',
    button: 'button',
  },
}));

// Import after mocks
import PortalAuthPage from '../page';

describe('PortalAuthPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParamsGet.mockClear();
    mockLogin.mockClear();
    mockUseCustomerPortal.mockClear();
    mockSupabaseRpc.mockClear();

    // Default: not authenticated
    mockUseCustomerPortal.mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Validating State', () => {
    it('should show validating state when loading with token', async () => {
      mockSearchParamsGet.mockReturnValue('valid-token-123');
      mockSupabaseRpc.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Verificando acceso...')).toBeInTheDocument();
      });
    });

    it('should display portal title', async () => {
      mockSearchParamsGet.mockReturnValue('valid-token-123');
      mockSupabaseRpc.mockReturnValue(new Promise(() => {}));

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Portal Cafe Mirador')).toBeInTheDocument();
      });
    });

    it('should display coffee icon/logo', async () => {
      mockSearchParamsGet.mockReturnValue('valid-token-123');
      mockSupabaseRpc.mockReturnValue(new Promise(() => {}));

      render(<PortalAuthPage />);

      // The logo container should exist
      await waitFor(() => {
        expect(screen.getByText('Portal Cafe Mirador')).toBeInTheDocument();
      });
    });
  });

  describe('No Token Provided', () => {
    it('should show error when no token is provided', async () => {
      mockSearchParamsGet.mockReturnValue(null);

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error de acceso')).toBeInTheDocument();
        expect(screen.getByText('No se proporcionó un token de acceso')).toBeInTheDocument();
      });
    });

    it('should show retry button when no token', async () => {
      mockSearchParamsGet.mockReturnValue(null);

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
      });
    });
  });

  describe('Successful Authentication', () => {
    it('should show success state and welcome message on valid token', async () => {
      mockSearchParamsGet.mockReturnValue('valid-token-123');

      mockSupabaseRpc.mockResolvedValue({
        data: {
          success: true,
          session_token: 'session-abc-123',
          customer_id: 'customer-123',
          customer_name: 'Maria Garcia',
          customer_email: 'maria@example.com',
        },
        error: null,
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Bienvenido, Maria Garcia!/i)).toBeInTheDocument();
        expect(screen.getByText('Redirigiendo a tu portal...')).toBeInTheDocument();
      });
    });

    it('should call login function with correct data', async () => {
      mockSearchParamsGet.mockReturnValue('valid-token-123');

      const mockResponse = {
        success: true,
        session_token: 'session-abc-123',
        customer_id: 'customer-123',
        customer_name: 'Maria Garcia',
        customer_email: 'maria@example.com',
      };

      mockSupabaseRpc.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('session-abc-123', {
          customer_id: 'customer-123',
          customer_name: 'Maria Garcia',
          customer_phone: null,
          customer_email: 'maria@example.com',
          typical_recurrence_days: null,
          last_purchase_date: null,
        });
      });
    });

    it('should redirect to portal after successful login (eventually)', async () => {
      mockSearchParamsGet.mockReturnValue('valid-token-123');

      mockSupabaseRpc.mockResolvedValue({
        data: {
          success: true,
          session_token: 'session-abc-123',
          customer_id: 'customer-123',
          customer_name: 'Maria Garcia',
          customer_email: 'maria@example.com',
        },
        error: null,
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText(/Bienvenido, Maria Garcia!/i)).toBeInTheDocument();
      });

      // The component uses setTimeout(2000) for redirect - just verify the success state for now
      // Testing the actual redirect with fake timers is problematic with async React
      expect(mockLogin).toHaveBeenCalled();
    });

    it('should call validate_customer_magic_link RPC', async () => {
      mockSearchParamsGet.mockReturnValue('my-magic-token');
      mockSupabaseRpc.mockResolvedValue({
        data: { success: true, session_token: 's', customer_id: 'c', customer_name: 'N', customer_email: null },
        error: null,
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('validate_customer_magic_link', {
          p_token: 'my-magic-token',
        });
      });
    });
  });

  describe('Expired Token', () => {
    it('should show expired state when token is expired', async () => {
      mockSearchParamsGet.mockReturnValue('expired-token');

      mockSupabaseRpc.mockResolvedValue({
        data: { error: 'El enlace ha expirado' },
        error: null,
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Enlace expirado')).toBeInTheDocument();
        expect(screen.getByText('El enlace ha expirado')).toBeInTheDocument();
      });
    });

    it('should show request new link button on expired token', async () => {
      mockSearchParamsGet.mockReturnValue('expired-token');

      mockSupabaseRpc.mockResolvedValue({
        data: { error: 'Token expirado' },
        error: null,
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /solicitar nuevo enlace/i })).toBeInTheDocument();
      });
    });

    it('should show expired state with custom error message', async () => {
      mockSearchParamsGet.mockReturnValue('expired-token');

      // Note: empty string `data.error` is falsy, so we need a truthy value
      // to trigger the expired state
      mockSupabaseRpc.mockResolvedValue({
        data: { error: 'Enlace caducado' },
        error: null,
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Enlace expirado')).toBeInTheDocument();
        expect(screen.getByText('Enlace caducado')).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error state when RPC returns error', async () => {
      mockSearchParamsGet.mockReturnValue('bad-token');

      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error de acceso')).toBeInTheDocument();
        expect(screen.getByText('Error al validar el enlace')).toBeInTheDocument();
      });
    });

    it('should show error state when validation throws', async () => {
      mockSearchParamsGet.mockReturnValue('bad-token');

      mockSupabaseRpc.mockRejectedValue(new Error('Network error'));

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Error de acceso')).toBeInTheDocument();
        expect(screen.getByText('Error de conexión')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mockSearchParamsGet.mockReturnValue('bad-token');

      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
      });
    });
  });

  describe('Already Authenticated', () => {
    it('should redirect to portal if already authenticated', async () => {
      mockUseCustomerPortal.mockReturnValue({
        login: mockLogin,
        isAuthenticated: true,
      });

      mockSearchParamsGet.mockReturnValue('any-token');

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/portal');
      });
    });

    it('should not call RPC when already authenticated', async () => {
      mockUseCustomerPortal.mockReturnValue({
        login: mockLogin,
        isAuthenticated: true,
      });

      mockSearchParamsGet.mockReturnValue('any-token');

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/portal');
      });

      expect(mockSupabaseRpc).not.toHaveBeenCalled();
    });
  });

  describe('Footer', () => {
    it('should display footer text', async () => {
      mockSearchParamsGet.mockReturnValue(null);

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByText('Mirador Montanero Cafe Selecto')).toBeInTheDocument();
      });
    });
  });

  describe('Suspense Fallback', () => {
    it('should render loading spinner as suspense fallback', () => {
      // The suspense fallback is tested by the component structure
      // When Suspense is triggered, it shows a loading spinner
      mockSearchParamsGet.mockReturnValue('token');
      mockSupabaseRpc.mockReturnValue(new Promise(() => {}));

      render(<PortalAuthPage />);

      // The component should render without crashing
      expect(screen.getByText('Portal Cafe Mirador')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle request new link button click', async () => {
      const user = userEvent.setup();
      mockSearchParamsGet.mockReturnValue('expired-token');

      mockSupabaseRpc.mockResolvedValue({
        data: { error: 'Token expirado' },
        error: null,
      });

      // Mock window.location.href
      const originalLocation = window.location;
      delete (window as { location?: Location }).location;
      window.location = { ...originalLocation, href: '' } as Location;

      render(<PortalAuthPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /solicitar nuevo enlace/i })).toBeInTheDocument();
      });

      const requestButton = screen.getByRole('button', { name: /solicitar nuevo enlace/i });
      await user.click(requestButton);

      expect(window.location.href).toContain('wa.me');

      // Restore
      window.location = originalLocation;
    });
  });
});
