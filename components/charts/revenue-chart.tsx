"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSeriesDataPoint } from '@/types/analytics';

interface RevenueChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
}

export function RevenueChart({ data, title = "Tendencia de Ingresos y Ganancias" }: RevenueChartProps) {
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
              name="Ingresos"
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#22c55e"
              strokeWidth={2}
              name="Ganancia"
            />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#ef4444"
              strokeWidth={2}
              name="Costo"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
