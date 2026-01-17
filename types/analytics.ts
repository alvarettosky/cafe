// Advanced analytics types
export interface AdvancedMetrics {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  avg_profit_margin: number;
  sales_count: number;
  avg_ticket: number;
  payment_breakdown: PaymentBreakdown;
  pending_credits: number;
  top_products: ProductMetric[];
  inventory_value: number;
  low_stock_items: number;
}

export interface PaymentBreakdown {
  [method: string]: {
    count: number;
    total: number;
    profit: number;
  };
}

export interface ProductMetric {
  product_name: string;
  units_sold: number;
  revenue: number;
  profit: number;
  profit_margin?: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  revenue: number;
  profit: number;
  cost: number;
  sales_count: number;
  avg_ticket: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PeriodComparison {
  current: AdvancedMetrics;
  previous: AdvancedMetrics;
  change_percent: {
    revenue: number;
    profit: number;
    sales: number;
  };
}
