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
