import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeSelector } from '../date-range-selector';

describe('DateRangeSelector', () => {
  const mockOnRangeChange = vi.fn();

  beforeEach(() => {
    mockOnRangeChange.mockClear();
  });

  it('should render all preset buttons', () => {
    render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    expect(screen.getByRole('button', { name: /hoy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /esta semana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este mes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este trimestre/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este año/i })).toBeInTheDocument();
  });

  it('should call onRangeChange when preset is clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    const todayButton = screen.getByRole('button', { name: /hoy/i });
    await user.click(todayButton);

    expect(mockOnRangeChange).toHaveBeenCalledTimes(1);
    expect(mockOnRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        start: expect.any(Date),
        end: expect.any(Date),
      })
    );
  });

  it('should highlight active preset', () => {
    const { container } = render(
      <DateRangeSelector onRangeChange={mockOnRangeChange} activePreset="esta-semana" />
    );

    const weekButton = screen.getByRole('button', { name: /esta semana/i });

    // The active button should have different styling (variant="default")
    expect(weekButton.className).toContain('bg-primary');
  });

  it('should calculate correct date range for "Hoy"', async () => {
    const user = userEvent.setup();
    render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    const todayButton = screen.getByRole('button', { name: /hoy/i });
    await user.click(todayButton);

    const call = mockOnRangeChange.mock.calls[0][0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    expect(call.start.getDate()).toBe(today.getDate());
    expect(call.start.getMonth()).toBe(today.getMonth());
    expect(call.start.getFullYear()).toBe(today.getFullYear());
  });

  it('should calculate correct date range for "Este Mes"', async () => {
    const user = userEvent.setup();
    render(<DateRangeSelector onRangeChange={mockOnRangeChange} />);

    const monthButton = screen.getByRole('button', { name: /este mes/i });
    await user.click(monthButton);

    const call = mockOnRangeChange.mock.calls[0][0];

    // Start should be first day of month
    expect(call.start.getDate()).toBe(1);

    // End should be last day of month
    const lastDay = new Date(call.start.getFullYear(), call.start.getMonth() + 1, 0);
    expect(call.end.getDate()).toBe(lastDay.getDate());
  });
});
