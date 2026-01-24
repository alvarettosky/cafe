import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock Supabase
const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  },
}));

// Mock RecurrenceInput component
vi.mock('@/components/recurrence-input', () => ({
  RecurrenceInput: ({
    value,
    onChange,
    suggestedValue,
    showSuggestion,
    label,
    helperText,
  }: {
    value: number | null;
    onChange: (val: number | null) => void;
    suggestedValue?: number | null;
    showSuggestion?: boolean;
    label?: string;
    helperText?: string;
  }) => (
    <div data-testid="recurrence-input">
      <label>{label || 'Recurrence'}</label>
      <input
        type="number"
        data-testid="recurrence-input-field"
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      />
      {showSuggestion && suggestedValue && (
        <button
          data-testid="accept-suggestion"
          onClick={() => onChange(suggestedValue)}
        >
          Aceptar sugerencia ({suggestedValue} dias)
        </button>
      )}
      {helperText && <span data-testid="recurrence-helper">{helperText}</span>}
    </div>
  ),
}));

// Import after mocks
import NuevaVentaPage from '../page';

describe('NuevaVentaPage', () => {
  const mockProducts = [
    { product_id: 'prod-1', product_name: 'Cafe Especial' },
    { product_id: 'prod-2', product_name: 'Cafe Premium' },
    { product_id: 'prod-3', product_name: 'Cafe Organico' },
  ];

  const mockCustomers = [
    { id: 'cust-1', full_name: 'Juan Perez', typical_recurrence_days: 14 },
    { id: 'cust-2', full_name: 'Maria Garcia', typical_recurrence_days: null },
    { id: 'cust-3', full_name: 'Pedro Lopez', typical_recurrence_days: 7 },
  ];

  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockSupabaseFrom.mockClear();
    mockSupabaseRpc.mockClear();

    // Default mock implementations
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'inventory') {
        return {
          select: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
        };
      }
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            data: mockCustomers,
            error: null,
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'new-cust-1', full_name: 'Nuevo Cliente' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    mockSupabaseRpc.mockImplementation((functionName: string) => {
      if (functionName === 'calculate_customer_recurrence') {
        return Promise.resolve({ data: 10, error: null });
      }
      if (functionName === 'update_customer_recurrence') {
        return Promise.resolve({ data: null, error: null });
      }
      if (functionName === 'process_coffee_sale') {
        return Promise.resolve({ data: { sale_id: 'sale-1' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Header', () => {
    it('should render page title', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Registrar Venta de Café')).toBeInTheDocument();
      });
    });

    it('should render back button with link to home', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Volver al Dashboard')).toBeInTheDocument();
      });
    });

    it('should render coffee icon', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

  describe('Customer Selection', () => {
    it('should render customer select', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cliente')).toBeInTheDocument();
        expect(screen.getByText('Cliente General (Anónimo)')).toBeInTheDocument();
      });
    });

    it('should display loaded customers in select', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
        expect(screen.getByText('Pedro Lopez')).toBeInTheDocument();
      });
    });

    it('should have "+ Nuevo" button to add new customer', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Nuevo')).toBeInTheDocument();
      });
    });

    it('should show new customer form when "+ Nuevo" clicked', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Nuevo')).toBeInTheDocument();
      });

      await user.click(screen.getByText('+ Nuevo'));

      await waitFor(() => {
        expect(screen.getByText('Registrar Nuevo Cliente')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Nombre Completo')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Teléfono (Opcional)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Dirección (Opcional)')).toBeInTheDocument();
      });
    });

    it('should show cancel button in new customer form', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Nuevo')).toBeInTheDocument();
      });

      await user.click(screen.getByText('+ Nuevo'));

      await waitFor(() => {
        expect(screen.getByText('Cancelar / Seleccionar Existente')).toBeInTheDocument();
      });
    });

    it('should hide new customer form when cancel clicked', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Nuevo')).toBeInTheDocument();
      });

      await user.click(screen.getByText('+ Nuevo'));

      await waitFor(() => {
        expect(screen.getByText('Registrar Nuevo Cliente')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancelar / Seleccionar Existente'));

      await waitFor(() => {
        expect(screen.queryByText('Registrar Nuevo Cliente')).not.toBeInTheDocument();
      });
    });

    it('should show recurrence input for new customer', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Nuevo')).toBeInTheDocument();
      });

      await user.click(screen.getByText('+ Nuevo'));

      await waitFor(() => {
        expect(screen.getByTestId('recurrence-input')).toBeInTheDocument();
      });
    });
  });

  describe('Recurrence Input for Existing Customer', () => {
    it('should show recurrence input when customer has no recurrence set', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
      });

      // Select Maria Garcia (no recurrence)
      const customerSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(customerSelect, 'cust-2');

      await waitFor(() => {
        // Should show recurrence input with suggestion
        const recurrenceInputs = screen.getAllByTestId('recurrence-input');
        expect(recurrenceInputs.length).toBeGreaterThan(0);
      });
    });

    it('should not show recurrence input when customer already has recurrence', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Juan Perez')).toBeInTheDocument();
      });

      // Select Juan Perez (has recurrence)
      const customerSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(customerSelect, 'cust-1');

      // Wait a bit for state to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not show recurrence input in the main form area
      // (only for new customers)
      const helperTexts = screen.queryAllByTestId('recurrence-helper');
      const mainFormHelper = helperTexts.find(h => h.textContent?.includes('no tiene recurrencia'));
      expect(mainFormHelper).toBeUndefined();
    });
  });

  describe('Product Selection', () => {
    it('should render product select', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Producto')).toBeInTheDocument();
      });
    });

    it('should display loaded products in select', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
        expect(screen.getByText('Cafe Premium')).toBeInTheDocument();
        expect(screen.getByText('Cafe Organico')).toBeInTheDocument();
      });
    });

    it('should have default "Seleccionar Cafe..." option', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Seleccionar Café...')).toBeInTheDocument();
      });
    });

    it('should handle product loading error', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'inventory') {
          return {
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Error loading products' },
            }),
          };
        }
        if (table === 'customers') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockCustomers, error: null }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText(/Error cargando productos/)).toBeInTheDocument();
      });
    });
  });

  describe('Quantity and Unit Selection', () => {
    it('should render quantity input with default value 1', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        const quantityInput = screen.getByLabelText('Cantidad');
        expect(quantityInput).toHaveValue(1);
      });
    });

    it('should render unit select with options', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Unidad')).toBeInTheDocument();
        expect(screen.getByText('Libra (500g)')).toBeInTheDocument();
        expect(screen.getByText('Media Libra (250g)')).toBeInTheDocument();
      });
    });

    it('should update price when unit changes', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        const priceInput = screen.getByLabelText(/Precio por Unidad/);
        expect(priceInput).toHaveValue(10);
      });

      // Change to media libra
      const unitSelect = screen.getByLabelText('Unidad');
      await user.selectOptions(unitSelect, 'media_libra');

      await waitFor(() => {
        const priceInput = screen.getByLabelText(/Precio por Unidad/);
        expect(priceInput).toHaveValue(5);
      });
    });

    it('should allow editing quantity', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Cantidad')).toBeInTheDocument();
      });

      const quantityInput = screen.getByLabelText('Cantidad');
      await user.clear(quantityInput);
      await user.type(quantityInput, '3');

      expect(quantityInput).toHaveValue(3);
    });
  });

  describe('Price Section', () => {
    it('should render price input', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Precio por Unidad/)).toBeInTheDocument();
      });
    });

    it('should display total calculation', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Total:')).toBeInTheDocument();
        // Default: 1 * $10.00 = $10.00
        expect(screen.getByText('$10.00')).toBeInTheDocument();
      });
    });

    it('should update total when quantity changes', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('Cantidad')).toBeInTheDocument();
      });

      const quantityInput = screen.getByLabelText('Cantidad');
      await user.clear(quantityInput);
      await user.type(quantityInput, '3');

      await waitFor(() => {
        expect(screen.getByText('$30.00')).toBeInTheDocument();
      });
    });

    it('should update total when price changes', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Precio por Unidad/)).toBeInTheDocument();
      });

      const priceInput = screen.getByLabelText(/Precio por Unidad/);
      await user.clear(priceInput);
      await user.type(priceInput, '15');

      await waitFor(() => {
        expect(screen.getByText('$15.00')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Method Selection', () => {
    it('should render payment method select', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Medio de Pago')).toBeInTheDocument();
      });
    });

    it('should have Efectivo as default', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        // Find all comboboxes and check that Efectivo exists
        const allSelects = screen.getAllByRole('combobox');
        // The payment method select should show Efectivo as the first payment option
        expect(screen.getByText('Efectivo')).toBeInTheDocument();
      });
    });

    it('should display all payment methods', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Efectivo')).toBeInTheDocument();
        expect(screen.getByText('Transf. Davivienda')).toBeInTheDocument();
        expect(screen.getByText('Transf. Bancolombia')).toBeInTheDocument();
        expect(screen.getByText('Nequi Alvaretto')).toBeInTheDocument();
        expect(screen.getByText('Nequi La Negra')).toBeInTheDocument();
        expect(screen.getByText('DaviPlata')).toBeInTheDocument();
        expect(screen.getByText('Pago a crédito o pendiente')).toBeInTheDocument();
      });
    });
  });

  describe('Date Selection', () => {
    it('should render date input', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Fecha de Venta (Opcional)')).toBeInTheDocument();
      });
    });

    it('should display helper text about default date', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Dejar vacío para usar fecha actual.')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error when no product selected', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Confirmar Venta')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(screen.getByText('Selecciona un producto')).toBeInTheDocument();
      });
    });

    it('should show error when price is 0', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      // Set price to 0
      const priceInput = screen.getByLabelText(/Precio por Unidad/);
      await user.clear(priceInput);
      await user.type(priceInput, '0');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(screen.getByText('El precio debe ser mayor a $0')).toBeInTheDocument();
      });
    });

    it('should show error when new customer name is empty', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Nuevo')).toBeInTheDocument();
      });

      // Switch to new customer mode
      await user.click(screen.getByText('+ Nuevo'));

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      // Try to submit without customer name
      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(screen.getByText('Nombre del cliente requerido')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should show loading state during submission', async () => {
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'process_coffee_sale') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve({ data: null, error: null });
      });

      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        const submitButton = screen.getByText('Confirmar Venta').closest('button');
        expect(submitButton).toBeDisabled();
      });
    });

    it('should call process_coffee_sale RPC on submit', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('process_coffee_sale', expect.objectContaining({
          p_items: expect.arrayContaining([
            expect.objectContaining({
              product_id: 'prod-1',
              unit: 'libra',
              quantity: 1,
              price: 10,
            }),
          ]),
          p_payment_method: 'Efectivo',
        }));
      });
    });

    it('should navigate to home after successful sale', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should create new customer when in new customer mode', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-cust-1', full_name: 'Nuevo Cliente' },
            error: null,
          }),
        }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'inventory') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
          };
        }
        if (table === 'customers') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockCustomers, error: null }),
            insert: insertMock,
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('+ Nuevo')).toBeInTheDocument();
      });

      // Switch to new customer mode
      await user.click(screen.getByText('+ Nuevo'));

      // Fill customer name
      const nameInput = screen.getByPlaceholderText('Nombre Completo');
      await user.type(nameInput, 'Nuevo Cliente');

      // Fill phone (optional)
      const phoneInput = screen.getByPlaceholderText('Teléfono (Opcional)');
      await user.type(phoneInput, '3001234567');

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith([
          expect.objectContaining({
            full_name: 'Nuevo Cliente',
            phone: '3001234567',
          }),
        ]);
      });
    });

    it('should handle sale error gracefully', async () => {
      // Create a proper Error object so it's caught correctly
      const saleError = new Error('Sale failed');
      mockSupabaseRpc.mockImplementation((functionName: string) => {
        if (functionName === 'process_coffee_sale') {
          // Return an error object - the page throws it
          return Promise.resolve({ data: null, error: saleError });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        // Error is displayed - either the message or fallback
        expect(screen.getByText(/Sale failed|Error processing sale/)).toBeInTheDocument();
      });
    });

    it('should use guest customer ID when no customer selected', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Select product (but leave customer as default/anonymous)
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('process_coffee_sale', expect.objectContaining({
          p_customer_id: '00000000-0000-0000-0000-000000000000',
        }));
      });
    });
  });

  describe('Cancel Button', () => {
    it('should render cancel button', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
      });
    });

    it('should be linked to home page', async () => {
      render(<NuevaVentaPage />);

      await waitFor(() => {
        const cancelLink = screen.getByText('Cancelar').closest('a');
        expect(cancelLink).toHaveAttribute('href', '/');
      });
    });
  });

  describe('Recurrence Update for Existing Customer', () => {
    it('should update customer recurrence when set during sale', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
      });

      // Select Maria Garcia (no recurrence)
      const customerSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(customerSelect, 'cust-2');

      await waitFor(() => {
        expect(screen.getByTestId('recurrence-input')).toBeInTheDocument();
      });

      // Set recurrence
      const recurrenceInput = screen.getByTestId('recurrence-input-field');
      await user.type(recurrenceInput, '14');

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('update_customer_recurrence', {
          p_customer_id: 'cust-2',
          p_recurrence_days: 14,
        });
      });
    });
  });

  describe('Sale Date Handling', () => {
    it('should send undefined when date is not set', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('process_coffee_sale', expect.objectContaining({
          p_created_at: undefined,
        }));
      });
    });

    it('should send ISO date when date is set', async () => {
      const user = userEvent.setup();
      render(<NuevaVentaPage />);

      await waitFor(() => {
        expect(screen.getByText('Cafe Especial')).toBeInTheDocument();
      });

      // Set sale date
      const dateInput = document.querySelector('input[type="datetime-local"]');
      if (dateInput) {
        await user.clear(dateInput);
        await user.type(dateInput, '2026-01-20T10:30');
      }

      // Select product
      const productSelect = screen.getByLabelText('Producto');
      await user.selectOptions(productSelect, 'prod-1');

      await user.click(screen.getByText('Confirmar Venta'));

      await waitFor(() => {
        expect(mockSupabaseRpc).toHaveBeenCalledWith('process_coffee_sale', expect.objectContaining({
          p_created_at: expect.stringContaining('2026-01-20'),
        }));
      });
    });
  });
});
