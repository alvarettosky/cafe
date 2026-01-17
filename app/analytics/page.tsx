'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import { AdvancedKPICard } from '@/components/metrics/advanced-kpi-card';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { PaymentChart } from '@/components/charts/payment-chart';
import { ProductChart } from '@/components/charts/product-chart';
import { DateRangeSelector } from '@/components/date-range-selector';
import { Button } from '@/components/ui/button';
import type {
  AdvancedMetrics,
  TimeSeriesDataPoint,
  ProductMetric,
} from '@/types/analytics';

type PendingCredit = {
  sale_id: string;
  customer_name: string;
  sale_date: string;
  amount_due: number;
  days_pending: number;
};

// Helper function to get date range
const getDateRange = (preset: string = 'este-mes') => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case 'hoy':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'esta-semana':
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(now.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'este-mes':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'este-trimestre':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start.setMonth(currentQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(currentQuarter * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'este-año':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // State for date range
  const [activePreset, setActivePreset] = useState<string>('este-mes');
  const [dateRange, setDateRange] = useState(() => getDateRange('este-mes'));

  // State for data
  const [metrics, setMetrics] = useState<AdvancedMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesDataPoint[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductMetric[]>(
    []
  );
  const [pendingCredits, setPendingCredits] = useState<PendingCredit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Fetch advanced metrics
  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        const { data, error } = await supabase.rpc('get_advanced_metrics', {
          start_date: dateRange.start.toISOString(),
          end_date: dateRange.end.toISOString(),
        });

        if (error) throw error;
        setMetrics(data);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError('Failed to load metrics');
      }
    };

    fetchMetrics();
  }, [user, dateRange]);

  // Fetch time series data
  useEffect(() => {
    if (!user) return;

    const fetchTimeSeries = async () => {
      try {
        const { data, error } = await supabase.rpc('get_sales_time_series', {
          start_date: dateRange.start.toISOString(),
          end_date: dateRange.end.toISOString(),
          granularity: 'day',
        });

        if (error) throw error;
        setTimeSeries(data || []);
      } catch (err) {
        console.error('Error fetching time series:', err);
        setError('Failed to load time series data');
      }
    };

    fetchTimeSeries();
  }, [user, dateRange]);

  // Fetch product performance
  useEffect(() => {
    if (!user) return;

    const fetchProductPerformance = async () => {
      try {
        setIsLoadingData(true);
        const { data, error } = await supabase.rpc('get_product_performance', {
          start_date: dateRange.start.toISOString(),
          end_date: dateRange.end.toISOString(),
        });

        if (error) throw error;
        setProductPerformance(data || []);
      } catch (err) {
        console.error('Error fetching product performance:', err);
        setError('Failed to load product performance');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchProductPerformance();
  }, [user, dateRange]);

  // Fetch pending credits
  useEffect(() => {
    if (!user) return;

    const fetchPendingCredits = async () => {
      try {
        const { data, error } = await supabase.rpc('get_pending_credits');

        if (error) throw error;
        setPendingCredits(data || []);
      } catch (err) {
        console.error('Error fetching pending credits:', err);
        // Don't set error state, it's not critical
      }
    };

    fetchPendingCredits();
  }, [user]);

  // Handle preset change
  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    const range = getDateRange(preset);
    setDateRange(range);
  };

  // Show loading spinner while authenticating
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-[url('/coffee-bg.jpg')] bg-cover bg-center bg-fixed">
      <div className="min-h-screen backdrop-blur-sm bg-black/40">
        <div className="mx-auto max-w-7xl p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push('/')}
                className="bg-white/10 border-white/20 hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </Button>
              <h1 className="text-4xl font-bold text-white">
                Analíticas Avanzadas
              </h1>
            </div>
          </motion.div>

          {/* Date Range Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-start"
          >
            <DateRangeSelector
              onPresetChange={handlePresetChange}
              activePreset={activePreset as any}
            />
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg bg-red-500/20 border border-red-500/50 p-4"
            >
              <p className="text-red-200">{error}</p>
            </motion.div>
          )}

          {/* Loading State */}
          {isLoadingData && !metrics && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {/* KPI Cards Grid */}
          {metrics && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <AdvancedKPICard
                title="Ingresos Totales"
                value={formatCurrency(metrics.total_revenue)}
                subtitle={`${metrics.sales_count} ventas`}
                icon={DollarSign}
              />

              <AdvancedKPICard
                title="Ganancia Total"
                value={formatCurrency(metrics.total_profit)}
                subtitle={`${formatPercentage(metrics.avg_profit_margin)} margen`}
                icon={TrendingUp}
              />

              <AdvancedKPICard
                title="Ticket Promedio"
                value={formatCurrency(metrics.avg_ticket)}
                subtitle={`${metrics.sales_count} transacciones`}
                icon={ShoppingCart}
              />

              <AdvancedKPICard
                title="Valor de Inventario"
                value={formatCurrency(metrics.inventory_value)}
                subtitle={`${metrics.low_stock_items} productos con poco stock`}
                icon={Package}
              />
            </motion.div>
          )}

          {/* Charts Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Revenue Chart - Full Width on Top */}
            <div className="lg:col-span-2">
              <RevenueChart data={timeSeries} />
            </div>

            {/* Payment Chart */}
            {metrics?.payment_breakdown && (
              <PaymentChart data={metrics.payment_breakdown} />
            )}

            {/* Product Chart */}
            <ProductChart data={productPerformance} />
          </motion.div>

          {/* Pending Credits Table */}
          {pendingCredits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-6"
            >
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-yellow-300" />
                Pagos Pendientes
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-3 px-4 text-white font-semibold">Cliente</th>
                      <th className="text-left py-3 px-4 text-white font-semibold">Fecha de Compra</th>
                      <th className="text-right py-3 px-4 text-white font-semibold">Monto Adeudado</th>
                      <th className="text-right py-3 px-4 text-white font-semibold">Días Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingCredits.map((credit) => (
                      <tr
                        key={credit.sale_id}
                        className="border-b border-white/10 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4 text-white">{credit.customer_name}</td>
                        <td className="py-3 px-4 text-white/80">
                          {new Date(credit.sale_date).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-yellow-300">
                          {formatCurrency(credit.amount_due)}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${
                          credit.days_pending > 30
                            ? 'text-red-400'
                            : credit.days_pending > 15
                            ? 'text-yellow-400'
                            : 'text-green-400'
                        }`}>
                          {credit.days_pending} días
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/30">
                      <td colSpan={2} className="py-3 px-4 text-right font-bold text-white">
                        Total:
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-yellow-300 text-lg">
                        {formatCurrency(
                          pendingCredits.reduce((sum, credit) => sum + credit.amount_due, 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-white/60 text-sm">
                        {pendingCredits.length} {pendingCredits.length === 1 ? 'pago' : 'pagos'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </motion.div>
          )}

          {/* Pending Credits Warning */}
          {metrics && metrics.pending_credits > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-lg bg-yellow-500/20 border border-yellow-500/50 p-4 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-yellow-300 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-200">
                  Pagos Pendientes
                </h3>
                <p className="text-yellow-100/80">
                  Hay {formatCurrency(metrics.pending_credits)} en ventas a crédito
                  pendientes de cobro.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
