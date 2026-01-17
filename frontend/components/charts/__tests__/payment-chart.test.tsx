import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentChart } from '../payment-chart';
import type { PaymentBreakdown } from '@/types/analytics';

const mockPayments: PaymentBreakdown = {
  'Efectivo': { count: 10, total: 6000, profit: 4000 },
  'Transf. Davivienda': { count: 15, total: 9000, profit: 6000 },
  'Nequi Alvaretto': { count: 5, total: 3000, profit: 2000 },
};

describe('PaymentChart', () => {
  it('should render chart with default title', () => {
    render(<PaymentChart data={mockPayments} />);
    expect(screen.getByText('Payment Methods')).toBeInTheDocument();
  });

  it('should render chart with custom title', () => {
    render(<PaymentChart data={mockPayments} title="Payment Distribution" />);
    expect(screen.getByText('Payment Distribution')).toBeInTheDocument();
  });

  it('should handle empty data object', () => {
    render(<PaymentChart data={{}} />);
    expect(screen.getByText('Payment Methods')).toBeInTheDocument();
  });

  it('should render pie chart container', () => {
    const { container } = render(<PaymentChart data={mockPayments} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('should apply glass card styling', () => {
    const { container } = render(<PaymentChart data={mockPayments} />);
    const card = container.querySelector('.glass');
    expect(card).toBeInTheDocument();
  });
});
