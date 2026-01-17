# Advanced Metrics Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform basic CRM into comprehensive analytics platform with profit tracking, advanced metrics, charts, and multi-period reporting.

**Architecture:** Extend database schema with cost tracking, create specialized RPC functions for complex queries, implement charting with Recharts, build modular metric components, add dedicated analytics pages.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + RPC), Recharts, TailwindCSS, TypeScript, Framer Motion

---

## Phase 1: Database Schema Enhancement

### Task 1: Add Cost Tracking to Inventory

**Files:**
- Create: `supabase/migrations/015_add_cost_tracking.sql`

**Step 1: Write migration for cost columns**

```sql
-- Add cost tracking to inventory table
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS cost_per_gram NUMERIC(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 2500,
ADD COLUMN IF NOT EXISTS last_restock_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_cost ON inventory(cost_per_gram);
CREATE INDEX IF NOT EXISTS idx_inventory_reorder ON inventory(reorder_point);

-- Update existing products with estimated costs (can be adjusted later)
-- Assuming avg cost of $0.02 per gram ($10/lb)
UPDATE inventory
SET cost_per_gram = 0.02
WHERE cost_per_gram = 0;

COMMENT ON COLUMN inventory.cost_per_gram IS 'Cost per gram in USD';
COMMENT ON COLUMN inventory.reorder_point IS 'Minimum stock level in grams before reorder alert';
```

**Step 2: Execute migration in Supabase**

1. Open: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/sql/new
2. Paste SQL above
3. Click RUN
4. Verify: `SELECT * FROM inventory LIMIT 1;` shows new columns

**Step 3: Commit migration**

```bash
git add supabase/migrations/015_add_cost_tracking.sql
git commit -m "feat(db): add cost tracking columns to inventory"
```

---

### Task 2: Add Profit Calculation to Sale Items

**Files:**
- Create: `supabase/migrations/016_add_profit_to_sales.sql`

**Step 1: Write migration for profit columns**

```sql
-- Add profit tracking to sale_items
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit NUMERIC(10, 2) DEFAULT 0;

-- Add profit column to sales (aggregated)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_profit NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(5, 2) DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_profit ON sale_items(profit);
CREATE INDEX IF NOT EXISTS idx_sales_profit ON sales(total_profit);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);

-- Create function to calculate profit for a sale item
CREATE OR REPLACE FUNCTION calculate_sale_item_profit()
RETURNS TRIGGER AS $$
DECLARE
    v_cost_per_gram NUMERIC(10, 4);
    v_grams_sold INTEGER;
    v_total_cost NUMERIC(10, 2);
BEGIN
    -- Get cost per gram from inventory
    SELECT cost_per_gram INTO v_cost_per_gram
    FROM inventory
    WHERE product_id = NEW.product_id;

    -- Calculate grams sold
    v_grams_sold := CASE
        WHEN NEW.unit = 'libra' THEN 500 * NEW.quantity
        WHEN NEW.unit = 'media_libra' THEN 250 * NEW.quantity
        ELSE 0
    END;

    -- Calculate total cost
    v_total_cost := v_grams_sold * COALESCE(v_cost_per_gram, 0);

    -- Update cost and profit
    NEW.cost_per_unit := v_total_cost / NEW.quantity;
    NEW.profit := NEW.total_price - v_total_cost;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_calculate_profit ON sale_items;
CREATE TRIGGER trigger_calculate_profit
    BEFORE INSERT OR UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_sale_item_profit();

COMMENT ON FUNCTION calculate_sale_item_profit() IS 'Auto-calculates profit when sale item is created/updated';
```

**Step 2: Execute migration**

Same process as Task 1.

**Step 3: Commit**

```bash
git add supabase/migrations/016_add_profit_to_sales.sql
git commit -m "feat(db): add profit calculation to sale items with trigger"
```

---

### Task 3: Update process_coffee_sale RPC

**Files:**
- Create: `supabase/migrations/017_update_rpc_with_profit.sql`

**Step 1: Write updated RPC with profit calculation**

