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
      const quantityInput = screen.getByLabelText(/cantidad/i);
      expect(quantityInput).toBeInTheDocument();
    });
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
});
