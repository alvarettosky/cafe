import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeSelector } from '../date-range-selector';

describe('DateRangeSelector', () => {
  const mockOnPresetChange = vi.fn();

  beforeEach(() => {
    mockOnPresetChange.mockClear();
  });

  it('should render all preset buttons', () => {
    render(<DateRangeSelector onPresetChange={mockOnPresetChange} />);

    expect(screen.getByRole('button', { name: /hoy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /esta semana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este mes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este trimestre/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /este año/i })).toBeInTheDocument();
  });

  it('should call onPresetChange when preset is clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangeSelector onPresetChange={mockOnPresetChange} />);

    const todayButton = screen.getByRole('button', { name: /hoy/i });
    await user.click(todayButton);

    expect(mockOnPresetChange).toHaveBeenCalledTimes(1);
    expect(mockOnPresetChange).toHaveBeenCalledWith('hoy');
  });

  it('should highlight active preset', () => {
    render(
      <DateRangeSelector onPresetChange={mockOnPresetChange} activePreset="esta-semana" />
    );

    const weekButton = screen.getByRole('button', { name: /esta semana/i });

    // The active button should have different styling (variant="default")
    expect(weekButton.className).toContain('bg-primary');
  });

  it('should default to "este-mes" when no activePreset provided', () => {
    render(<DateRangeSelector onPresetChange={mockOnPresetChange} />);

    const monthButton = screen.getByRole('button', { name: /este mes/i });
    expect(monthButton.className).toContain('bg-primary');
  });

  it('should call onPresetChange with different preset values', async () => {
    const user = userEvent.setup();
    render(<DateRangeSelector onPresetChange={mockOnPresetChange} />);

    await user.click(screen.getByRole('button', { name: /hoy/i }));
    expect(mockOnPresetChange).toHaveBeenCalledWith('hoy');

    await user.click(screen.getByRole('button', { name: /esta semana/i }));
    expect(mockOnPresetChange).toHaveBeenCalledWith('esta-semana');

    await user.click(screen.getByRole('button', { name: /este mes/i }));
    expect(mockOnPresetChange).toHaveBeenCalledWith('este-mes');

    await user.click(screen.getByRole('button', { name: /este trimestre/i }));
    expect(mockOnPresetChange).toHaveBeenCalledWith('este-trimestre');

    await user.click(screen.getByRole('button', { name: /este año/i }));
    expect(mockOnPresetChange).toHaveBeenCalledWith('este-año');
  });

  it('should render Calendar icons on each button', () => {
    render(<DateRangeSelector onPresetChange={mockOnPresetChange} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('should maintain active state across rerenders', () => {
    const { rerender } = render(
      <DateRangeSelector onPresetChange={mockOnPresetChange} activePreset="hoy" />
    );

    expect(screen.getByRole('button', { name: /hoy/i }).className).toContain('bg-primary');

    rerender(
      <DateRangeSelector onPresetChange={mockOnPresetChange} activePreset="este-año" />
    );

    expect(screen.getByRole('button', { name: /hoy/i }).className).not.toContain('bg-primary');
    expect(screen.getByRole('button', { name: /este año/i }).className).toContain('bg-primary');
  });
});