```sql
-- Update process_coffee_sale to calculate and store profits
CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'Efectivo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_total_amount NUMERIC(10, 2) := 0;
    v_total_cost NUMERIC(10, 2) := 0;
    v_total_profit NUMERIC(10, 2) := 0;
    v_grams_to_deduct INTEGER;
    v_cost_per_gram NUMERIC(10, 4);
    v_item_cost NUMERIC(10, 2);
    v_item_profit NUMERIC(10, 2);
BEGIN
    -- Create sale record
    INSERT INTO sales (customer_id, created_at, payment_method)
    VALUES (
        p_customer_id,
        COALESCE(p_created_at, NOW()),
        p_payment_method
    )
    RETURNING id INTO v_sale_id;

    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Calculate grams to deduct
        v_grams_to_deduct := CASE
            WHEN v_item->>'unit' = 'libra' THEN 500 * (v_item->>'quantity')::INTEGER
            WHEN v_item->>'unit' = 'media_libra' THEN 250 * (v_item->>'quantity')::INTEGER
            ELSE 0
        END;

        -- Get cost per gram for profit calculation
        SELECT cost_per_gram INTO v_cost_per_gram
        FROM inventory
        WHERE product_id = (v_item->>'product_id')::UUID;

        -- Calculate item cost and profit
        v_item_cost := v_grams_to_deduct * COALESCE(v_cost_per_gram, 0);
        v_item_profit := (v_item->>'price')::NUMERIC - v_item_cost;

        -- Insert sale item (trigger will calculate profit)
        INSERT INTO sale_items (
            sale_id,
            product_id,
            unit,
            quantity,
            price_per_unit,
            total_price
        ) VALUES (
            v_sale_id,
            (v_item->>'product_id')::UUID,
            v_item->>'unit',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC / (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC
        );

        -- Update inventory
        UPDATE inventory
        SET total_grams_available = total_grams_available - v_grams_to_deduct,
            last_updated = NOW()
        WHERE product_id = (v_item->>'product_id')::UUID;

        -- Accumulate totals
        v_total_amount := v_total_amount + (v_item->>'price')::NUMERIC;
        v_total_cost := v_total_cost + v_item_cost;
        v_total_profit := v_total_profit + v_item_profit;
    END LOOP;

    -- Update sale totals with profit info
    UPDATE sales
    SET total_amount = v_total_amount,
        total_cost = v_total_cost,
        total_profit = v_total_profit,
        profit_margin = CASE
            WHEN v_total_amount > 0 THEN (v_total_profit / v_total_amount) * 100
            ELSE 0
        END
    WHERE id = v_sale_id;

    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'total_amount', v_total_amount,
        'total_profit', v_total_profit,
        'profit_margin', CASE
            WHEN v_total_amount > 0 THEN (v_total_profit / v_total_amount) * 100
            ELSE 0
        END
    );
END;
$$;
```

**Step 2: Execute migration**

**Step 3: Commit**

```bash
git add supabase/migrations/017_update_rpc_with_profit.sql
git commit -m "feat(db): update process_coffee_sale RPC to calculate profits"
```

---

## Phase 2: Advanced Analytics RPC Functions

### Task 4: Create Advanced Metrics RPC

**Files:**
- Create: `supabase/migrations/018_advanced_metrics_rpc.sql`

**Step 1: Write comprehensive metrics function**

```sql
-- Advanced dashboard metrics with profit analysis
CREATE OR REPLACE FUNCTION get_advanced_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Default to current day if no dates provided
    v_start_date := COALESCE(p_start_date, CURRENT_DATE);
    v_end_date := COALESCE(p_end_date, CURRENT_DATE + INTERVAL '1 day');

    SELECT jsonb_build_object(
        -- Revenue metrics
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'total_cost', COALESCE(SUM(total_cost), 0),
        'total_profit', COALESCE(SUM(total_profit), 0),
        'avg_profit_margin', COALESCE(AVG(profit_margin), 0),
        'sales_count', COUNT(*),
        'avg_ticket', COALESCE(AVG(total_amount), 0),

        -- Payment method breakdown
        'payment_breakdown', (
            SELECT jsonb_object_agg(
                COALESCE(payment_method, 'Unknown'),
                payment_data
            )
            FROM (
                SELECT
                    payment_method,
                    jsonb_build_object(
                        'count', COUNT(*),
                        'total', COALESCE(SUM(total_amount), 0),
                        'profit', COALESCE(SUM(total_profit), 0)
                    ) as payment_data
                FROM sales
                WHERE created_at >= v_start_date AND created_at < v_end_date
                GROUP BY payment_method
            ) pm
        ),

        -- Pending credits
        'pending_credits', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM sales
            WHERE payment_method = 'Pago a crédito o pendiente'
            AND created_at >= v_start_date AND created_at < v_end_date
        ),

        -- Top products
        'top_products', (
            SELECT jsonb_agg(product_data ORDER BY revenue DESC)
            FROM (
                SELECT
                    i.product_name,
                    COUNT(si.id) as units_sold,
                    SUM(si.total_price) as revenue,
                    SUM(si.profit) as profit
                FROM sale_items si
                JOIN inventory i ON si.product_id = i.product_id
                JOIN sales s ON si.sale_id = s.id
                WHERE s.created_at >= v_start_date AND s.created_at < v_end_date
                GROUP BY i.product_name
                ORDER BY revenue DESC
                LIMIT 10
            ) as product_data
        ),

        -- Inventory status
        'inventory_value', (
            SELECT COALESCE(SUM(total_grams_available * cost_per_gram), 0)
            FROM inventory
        ),
        'low_stock_items', (
            SELECT COUNT(*)
            FROM inventory
            WHERE total_grams_available < reorder_point
        )

    ) INTO v_result
    FROM sales
    WHERE created_at >= v_start_date AND created_at < v_end_date;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_advanced_metrics IS 'Comprehensive metrics including profit, payments, top products for specified date range';
```

