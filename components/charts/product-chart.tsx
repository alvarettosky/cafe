"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductMetric } from '@/types/analytics';

interface ProductChartProps {
  data: ProductMetric[];
  title?: string;
}

export function ProductChart({ data, title = "Rendimiento de Productos" }: ProductChartProps) {
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
            <Bar
              dataKey="revenue"
              fill="#f97316"
              name="Ingresos"
            />
            <Bar
              dataKey="profit"
              fill="#22c55e"
              name="Ganancia"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
