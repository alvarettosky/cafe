import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerModal } from '../customer-modal';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn()
        }))
      }))
    })),
    rpc: vi.fn()
  }
}));

describe('CustomerModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCustomerUpdated = vi.fn();
  const mockCustomerId = '123e4567-e89b-12d3-a456-426614174000';

  const mockCustomer = {
    id: mockCustomerId,
    full_name: 'Juan Pérez',
    phone: '3001234567',
    email: 'juan@ejemplo.com',
    address: 'Calle 123 #45-67',
    last_purchase_date: '2026-01-15T10:00:00Z',
    typical_recurrence_days: 7,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2026-01-15T10:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      const fromMock = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => new Promise(() => {})) // Never resolves
          }))
        }))
      }));

      (supabase.from as any).mockImplementation(fromMock);
      (supabase.rpc as any).mockResolvedValue({ data: 8, error: null });

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      expect(screen.getByText('Cargando información del cliente...')).toBeInTheDocument();
    });
  });

  describe('Customer Data Display', () => {
    beforeEach(() => {
      const fromMock = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockCustomer, error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockImplementation(fromMock);
      (supabase.rpc as any).mockResolvedValue({ data: 8, error: null });
    });

    it('should display customer information correctly', async () => {
      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      expect(screen.getByDisplayValue('juan@ejemplo.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Calle 123 #45-67')).toBeInTheDocument();
    });

    it('should display address field', async () => {
      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Dirección')).toBeInTheDocument();
      });
    });

    it('should show suggested recurrence', async () => {
      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Recurrencia típica/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Editing', () => {
    beforeEach(() => {
      const fromMock = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockCustomer, error: null }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [mockCustomer], error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockImplementation(fromMock);
      (supabase.rpc as any).mockResolvedValue({ data: 8, error: null });
    });

    it('should allow editing customer name', async () => {
      const user = userEvent.setup();

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Juan Pérez');
      await user.clear(nameInput);
      await user.type(nameInput, 'María García');

      expect(nameInput).toHaveValue('María García');
    });

    it('should allow editing phone number', async () => {
      const user = userEvent.setup();

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('3001234567')).toBeInTheDocument();
      });

      const phoneInput = screen.getByDisplayValue('3001234567');
      await user.clear(phoneInput);
      await user.type(phoneInput, '3009876543');

      expect(phoneInput).toHaveValue('3009876543');
    });

    it('should allow editing address', async () => {
      const user = userEvent.setup();

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Calle 123 #45-67')).toBeInTheDocument();
      });

      const addressInput = screen.getByDisplayValue('Calle 123 #45-67');
      await user.clear(addressInput);
      await user.type(addressInput, 'Carrera 45 #67-89');

      expect(addressInput).toHaveValue('Carrera 45 #67-89');
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      const fromMock = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockCustomer, error: null }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [mockCustomer], error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockImplementation(fromMock);
      (supabase.rpc as any).mockResolvedValue({ data: 8, error: null });
    });

    it('should save customer changes', async () => {
      const user = userEvent.setup();

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Guardar cambios');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnCustomerUpdated).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show error if name is empty', async () => {
      const user = userEvent.setup();

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Juan Pérez');
      await user.clear(nameInput);

      const saveButton = screen.getByText('Guardar cambios');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('El nombre es requerido')).toBeInTheDocument();
      });

      expect(mockOnCustomerUpdated).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Modal Actions', () => {
    beforeEach(() => {
      const fromMock = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockCustomer, error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockImplementation(fromMock);
      (supabase.rpc as any).mockResolvedValue({ data: 8, error: null });
    });

    it('should close modal when cancel button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancelar');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not render when customerId is null', () => {
      const { container } = render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={null}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Error Handling', () => {
    it('should display error when fetch fails', async () => {
      const fromMock = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Database error' }
            }))
          }))
        }))
      }));

      (supabase.from as any).mockImplementation(fromMock);
      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      render(
        <CustomerModal
          isOpen={true}
          onClose={mockOnClose}
          customerId={mockCustomerId}
          onCustomerUpdated={mockOnCustomerUpdated}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error al cargar datos del cliente')).toBeInTheDocument();
      });
    });
  });
});