**Step 2: Execute migration**

**Step 3: Commit**

```bash
git add supabase/migrations/018_advanced_metrics_rpc.sql
git commit -m "feat(db): add advanced metrics RPC with profit analysis"
```

---

### Task 5: Create Time Series Data RPC

**Files:**
- Create: `supabase/migrations/019_time_series_rpc.sql`

**Step 1: Write time series function for charts**

```sql
-- Get sales time series for charts (daily, weekly, monthly)
CREATE OR REPLACE FUNCTION get_sales_time_series(
    p_period TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    p_days_back INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_interval TEXT;
    v_format TEXT;
BEGIN
    v_start_date := CURRENT_DATE - (p_days_back || ' days')::INTERVAL;

    -- Set grouping based on period
    CASE p_period
        WHEN 'daily' THEN
            v_interval := '1 day';
            v_format := 'YYYY-MM-DD';
        WHEN 'weekly' THEN
            v_interval := '1 week';
            v_format := 'IYYY-IW';
        WHEN 'monthly' THEN
            v_interval := '1 month';
            v_format := 'YYYY-MM';
        ELSE
            v_interval := '1 day';
            v_format := 'YYYY-MM-DD';
    END CASE;

    RETURN (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', date_bucket,
                'revenue', COALESCE(SUM(total_amount), 0),
                'profit', COALESCE(SUM(total_profit), 0),
                'cost', COALESCE(SUM(total_cost), 0),
                'sales_count', COUNT(*),
                'avg_ticket', COALESCE(AVG(total_amount), 0)
            )
            ORDER BY date_bucket
        )
        FROM (
            SELECT
                TO_CHAR(created_at, v_format) as date_bucket,
                total_amount,
                total_profit,
                total_cost
            FROM sales
            WHERE created_at >= v_start_date
        ) grouped_data
        GROUP BY date_bucket
    );
END;
$$;

-- Get product performance over time
CREATE OR REPLACE FUNCTION get_product_performance(
    p_days_back INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(
            jsonb_build_object(
                'product_name', product_name,
                'units_sold', units_sold,
                'revenue', revenue,
                'profit', profit,
                'profit_margin', CASE
                    WHEN revenue > 0 THEN (profit / revenue) * 100
                    ELSE 0
                END
            )
            ORDER BY revenue DESC
        )
        FROM (
            SELECT
                i.product_name,
                SUM(si.quantity) as units_sold,
                SUM(si.total_price) as revenue,
                SUM(si.profit) as profit
            FROM sale_items si
            JOIN inventory i ON si.product_id = i.product_id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.created_at >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL
            GROUP BY i.product_name
        ) product_stats
    );
END;
$$;

COMMENT ON FUNCTION get_sales_time_series IS 'Returns time series data for revenue/profit charts';
COMMENT ON FUNCTION get_product_performance IS 'Returns product performance metrics over specified period';
```

**Step 2: Execute migration**

**Step 3: Commit**

```bash
git add supabase/migrations/019_time_series_rpc.sql
git commit -m "feat(db): add time series and product performance RPCs"
```

---

## Phase 3: Frontend - Install Dependencies

### Task 6: Add Charting Library

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install recharts**

```bash
cd frontend
npm install recharts
npm install @types/recharts --save-dev
```

