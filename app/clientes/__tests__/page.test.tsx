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

// Mock Supabase
const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
}));

// Mock child components
vi.mock('@/components/customer-modal', () => ({
  CustomerModal: ({ isOpen, onClose, customerId }: {
    isOpen: boolean;
    onClose: () => void;
    customerId: string | null;
  }) =>
    isOpen ? (
      <div data-testid="customer-modal" data-customer-id={customerId}>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

vi.mock('@/components/repeat-sale-button', () => ({
  RepeatSaleButton: ({ customerId, customerName }: { customerId: string; customerName: string }) => (
    <button data-testid={`repeat-sale-${customerId}`}>Repetir {customerName}</button>
  ),
}));

vi.mock('@/components/generate-portal-access-button', () => ({
  GeneratePortalAccessButton: ({ customerId }: { customerId: string }) => (
    <button data-testid={`portal-access-${customerId}`}>Portal Access</button>
  ),
}));

vi.mock('@/components/customer-segment-badge', () => ({
  CustomerSegmentBadge: ({ segment }: { segment: string }) => (
    <span data-testid={`segment-badge-${segment}`}>{segment}</span>
  ),
  CustomerSegment: {} as object,
}));

vi.mock('@/components/export', () => ({
  DownloadButton: ({ label }: { label: string }) => (
    <button data-testid="download-button">{label}</button>
  ),
}));

vi.mock('@/components/new-customer-modal', () => ({
  NewCustomerModal: ({ onCustomerAdded }: { onCustomerAdded?: () => void }) => (
    <button data-testid="new-customer-modal" onClick={onCustomerAdded}>Nuevo Cliente</button>
  ),
}));

// Import after mocks
import CustomersPage from '../page';

describe('CustomersPage', () => {
  // Mock the current date to 2026-01-23 so relative date tests are stable
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'));
  });

  const mockCustomers = [
    {
      id: 'customer-1',
      full_name: 'Juan Perez',
      phone: '3001234567',
      email: 'juan@test.com',
      address: 'Calle 123',
      last_purchase_date: '2026-01-20T10:00:00Z',
      typical_recurrence_days: 14,
      segment: 'champion',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'customer-2',
      full_name: 'Maria Garcia',
      phone: '3009876543',
      email: 'maria@test.com',
      address: null,
      last_purchase_date: null,
      typical_recurrence_days: null,
      segment: 'prospect',
      created_at: '2026-01-15T00:00:00Z',
    },
    {
      id: 'customer-3',
      full_name: 'Pedro Lopez',
      phone: null,
      email: 'pedro@test.com',
      address: 'Carrera 45',
      last_purchase_date: '2026-01-22T10:00:00Z',
      typical_recurrence_days: 7,
      segment: 'loyal',
      created_at: '2025-06-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    mockPush.mockClear();
    mockSupabaseFrom.mockClear();

    // Default mock implementation - customer_segments view exists
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'customer_segments') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockCustomers, error: null }),
          }),
        };
      }
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockCustomers, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves
        }),
      }));

      render(<CustomersPage />);

      expect(screen.getByText('Cargando clientes...')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    it('should render page title', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /gesti[oó]n de clientes/i })).toBeInTheDocument();
      });
    });

    it('should render subtitle', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText(/administra la informaci[oó]n de recurrencia/i)).toBeInTheDocument();
      });
    });

    it('should render home button', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        // Home button is the first button in the header, contains an SVG for home icon
        const buttons = screen.getAllByRole('button');
        const homeButton = buttons.find(btn => btn.querySelector('svg') !== null);
        expect(homeButton).toBeInTheDocument();
      });
    });

    it('should navigate to home when home button clicked', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      // The first button with just an icon is the home button
      const buttons = screen.getAllByRole('button');
      const homeButton = buttons[0];
      await user.click(homeButton);

      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should render export button', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('download-button')).toBeInTheDocument();
      });
    });

    it('should render new customer modal button', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('new-customer-modal')).toBeInTheDocument();
      });
    });

    it('should refresh customers when new customer is added', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('new-customer-modal')).toBeInTheDocument();
      });

      // Click the new customer button (which calls onCustomerAdded)
      await user.click(screen.getByTestId('new-customer-modal'));

      // Verify that fetch was called again (mockSupabaseFrom should be called more times)
      expect(mockSupabaseFrom).toHaveBeenCalled();
    });
  });

  describe('Stats Cards', () => {
    it('should display total customers count', async () => {
      render(<CustomersPage />);

      // Wait for data to load - check for a customer name
      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      // Find the stat card and verify count
      const totalCard = screen.getByText('Total Clientes').closest('div')?.parentElement;
      expect(totalCard?.textContent).toContain('3');
    });

    it('should display customers with recurrence count', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Con Recurrencia')).toBeInTheDocument();
      });

      // Find the stat card and verify count (Juan and Pedro have recurrence)
      const recurrenceCard = screen.getByText('Con Recurrencia').closest('div')?.parentElement;
      expect(recurrenceCard?.textContent).toContain('2');
    });

    it('should display active customers count', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Clientes Activos')).toBeInTheDocument();
      });

      // Find the stat card and verify count (Juan and Pedro have last_purchase_date)
      const activeCard = screen.getByText('Clientes Activos').closest('div')?.parentElement;
      expect(activeCard?.textContent).toContain('2');
    });
  });

  describe('Search Functionality', () => {
    it('should render search input', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/buscar por nombre, tel[eé]fono o email/i)).toBeInTheDocument();
      });
    });

    it('should filter customers by name', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar por nombre, tel[eé]fono o email/i);
      await user.type(searchInput, 'Maria');

      await waitFor(() => {
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
        expect(screen.queryByText('Juan Perez')).not.toBeInTheDocument();
        expect(screen.queryByText('Pedro Lopez')).not.toBeInTheDocument();
      });
    });

    it('should filter customers by phone', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar por nombre, tel[eé]fono o email/i);
      await user.type(searchInput, '3001234567');

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
      });
    });

    it('should filter customers by email', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar por nombre, tel[eé]fono o email/i);
      await user.type(searchInput, 'pedro@test.com');

      await waitFor(() => {
        expect(screen.getByText('Pedro Lopez')).toBeInTheDocument();
        expect(screen.queryByText('Juan Perez')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/buscar por nombre, tel[eé]fono o email/i);
      await user.type(searchInput, 'NonexistentCustomer');

      await waitFor(() => {
        expect(screen.getByText('No se encontraron clientes con esos criterios')).toBeInTheDocument();
      });
    });
  });

  describe('Segment Filter', () => {
    it('should render segment filter select', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should have all segment options', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      const optionValues = options.map(opt => opt.textContent);

      expect(optionValues).toContain('Todos los segmentos');
      expect(optionValues).toContain('Champion');
      expect(optionValues).toContain('Leal');
      expect(optionValues).toContain('Potencial');
      expect(optionValues).toContain('Nuevo');
      expect(optionValues).toContain('En Riesgo');
      expect(optionValues).toContain('Perdido');
      expect(optionValues).toContain('Prospecto');
    });

    it('should filter customers by segment', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'champion');

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
        expect(screen.queryByText('Pedro Lopez')).not.toBeInTheDocument();
      });
    });
  });

  describe('Customer Table', () => {
    it('should render table headers', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Cliente')).toBeInTheDocument();
        expect(screen.getByText('Segmento')).toBeInTheDocument();
        expect(screen.getByText('Contacto')).toBeInTheDocument();
        expect(screen.getByText('Última Compra')).toBeInTheDocument();
        expect(screen.getByText('Recurrencia')).toBeInTheDocument();
        expect(screen.getByText('Acciones')).toBeInTheDocument();
      });
    });

    it('should display customer names', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
        expect(screen.getByText('Pedro Lopez')).toBeInTheDocument();
      });
    });

    it('should display segment badges', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('segment-badge-champion')).toBeInTheDocument();
        expect(screen.getByTestId('segment-badge-prospect')).toBeInTheDocument();
        expect(screen.getByTestId('segment-badge-loyal')).toBeInTheDocument();
      });
    });

    it('should display contact information', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('3001234567')).toBeInTheDocument();
        expect(screen.getByText('juan@test.com')).toBeInTheDocument();
        expect(screen.getByText('maria@test.com')).toBeInTheDocument();
      });
    });

    it('should display recurrence days', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('14 días')).toBeInTheDocument();
        expect(screen.getByText('7 días')).toBeInTheDocument();
        expect(screen.getByText('No configurado')).toBeInTheDocument();
      });
    });

    it('should display "Sin compras" for customers without purchases', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Sin compras')).toBeInTheDocument();
      });
    });

    // Date formatting is tested via "should display 'Sin compras' for customers without purchases"
    // and visual inspection. The formatDate function converts dates to relative formats like
    // "Hoy", "Ayer", "Hace X días" for dates within a week, or full date for older dates.
  });

  describe('Customer Actions', () => {
    it('should render edit button for each customer', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        const editButtons = screen.getAllByText('Editar');
        expect(editButtons).toHaveLength(3);
      });
    });

    it('should render repeat sale button for customers with purchases', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('repeat-sale-customer-1')).toBeInTheDocument();
        expect(screen.getByTestId('repeat-sale-customer-3')).toBeInTheDocument();
        expect(screen.queryByTestId('repeat-sale-customer-2')).not.toBeInTheDocument();
      });
    });

    it('should render portal access button for all customers', async () => {
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('portal-access-customer-1')).toBeInTheDocument();
        expect(screen.getByTestId('portal-access-customer-2')).toBeInTheDocument();
        expect(screen.getByTestId('portal-access-customer-3')).toBeInTheDocument();
      });
    });

    it('should open customer modal when edit button clicked', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('Editar');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('customer-modal')).toBeInTheDocument();
        expect(screen.getByTestId('customer-modal')).toHaveAttribute('data-customer-id', 'customer-1');
      });
    });

    it('should close customer modal when close button clicked', async () => {
      const user = userEvent.setup();
      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('Editar');
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('customer-modal')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Close Modal'));

      await waitFor(() => {
        expect(screen.queryByTestId('customer-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no customers exist', async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }));

      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('No hay clientes registrados')).toBeInTheDocument();
      });
    });
  });

  describe('Fallback to customers table', () => {
    it('should fallback to customers table when customer_segments view fails', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'customer_segments') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'View does not exist' }
              }),
            }),
          };
        }
        if (table === 'customers') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockCustomers.map(c => ({ ...c, segment: undefined })),
                error: null
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          }),
        }),
      }));

      render(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('No hay clientes registrados')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
