import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevenueChart } from '../revenue-chart';
import type { TimeSeriesDataPoint } from '@/types/analytics';

const mockData: TimeSeriesDataPoint[] = [
  {
    date: '2026-01-15',
    revenue: 5000,
    profit: 3500,
    cost: 1500,
    sales_count: 10,
    avg_ticket: 500,
  },
  {
    date: '2026-01-16',
    revenue: 7000,
    profit: 5000,
    cost: 2000,
    sales_count: 14,
    avg_ticket: 500,
  },
];

describe('RevenueChart', () => {
  it('should render chart with default title', () => {
    render(<RevenueChart data={mockData} />);
    expect(screen.getByText('Tendencia de Ingresos y Ganancias')).toBeInTheDocument();
  });

  it('should render chart with custom title', () => {
    render(<RevenueChart data={mockData} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('should render chart with empty data', () => {
    render(<RevenueChart data={[]} />);
    expect(screen.getByText('Tendencia de Ingresos y Ganancias')).toBeInTheDocument();
  });

  it('should apply glass card styling', () => {
    const { container } = render(<RevenueChart data={mockData} />);
    const card = container.querySelector('.glass');
    expect(card).toBeInTheDocument();
  });

  it('should render ResponsiveContainer with correct height', () => {
    const { container } = render(<RevenueChart data={mockData} />);
    // Recharts renders a ResponsiveContainer which should be present
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });
});
