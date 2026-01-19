import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductChart } from '../product-chart';
import type { ProductMetric } from '@/types/analytics';

const mockProducts: ProductMetric[] = [
  {
    product_name: 'Café Premium',
    units_sold: 50,
    revenue: 10000,
    profit: 7000,
    profit_margin: 70,
  },
  {
    product_name: 'Café Orgánico',
    units_sold: 30,
    revenue: 6000,
    profit: 4000,
    profit_margin: 66.67,
  },
];

describe('ProductChart', () => {
  it('should render chart with default title', () => {
    render(<ProductChart data={mockProducts} />);
    expect(screen.getByText('Rendimiento de Productos')).toBeInTheDocument();
  });

  it('should render chart with custom title', () => {
    render(<ProductChart data={mockProducts} title="Top Products" />);
    expect(screen.getByText('Top Products')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<ProductChart data={[]} />);
    expect(screen.getByText('Rendimiento de Productos')).toBeInTheDocument();
  });

  it('should render bar chart container', () => {
    const { container } = render(<ProductChart data={mockProducts} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('should apply glass card styling', () => {
    const { container } = render(<ProductChart data={mockProducts} />);
    const card = container.querySelector('.glass');
    expect(card).toBeInTheDocument();
  });
});
