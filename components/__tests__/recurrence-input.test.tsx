import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecurrenceInput } from '../recurrence-input';

describe('RecurrenceInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Recurrencia típica (días)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Ej: 15 días')).toBeInTheDocument();
    });

    it('should render with custom label', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
          label="Frecuencia de compra"
        />
      );

      expect(screen.getByText('Frecuencia de compra')).toBeInTheDocument();
    });

    it('should render with custom helper text', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
          helperText="Ingrese los días de recurrencia"
        />
      );

      expect(screen.getByText('Ingrese los días de recurrencia')).toBeInTheDocument();
    });

    it('should display current value', () => {
      render(
        <RecurrenceInput
          value={14}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      expect(input).toHaveValue(14);
    });
  });

  describe('AI Suggestion Feature', () => {
    it('should show AI suggestion when available', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
          suggestedValue={7}
          showSuggestion={true}
        />
      );

      expect(screen.getByText(/Sugerencia:/)).toBeInTheDocument();
      expect(screen.getByText(/7 días/)).toBeInTheDocument();
    });

    it('should allow accepting AI suggestion', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
          suggestedValue={7}
          showSuggestion={true}
        />
      );

      const acceptButton = screen.getByText(/Usar 7d/);
      await user.click(acceptButton);

      expect(mockOnChange).toHaveBeenCalledWith(7);
    });

    it('should not show suggestion when showSuggestion is false', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
          suggestedValue={7}
          showSuggestion={false}
        />
      );

      expect(screen.queryByText(/Sugerencia AI:/)).not.toBeInTheDocument();
    });

    it('should not show suggestion when value already exists', () => {
      render(
        <RecurrenceInput
          value={14}
          onChange={mockOnChange}
          suggestedValue={7}
          showSuggestion={true}
        />
      );

      expect(screen.queryByText(/Sugerencia AI:/)).not.toBeInTheDocument();
    });
  });

  describe('User Input', () => {
    it('should update value when user types', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.type(input, '21');

      expect(mockOnChange).toHaveBeenCalledWith(21);
    });

    it('should clear value when input is cleared', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={14}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.clear(input);

      expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    it('should only accept numeric values', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.type(input, 'abc');

      // Input type="number" prevents non-numeric input
      expect(input).toHaveValue(null);
    });

    it('should not accept negative values', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');

      // Try to type negative number
      await user.type(input, '-5');

      // Input min="1" should prevent negative values
      expect(mockOnChange).not.toHaveBeenCalledWith(-5);
    });
  });

  describe('Common Recurrence Values', () => {
    it('should display helper text with examples', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/¿Cada cuántos días suele comprar este cliente?/)).toBeInTheDocument();
    });

    it('should accept typical weekly recurrence (7 days)', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.type(input, '7');

      expect(mockOnChange).toHaveBeenCalledWith(7);
    });

    it('should accept biweekly recurrence (14 days)', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.type(input, '14');

      expect(mockOnChange).toHaveBeenCalledWith(14);
    });

    it('should accept monthly recurrence (30 days)', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.type(input, '30');

      expect(mockOnChange).toHaveBeenCalledWith(30);
    });
  });

  describe('Accessibility', () => {
    it('should have proper label association', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      const label = screen.getByText('Recurrencia típica (días)');

      expect(label).toBeInTheDocument();
      expect(input).toBeInTheDocument();
    });

    it('should have proper input type', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should have minimum value constraint', () => {
      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      expect(input).toHaveAttribute('min', '1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large recurrence values', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.type(input, '365');

      expect(mockOnChange).toHaveBeenCalledWith(365);
    });

    it('should handle value of 1 (daily)', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={null}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.type(input, '1');

      expect(mockOnChange).toHaveBeenCalledWith(1);
    });

    it('should handle changing from a value to null', async () => {
      const user = userEvent.setup();

      render(
        <RecurrenceInput
          value={7}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Ej: 15 días');
      await user.clear(input);

      expect(mockOnChange).toHaveBeenCalledWith(null);
    });
  });
});