**Step 2: Verify installation**

Check `package.json` includes:
```json
"recharts": "^2.x.x"
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add recharts for data visualization"
```

---

## Phase 4: TypeScript Types

### Task 7: Create Advanced Types

**Files:**
- Create: `frontend/types/analytics.ts`

**Step 1: Define comprehensive types**

```typescript
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
```

**Step 2: Update existing types file**

Modify: `frontend/types/index.ts`

```typescript
export * from './analytics';

// Update existing DashboardStats
export interface DashboardStats {
  total_inventory_grams: number;
  sales_today: number;
  low_stock_count: number;
  roasted_coffee_lbs: number;
}
```

**Step 3: Commit**

```bash
git add types/analytics.ts types/index.ts
git commit -m "feat(types): add comprehensive analytics type definitions"
```

---

## Phase 5: UI Components - Charts

### Task 8: Create Revenue Chart Component

**Files:**
- Create: `frontend/components/charts/revenue-chart.tsx`

**Step 1: Build responsive line chart**

```typescript
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSeriesDataPoint } from '@/types/analytics';

interface RevenueChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
}

export function RevenueChart({ data, title = "Revenue & Profit Trend" }: RevenueChartProps) {
  const formatCurrency = (value: number) => `$${value.toFixed(0)}`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#888"
            />
            <YAxis
              tickFormatter={formatCurrency}
              stroke="#888"
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={formatDate}
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #333',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#f97316"
              strokeWidth={2}
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#22c55e"
              strokeWidth={2}
              name="Profit"
            />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#ef4444"
              strokeWidth={2}
              name="Cost"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Test component renders**

Create test usage in dashboard to verify it works.

**Step 3: Commit**

```bash
git add components/charts/revenue-chart.tsx
git commit -m "feat(ui): add revenue/profit trend line chart"
```

---

### Task 9: Create Product Performance Chart

**Files:**
- Create: `frontend/components/charts/product-chart.tsx`

**Step 1: Build bar chart component**

```typescript
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductMetric } from '@/types/analytics';

interface ProductChartProps {
  data: ProductMetric[];
  title?: string;
}

export function ProductChart({ data, title = "Top Products" }: ProductChartProps) {
  const formatCurrency = (value: number) => `$${value.toFixed(0)}`;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="product_name"
              angle={-45}
              textAnchor="end"
              height={100}
              stroke="#888"
            />
            <YAxis
              tickFormatter={formatCurrency}
              stroke="#888"
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #333',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#f97316" name="Revenue" />
            <Bar dataKey="profit" fill="#22c55e" name="Profit" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add components/charts/product-chart.tsx
git commit -m "feat(ui): add product performance bar chart"
```

---

### Task 10: Create Payment Method Chart

**Files:**
- Create: `frontend/components/charts/payment-chart.tsx`

**Step 1: Build pie chart component**

```typescript
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentBreakdown } from '@/types/analytics';

interface PaymentChartProps {
  data: PaymentBreakdown;
  title?: string;
}

const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#eab308', '#ec4899', '#14b8a6'];

