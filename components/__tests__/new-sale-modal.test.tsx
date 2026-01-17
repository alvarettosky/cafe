import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewSaleModal } from '../new-sale-modal';

describe('NewSaleModal', () => {
  const mockOnSaleComplete = vi.fn();

  beforeEach(() => {
    mockOnSaleComplete.mockClear();
  });

  it('should render trigger button', () => {
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);
    expect(screen.getByRole('button', { name: /nueva venta/i })).toBeInTheDocument();
  });

  it('should open modal when trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar venta de café/i })).toBeInTheDocument();
    });
  });

  it('should load products when modal opens', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/seleccionar café/i)).toBeInTheDocument();
    });
  });

  it('should show error when submitting without product selection', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar venta/i })).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /confirmar venta/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/selecciona un producto/i)).toBeInTheDocument();
    });
  });

  it('should allow quantity input', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar venta de café/i })).toBeInTheDocument();
    });

    const quantityInput = screen.getByLabelText(/cantidad/i);
    expect(quantityInput).toBeInTheDocument();
    expect(quantityInput).toHaveValue(1);
  });

  it('should have all payment methods available', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/efectivo/i)).toBeInTheDocument();
      expect(screen.getByText(/pago a crédito o pendiente/i)).toBeInTheDocument();
    });
  });

  it('should display price input with default value', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar venta de café/i })).toBeInTheDocument();
    });

    const priceInput = screen.getByLabelText(/precio por unidad/i);
    expect(priceInput).toBeInTheDocument();
    expect(priceInput).toHaveValue(10);
  });

  it('should update suggested price when unit changes', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar venta de café/i })).toBeInTheDocument();
    });

    const priceInput = screen.getByLabelText(/precio por unidad \(\$\)/i);
    expect(priceInput).toHaveValue(10);

    const unitSelect = screen.getByLabelText(/^unidad$/i);
    await user.selectOptions(unitSelect, 'media_libra');

    await waitFor(() => {
      expect(priceInput).toHaveValue(5);
    });
  });

  it('should calculate and display total price', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar venta de café/i })).toBeInTheDocument();
    });

    const quantityInput = screen.getByLabelText(/cantidad/i);
    await user.clear(quantityInput);
    await user.type(quantityInput, '3');

    await waitFor(() => {
      expect(screen.getByText(/\$30\.00/)).toBeInTheDocument();
    });
  });

  it('should allow manual price editing', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /registrar venta de café/i })).toBeInTheDocument();
    });

    const priceInput = screen.getByLabelText(/precio por unidad/i);
    await user.clear(priceInput);
    await user.type(priceInput, '15.50');

    await waitFor(() => {
      expect(priceInput).toHaveValue(15.5);
      expect(screen.getByText(/\$15\.50/)).toBeInTheDocument();
    });
  });

  it('should show error when price is zero or negative', async () => {
    const user = userEvent.setup();
    render(<NewSaleModal onSaleComplete={mockOnSaleComplete} />);

    const trigger = screen.getByRole('button', { name: /nueva venta/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar venta/i })).toBeInTheDocument();
    });

    // Select a product first (required field)
    await waitFor(() => {
      expect(screen.getByText(/seleccionar café/i)).toBeInTheDocument();
    });

    const productSelect = screen.getByLabelText(/producto/i);
    await user.selectOptions(productSelect, '1');

    // Set price to 0
    const priceInput = screen.getByLabelText(/precio por unidad \(\$\)/i);
    await user.clear(priceInput);
    await user.type(priceInput, '0');

    const submitButton = screen.getByRole('button', { name: /confirmar venta/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/el precio debe ser mayor a \$0/i)).toBeInTheDocument();
    });
  });
});
