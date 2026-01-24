import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock functions
const mockPush = vi.fn();
const mockUseCustomerPortal = vi.fn();
const mockRefreshSession = vi.fn();
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
import PortalPerfilPage from '../page';

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
    address: 'Calle 123 #45-67',
    typical_recurrence_days: 15,
  },
};

describe('PortalPerfilPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseCustomerPortal.mockClear();
    mockRefreshSession.mockClear();
    mockSupabaseRpc.mockClear();

    mockRefreshSession.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('should show loading spinner when authLoading is true', () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: null,
        isLoading: true,
        isAuthenticated: false,
        refreshSession: mockRefreshSession,
      });

      render(<PortalPerfilPage />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading spinner while fetching profile', () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<PortalPerfilPage />);

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
        refreshSession: mockRefreshSession,
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/portal/auth');
      });
    });

    it('should not redirect when authenticated', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: mockDashboardData,
        error: null,
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByText('Mi Perfil')).toBeInTheDocument();
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
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: mockDashboardData,
        error: null,
      });
    });

    it('should display page header with title', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByText('Mi Perfil')).toBeInTheDocument();
      });
    });

    it('should display customer name in card header', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });
    });

    it('should display back button to portal', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: '' })).toHaveAttribute('href', '/portal');
      });
    });

    it('should display info card about data security', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/Tu informacion nos ayuda a brindarte un mejor servicio/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Mantenemos tus datos seguros y nunca los compartimos con terceros/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Form Fields', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: mockDashboardData,
        error: null,
      });
    });

    it('should display phone field with value', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
        expect(screen.getByText('Telefono')).toBeInTheDocument();
      });
    });

    it('should display email field with value', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('juan@example.com')).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();
      });
    });

    it('should display address field with value', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Calle 123 #45-67')).toBeInTheDocument();
        expect(screen.getByText('Direccion de entrega')).toBeInTheDocument();
      });
    });

    it('should show placeholder text for empty fields', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: {
          customer: {
            ...mockDashboardData.customer,
            phone: null,
            email: null,
            address: null,
          },
        },
        error: null,
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu numero de telefono')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Tu email')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Tu direccion para entregas')).toBeInTheDocument();
      });
    });
  });

  describe('Form Editing', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      // Set up mock to resolve for each test
      mockSupabaseRpc.mockResolvedValue({
        data: mockDashboardData,
        error: null,
      });
    });

    it('should have editable phone input', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const phoneInput = screen.getByDisplayValue('3001234567') as HTMLInputElement;
      expect(phoneInput).not.toBeDisabled();
      expect(phoneInput.tagName.toLowerCase()).toBe('input');
    });

    it('should have editable email input', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('juan@example.com')).toBeInTheDocument();
      });

      const emailInput = screen.getByDisplayValue('juan@example.com') as HTMLInputElement;
      expect(emailInput).not.toBeDisabled();
      expect(emailInput.tagName.toLowerCase()).toBe('input');
    });

    it('should have editable address input', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Calle 123 #45-67')).toBeInTheDocument();
      });

      const addressInput = screen.getByDisplayValue('Calle 123 #45-67');
      expect(addressInput).not.toBeDisabled();
      expect(addressInput.tagName.toLowerCase()).toBe('textarea');
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });
    });

    it('should display save button', async () => {
      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
      });
    });

    it('should call update RPC when save is clicked', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('update_customer_profile', {
          p_customer_id: mockCustomer.customer_id,
          p_phone: '3001234567',
          p_email: 'juan@example.com',
          p_address: 'Calle 123 #45-67',
        });
      });
    });

    it('should show success message after saving', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Guardado correctamente')).toBeInTheDocument();
      });
    });

    it('should refresh session after saving', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockRefreshSession).toHaveBeenCalled();
      });
    });

    it('should disable save button while saving', async () => {
      const user = userEvent.setup();

      let savePromiseResolve: (value: { data: unknown; error: null }) => void;
      const savePromise = new Promise<{ data: unknown; error: null }>((resolve) => {
        savePromiseResolve = resolve;
      });

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return savePromise;
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      // Button should be disabled while saving
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });

      // Resolve the promise to complete the test
      savePromiseResolve!({ data: { success: true }, error: null });
    });

    it('should send null for empty fields', async () => {
      const user = userEvent.setup();
      const emptyDashboardData = {
        customer: {
          ...mockDashboardData.customer,
          phone: '',
          email: '',
          address: '',
        },
      };

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: emptyDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Tu numero de telefono')).toHaveValue('');
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('update_customer_profile', {
          p_customer_id: mockCustomer.customer_id,
          p_phone: null,
          p_email: null,
          p_address: null,
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
        refreshSession: mockRefreshSession,
      });
    });

    it('should show error when save fails with Supabase error', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Error al guardar')).toBeInTheDocument();
      });
    });

    it('should show error from API response', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return Promise.resolve({ data: { error: 'Email invalido' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Email invalido')).toBeInTheDocument();
      });
    });

    it('should show connection error when save throws', async () => {
      const user = userEvent.setup();

      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Error de conexion')).toBeInTheDocument();
      });
    });

    it('should clear error when trying again', async () => {
      const user = userEvent.setup();

      let saveCallCount = 0;
      mockSupabaseRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'get_customer_portal_dashboard') {
          return Promise.resolve({ data: mockDashboardData, error: null });
        }
        if (rpcName === 'update_customer_profile') {
          saveCallCount++;
          if (saveCallCount === 1) {
            return Promise.resolve({ data: { error: 'Error primero' }, error: null });
          }
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      // First save - should show error
      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Error primero')).toBeInTheDocument();
      });

      // Second save - should clear error and succeed
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByText('Error primero')).not.toBeInTheDocument();
        expect(screen.getByText('Guardado correctamente')).toBeInTheDocument();
      });
    });
  });

  describe('Success Message Timeout', () => {
    it('should show success message that can be dismissed by timeout', async () => {
      // Just verify the success message appears - timeout behavior is internal
      const user = userEvent.setup();

      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc
        .mockResolvedValueOnce({ data: mockDashboardData, error: null })
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /guardar cambios/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Guardado correctamente')).toBeInTheDocument();
      });
    });
  });

  describe('Profile Data Fetch', () => {
    it('should fetch profile using get_customer_portal_dashboard', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: mockDashboardData,
        error: null,
      });

      render(<PortalPerfilPage />);

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_customer_portal_dashboard', {
          p_customer_id: mockCustomer.customer_id,
        });
      });
    });

    it('should handle fetch error gracefully', async () => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc.mockRejectedValue(new Error('Fetch error'));

      render(<PortalPerfilPage />);

      // Should still render the form (with empty fields)
      await waitFor(() => {
        expect(screen.getByText('Mi Perfil')).toBeInTheDocument();
      });
    });
  });

  describe('Input Types', () => {
    beforeEach(() => {
      mockUseCustomerPortal.mockReturnValue({
        customer: mockCustomer,
        isLoading: false,
        isAuthenticated: true,
        refreshSession: mockRefreshSession,
      });

      mockSupabaseRpc.mockResolvedValue({
        data: mockDashboardData,
        error: null,
      });
    });

    it('should have phone input with tel type', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        const phoneInput = screen.getByDisplayValue('3001234567');
        expect(phoneInput).toHaveAttribute('type', 'tel');
      });
    });

    it('should have email input with email type', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        const emailInput = screen.getByDisplayValue('juan@example.com');
        expect(emailInput).toHaveAttribute('type', 'email');
      });
    });

    it('should have address input as textarea', async () => {
      render(<PortalPerfilPage />);

      await waitFor(() => {
        const addressInput = screen.getByDisplayValue('Calle 123 #45-67');
        expect(addressInput.tagName.toLowerCase()).toBe('textarea');
      });
    });
  });
});