export function PaymentChart({ data, title = "Payment Methods" }: PaymentChartProps) {
  const chartData = Object.entries(data || {}).map(([method, values]) => ({
    name: method,
    value: values.total,
    count: values.count,
    profit: values.profit
  }));

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #333',
                borderRadius: '8px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add components/charts/payment-chart.tsx
git commit -m "feat(ui): add payment methods pie chart"
```

---

## Phase 6: Enhanced Dashboard Components

### Task 11: Create Advanced Metrics Cards

**Files:**
- Create: `frontend/components/metrics/advanced-kpi-card.tsx`

**Step 1: Build enhanced KPI card with trend**

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface AdvancedKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

export function AdvancedKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "text-primary"
}: AdvancedKpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Icon className={`h-5 w-5 ${color}`} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              <span>{Math.abs(trend.value).toFixed(1)}% vs período anterior</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add components/metrics/advanced-kpi-card.tsx
git commit -m "feat(ui): add advanced KPI card with trend indicators"
```

---

### Task 12: Create Date Range Selector

**Files:**
- Create: `frontend/components/date-range-selector.tsx`

**Step 1: Build date range picker**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import { useState } from "react";

type DatePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface DateRangeSelectorProps {
  onRangeChange: (range: { start: Date; end: Date }) => void;
}

export function DateRangeSelector({ onRangeChange }: DateRangeSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('today');

  const presets: { value: DatePreset; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: 'quarter', label: 'Este Trimestre' },
    { value: 'year', label: 'Este Año' },
  ];

  const getDateRange = (preset: DatePreset): { start: Date; end: Date } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return { start: today, end: new Date() };

      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { start: weekStart, end: new Date() };

      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: monthStart, end: new Date() };

      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);
        return { start: quarterStart, end: new Date() };

      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return { start: yearStart, end: new Date() };

      default:
        return { start: today, end: new Date() };
    }
  };

  const handlePresetClick = (preset: DatePreset) => {
    setSelectedPreset(preset);
    const range = getDateRange(preset);
    onRangeChange(range);
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {presets.map((preset) => (
        <Button
          key={preset.value}
          variant={selectedPreset === preset.value ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick(preset.value)}
        >
          <Calendar className="w-4 h-4 mr-2" />
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/date-range-selector.tsx
git commit -m "feat(ui): add date range selector with presets"
```

---

## Phase 7: Analytics Page

### Task 13: Create Analytics Page Layout

**Files:**
- Create: `frontend/app/analytics/page.tsx`

**Step 1: Build comprehensive analytics page**

```typescript
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { DateRangeSelector } from "@/components/date-range-selector";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { ProductChart } from "@/components/charts/product-chart";
import { PaymentChart } from "@/components/charts/payment-chart";
import { AdvancedKpiCard } from "@/components/metrics/advanced-kpi-card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Percent,
  CreditCard,
  Package,
  RefreshCcw,
  ArrowLeft
} from "lucide-react";
import { AdvancedMetrics, TimeSeriesDataPoint, ProductMetric } from "@/types/analytics";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date()
  });
  const [metrics, setMetrics] = useState<AdvancedMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [products, setProducts] = useState<ProductMetric[]>([]);

  const fetchAnalytics = async () => {
    setIsLoading(true);

    try {
      // Fetch advanced metrics
      const { data: metricsData } = await supabase.rpc('get_advanced_metrics', {
        p_start_date: dateRange.start.toISOString(),
        p_end_date: dateRange.end.toISOString()
      });

      if (metricsData) setMetrics(metricsData);

      // Fetch time series
      const { data: seriesData } = await supabase.rpc('get_sales_time_series', {
        p_period: 'daily',
        p_days_back: 30
      });

      if (seriesData) setTimeSeries(seriesData);

      // Fetch product performance
      const { data: productsData } = await supabase.rpc('get_product_performance', {
        p_days_back: 30
      });

      if (productsData) setProducts(productsData);

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, dateRange]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);

  return (
    <main className="min-h-screen p-8 bg-[url('/coffee-bg-dark.jpg')] bg-cover bg-center bg-fixed bg-no-repeat relative">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0"></div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-primary">
                  Analytics Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                  Análisis avanzado de ventas y rentabilidad
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAnalytics}
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </header>

        {/* Date Range Selector */}
        <DateRangeSelector onRangeChange={setDateRange} />

        {/* KPI Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AdvancedKpiCard
            title="Ingresos Totales"
            value={formatCurrency(metrics?.total_revenue || 0)}
            subtitle={`${metrics?.sales_count || 0} ventas`}
            icon={DollarSign}
            color="text-orange-500"
          />
          <AdvancedKpiCard
            title="Ganancia Total"
            value={formatCurrency(metrics?.total_profit || 0)}
            subtitle="Después de costos"
            icon={TrendingUp}
            color="text-green-500"
          />
          <AdvancedKpiCard
            title="Margen Promedio"
            value={`${metrics?.avg_profit_margin.toFixed(1) || 0}%`}
            subtitle="Rentabilidad"
            icon={Percent}
            color="text-blue-500"
          />
          <AdvancedKpiCard
            title="Créditos Pendientes"
            value={formatCurrency(metrics?.pending_credits || 0)}
            subtitle="Por cobrar"
            icon={CreditCard}
            color="text-yellow-500"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-4 md:grid-cols-2">
          <RevenueChart data={timeSeries} />
          <PaymentChart data={metrics?.payment_breakdown || {}} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 md:grid-cols-1">
          <ProductChart data={products} />
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <AdvancedKpiCard
            title="Ticket Promedio"
            value={formatCurrency(metrics?.avg_ticket || 0)}
            icon={ShoppingBag}
          />
          <AdvancedKpiCard
            title="Valor Inventario"
            value={formatCurrency(metrics?.inventory_value || 0)}
            icon={Package}
          />
          <AdvancedKpiCard
            title="Items Bajo Stock"
            value={metrics?.low_stock_items || 0}
            subtitle="Requieren reorden"
            icon={Package}
            color="text-red-500"
          />
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Test page navigation**

Add link from main dashboard.

**Step 3: Commit**

```bash
git add app/analytics/page.tsx
git commit -m "feat(ui): create comprehensive analytics page"
```

---

### Task 14: Add Navigation to Analytics

**Files:**
- Modify: `frontend/app/page.tsx`

**Step 1: Add analytics button to main dashboard**

In the header section, add:

```typescript
import { BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

// Inside component:
const router = useRouter();

// In header buttons:
<Button
  variant="outline"
  onClick={() => router.push('/analytics')}
>
  <BarChart3 className="mr-2 h-5 w-5" />
  Analytics
</Button>
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat(nav): add analytics page navigation button"
```

---

## Phase 8: Testing & Refinement

### Task 15: Test All Database Functions

**Files:**
- Create: `frontend/scripts/test-analytics.js`

**Step 1: Create test script**

```javascript
#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnalytics() {
  console.log('🧪 Testing Analytics Functions\n');

  // Test 1: Advanced Metrics
  console.log('1️⃣ Testing get_advanced_metrics...');
  const { data: metrics, error: metricsError } = await supabase.rpc('get_advanced_metrics');

  if (metricsError) {
    console.error('❌ Error:', metricsError.message);
  } else {
    console.log('✅ Success:', JSON.stringify(metrics, null, 2));
  }

  // Test 2: Time Series
  console.log('\n2️⃣ Testing get_sales_time_series...');
  const { data: series, error: seriesError } = await supabase.rpc('get_sales_time_series', {
    p_period: 'daily',
    p_days_back: 7
  });

  if (seriesError) {
    console.error('❌ Error:', seriesError.message);
  } else {
    console.log('✅ Success: Received', series?.length || 0, 'data points');
  }

  // Test 3: Product Performance
  console.log('\n3️⃣ Testing get_product_performance...');
  const { data: products, error: productsError } = await supabase.rpc('get_product_performance');

  if (productsError) {
    console.error('❌ Error:', productsError.message);
  } else {
    console.log('✅ Success: Received', products?.length || 0, 'products');
  }

  console.log('\n✨ All tests completed!');
}

testAnalytics().catch(console.error);
```

**Step 2: Make executable and run**

```bash
chmod +x scripts/test-analytics.js
node scripts/test-analytics.js
```

**Step 3: Commit**

```bash
git add scripts/test-analytics.js
git commit -m "test: add analytics functions test script"
```

---

### Task 16: Deploy and Verify

**Step 1: Deploy to Vercel**

```bash
vercel --prod
```

**Step 2: Manual testing checklist**

- [ ] Navigate to `/analytics` page
- [ ] Verify all KPI cards show data
- [ ] Check revenue chart renders
- [ ] Check product bar chart renders
- [ ] Check payment pie chart renders
- [ ] Test date range selector
- [ ] Create a test sale and verify metrics update
- [ ] Verify profit calculations are correct

**Step 3: Document in README**

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete advanced analytics dashboard implementation

- Added cost tracking to inventory
- Implemented profit calculation in sales
- Created advanced metrics RPCs
- Built comprehensive analytics page with charts
- Added date range filtering
- Integrated Recharts for visualizations"
git push
```

---

## Summary

**Total Implementation:**
- 7 new database migrations
- 4 new RPC functions
- 8 new React components
- 1 new analytics page
- Complete profit tracking system
- Advanced time-series analytics
- Multi-period reporting
- Interactive charts

**Estimated Time:** 4-6 hours for experienced developer

**Key Features Delivered:**
✅ Profit/loss tracking
✅ Cost per product management
✅ Advanced metrics dashboard
✅ Revenue/profit charts
✅ Product performance analysis
✅ Payment method breakdown
✅ Date range filtering
✅ Trend indicators
✅ Pending credits tracking
✅ Low stock alerts

---

## Post-Implementation Enhancements

**Future additions (not in this plan):**
- Export to CSV/PDF
- Customer lifetime value
- Forecasting/projections
- Email reports
- Mobile responsive optimizations
- Real-time updates with Supabase subscriptions
- Inventory reorder automation
- Multi-currency support
- Tax calculations
