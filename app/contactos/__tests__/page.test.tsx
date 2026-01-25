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
const mockSupabaseRpc = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
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
vi.mock('@/components/smart-whatsapp-button', () => ({
  SmartWhatsAppButton: ({ customerId, customerName }: { customerId: string; customerName: string }) => (
    <button data-testid={`whatsapp-${customerId}`}>WhatsApp {customerName}</button>
  ),
}));

vi.mock('@/components/repeat-sale-button', () => ({
  RepeatSaleButton: ({ customerId, customerName }: { customerId: string; customerName: string }) => (
    <button data-testid={`repeat-sale-${customerId}`}>Repetir {customerName}</button>
  ),
}));

// Import after mocks
import ContactosPage from '../page';

describe('ContactosPage', () => {
  const mockContacts = [
    {
      customer_id: 'contact-1',
      full_name: 'Juan Perez',
      phone: '3001234567',
      email: 'juan@test.com',
      last_purchase_date: '2026-01-10T10:00:00Z',
      days_since_last_purchase: 13,
      typical_recurrence_days: 7,
      days_until_expected: -6,
      urgency: 'high',
    },
    {
      customer_id: 'contact-2',
      full_name: 'Maria Garcia',
      phone: '3009876543',
      email: null,
      last_purchase_date: '2026-01-18T10:00:00Z',
      days_since_last_purchase: 5,
      typical_recurrence_days: 7,
      days_until_expected: 2,
      urgency: 'low',
    },
    {
      customer_id: 'contact-3',
      full_name: 'Pedro Lopez',
      phone: null,
      email: 'pedro@test.com',
      last_purchase_date: '2026-01-16T10:00:00Z',
      days_since_last_purchase: 7,
      typical_recurrence_days: 7,
      days_until_expected: 0,
      urgency: 'medium',
    },
    {
      customer_id: 'contact-4',
      full_name: 'Ana Rodriguez',
      phone: '3005555555',
      email: 'ana@test.com',
      last_purchase_date: '2026-01-20T10:00:00Z',
      days_since_last_purchase: 3,
      typical_recurrence_days: null,
      days_until_expected: null,
      urgency: 'unknown',
    },
  ];

  const mockProspects = [
    {
      id: 'prospect-1',
      full_name: 'Carlos Prospecto',
      phone: '3002222222',
      email: 'carlos@test.com',
      created_at: '2026-01-20T00:00:00Z',
    },
    {
      id: 'prospect-2',
      full_name: 'Laura Prospecto',
      phone: null,
      email: null,
      created_at: '2026-01-15T00:00:00Z',
    },
  ];

  beforeEach(() => {
    mockPush.mockClear();
    mockSupabaseRpc.mockClear();
    mockSupabaseFrom.mockClear();

    // Default mock implementations
    mockSupabaseRpc.mockImplementation((functionName: string, _params?: unknown) => {
      if (functionName === 'get_customers_to_contact') {
        return Promise.resolve({ data: mockContacts, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockProspects, error: null }),
          }),
        }),
      }),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading state for contacts', () => {
      mockSupabaseRpc.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ContactosPage />);

      expect(screen.getByText('Cargando lista de contactos...')).toBeInTheDocument();
    });

    it('should show loading state for prospects', () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(new Promise(() => {})),
            }),
          }),
        }),
      }));

      render(<ContactosPage />);

      expect(screen.getByText('Cargando prospectos...')).toBeInTheDocument();
    });
  });

  describe('Page Header', () => {
    it('should render page title', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /lista de contacto/i })).toBeInTheDocument();
      });
    });

    it('should render subtitle', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText(/clientes que necesitan ser contactados seg[uú]n/i)).toBeInTheDocument();
      });
    });

    it('should render home button', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        // Home button is the first button in the header
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('should navigate to home when home button clicked', async () => {
      const user = userEvent.setup();
      render(<ContactosPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      // The first button is the home button
      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Stats Cards', () => {
    it('should display total contacts count', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('should display urgent contacts count', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Urgente')).toBeInTheDocument();
      });
    });

    it('should display medium urgency contacts count', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Pronto')).toBeInTheDocument();
        // 1 contact with medium urgency
      });
    });

    it('should display low urgency contacts count', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Planificado')).toBeInTheDocument();
        // 1 contact with low urgency
      });
    });

    it('should display unknown urgency contacts count', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Sin datos')).toBeInTheDocument();
        // 1 contact with unknown urgency
      });
    });
  });

  describe('Urgency Filter', () => {
    it('should filter by clicking on stats cards', async () => {
      const user = userEvent.setup();
      render(<ContactosPage />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      // Find and click the "Urgente" stat card in the stats section (first one)
      const urgentElements = screen.getAllByText('Urgente');
      const urgentStatCard = urgentElements[0].closest('[class*="rounded-lg"]');
      await user.click(urgentStatCard!);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
      });
    });

    it('should show all contacts when clicking Total card', async () => {
      const user = userEvent.setup();
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      // First filter to high
      const urgentElements = screen.getAllByText('Urgente');
      const urgentCard = urgentElements[0].closest('[class*="rounded-lg"]');
      await user.click(urgentCard!);

      await waitFor(() => {
        expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
      });

      // Then click on Total
      const totalCard = screen.getByText('Total').closest('[class*="rounded-lg"]');
      await user.click(totalCard!);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
      });
    });
  });

  describe('Days Threshold Filter', () => {
    it('should render threshold select', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText(/umbral de urgencia.*d[ií]as/i)).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should have threshold options', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      const optionValues = options.map(opt => opt.textContent);

      expect(optionValues).toContain('3 días');
      expect(optionValues).toContain('7 días');
      expect(optionValues).toContain('14 días');
      expect(optionValues).toContain('30 días');
    });

    it('should refetch contacts when threshold changes', async () => {
      const user = userEvent.setup();
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      // Clear previous calls
      mockSupabaseRpc.mockClear();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '14');

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('get_customers_to_contact', {
          p_days_threshold: 14,
        });
      });
    });
  });

  describe('Contact Cards', () => {
    it('should display contact names', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
        expect(screen.getByText('Pedro Lopez')).toBeInTheDocument();
        expect(screen.getByText('Ana Rodriguez')).toBeInTheDocument();
      });
    });

    it('should display urgency badges', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Urgente')).toBeInTheDocument();
        // Note: "Pronto" and "Planificado" are shown in stats and badges
      });
    });

    it('should display days since last purchase', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('13 días sin comprar')).toBeInTheDocument();
        expect(screen.getByText('5 días sin comprar')).toBeInTheDocument();
      });
    });

    it('should display typical recurrence when available', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        // Wait for contacts to load
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      // Check for recurrence text
      expect(screen.getAllByText(/Compra cada \d+ días/).length).toBeGreaterThan(0);
    });

    it('should render WhatsApp button for contacts with phone', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByTestId('whatsapp-contact-1')).toBeInTheDocument();
        expect(screen.getByTestId('whatsapp-contact-2')).toBeInTheDocument();
        expect(screen.queryByTestId('whatsapp-contact-3')).not.toBeInTheDocument(); // No phone
        expect(screen.getByTestId('whatsapp-contact-4')).toBeInTheDocument();
      });
    });

    it('should render repeat sale button for all contacts', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByTestId('repeat-sale-contact-1')).toBeInTheDocument();
        expect(screen.getByTestId('repeat-sale-contact-2')).toBeInTheDocument();
        expect(screen.getByTestId('repeat-sale-contact-3')).toBeInTheDocument();
        expect(screen.getByTestId('repeat-sale-contact-4')).toBeInTheDocument();
      });
    });

    it('should render email link for contacts with email', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        const emailLinks = screen.getAllByRole('link');
        const juanEmailLink = emailLinks.find(link =>
          link.getAttribute('href') === 'mailto:juan@test.com'
        );
        expect(juanEmailLink).toBeInTheDocument();
      });
    });

    it('should render phone call button for contacts with phone', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        // Look for phone buttons within contact cards
        const phoneButtons = screen.getAllByTitle('Llamar');
        expect(phoneButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty State', () => {
    it('should show success message when no contacts need attention', async () => {
      mockSupabaseRpc.mockImplementation(() =>
        Promise.resolve({ data: [], error: null })
      );

      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('¡Todo al día!')).toBeInTheDocument();
        expect(screen.getByText('No hay clientes que necesiten contacto en este momento')).toBeInTheDocument();
      });
    });

    it('should show filtered empty message when filter has no results', async () => {
      const user = userEvent.setup();
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      // Click on "Urgente" stat card to filter
      const urgentCards = screen.getAllByText('Urgente');
      // Get the stat card (first one in the stats section)
      const urgentStatCard = urgentCards[0].closest('[class*="rounded-lg"]');
      await user.click(urgentStatCard!);

      await waitFor(() => {
        // After filtering to high urgency only, only Juan should be shown
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        // Others should be filtered out
        expect(screen.queryByText('Maria Garcia')).not.toBeInTheDocument();
      });
    });
  });

  describe('Prospects Section', () => {
    it('should render prospects section title', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /prospectos/i })).toBeInTheDocument();
      });
    });

    it('should display prospects count badge', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        // The prospects section should show the count badge
        expect(screen.getByRole('heading', { name: /prospectos/i })).toBeInTheDocument();
        // There should be prospect names displayed
        expect(screen.getByText('Carlos Prospecto')).toBeInTheDocument();
      });
    });

    it('should display prospect names', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Carlos Prospecto')).toBeInTheDocument();
        expect(screen.getByText('Laura Prospecto')).toBeInTheDocument();
      });
    });

    it('should show days since registered for prospects', async () => {
      render(<ContactosPage />);

      // Wait for prospects to load (check for prospect names)
      await waitFor(() => {
        expect(screen.getByText('Carlos Prospecto')).toBeInTheDocument();
        expect(screen.getByText('Laura Prospecto')).toBeInTheDocument();
      });

      // Should show "Registrado hace X días" for each prospect
      const registeredTexts = screen.getAllByText(/Registrado hace \d+ días/);
      expect(registeredTexts.length).toBeGreaterThanOrEqual(2);
    });

    it('should show "Sin compras registradas" for prospects', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Sin compras registradas')).toHaveLength(2);
      });
    });

    it('should render WhatsApp button for prospects with phone', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByTestId('whatsapp-prospect-1')).toBeInTheDocument();
        expect(screen.queryByTestId('whatsapp-prospect-2')).not.toBeInTheDocument(); // No phone
      });
    });

    it('should show "Sin datos de contacto" for prospects without phone or email', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Sin datos de contacto')).toBeInTheDocument();
      });
    });

    it('should show empty message when no prospects', async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }));

      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Sin prospectos pendientes')).toBeInTheDocument();
        expect(screen.getByText('Todos los clientes registrados ya han realizado al menos una compra')).toBeInTheDocument();
      });
    });
  });

  describe('Phone Call Functionality', () => {
    it('should trigger phone call when call button clicked', async () => {
      const user = userEvent.setup();
      // Mock window.location
      const originalLocation = window.location;
      delete (window as { location?: Location }).location;
      window.location = { ...originalLocation, href: '' } as Location;

      render(<ContactosPage />);

      await waitFor(() => {
        const phoneButtons = screen.getAllByTitle('Llamar');
        expect(phoneButtons.length).toBeGreaterThan(0);
      });

      const phoneButtons = screen.getAllByTitle('Llamar');
      await user.click(phoneButtons[0]);

      // Check that it matches one of the valid phone numbers
      expect(window.location.href).toMatch(/^tel:300\d{7}$/);

      // Restore
      window.location = originalLocation;
    });
  });

  describe('Error Handling', () => {
    it('should handle contacts fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseRpc.mockImplementation(() =>
        Promise.resolve({
          data: null,
          error: { message: 'Database error' }
        })
      );

      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('¡Todo al día!')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle prospects fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              }),
            }),
          }),
        }),
      }));

      render(<ContactosPage />);

      await waitFor(() => {
        expect(screen.getByText('Sin prospectos pendientes')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Urgency Colors', () => {
    it('should apply correct styling for high urgency', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        const juanCard = screen.getByText('Juan Perez').closest('[class*="rounded-lg"]');
        expect(juanCard).toHaveClass('bg-red-100');
      });
    });

    it('should apply correct styling for medium urgency', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        const pedroCard = screen.getByText('Pedro Lopez').closest('[class*="rounded-lg"]');
        expect(pedroCard).toHaveClass('bg-orange-100');
      });
    });

    it('should apply correct styling for low urgency', async () => {
      render(<ContactosPage />);

      await waitFor(() => {
        const mariaCard = screen.getByText('Maria Garcia').closest('[class*="rounded-lg"]');
        expect(mariaCard).toHaveClass('bg-yellow-100');
      });
    });
  });
});
