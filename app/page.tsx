"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewCustomerModal } from "@/components/new-customer-modal";
import { Coffee, Package, TrendingUp, AlertTriangle, RefreshCcw, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { InventoryList } from "@/components/inventory-list";
import { useAuth } from "@/components/auth-provider";
import { Loader2 } from "lucide-react";
import { DashboardStats } from "@/types";
import { Diagnostics } from "@/components/diagnostics";
import Link from "next/link";

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  useEffect(() => {
    if (!user || isLoading) return;

    const fetchData = async () => {
      // Fetch Stats
      const { data: statsData } = await supabase.rpc('get_dashboard_stats');
      if (statsData) setStats(statsData);

      // Fetch Recent Sales with customer info
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          *,
          customers (
            full_name,
            address,
            phone
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (salesData) setRecentSales(salesData);
    };

    fetchData();
  }, [refreshKey, user, isLoading]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) return null; // AuthProvider handles redirect

  return (
    <main className="min-h-screen p-8 bg-[url('/coffee-bg-dark.jpg')] bg-cover bg-center bg-fixed bg-no-repeat relative">
      {/* Overlay to ensure readability */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0"></div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-primary">
              Mirador Montañero
              <span className="block text-3xl mt-1">Café Selecto</span>
            </h1>
            <p className="text-muted-foreground mt-2">Panel de Control & Inventario</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCcw className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => router.push('/analytics')}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <NewCustomerModal />
            <Link href="/ventas/nueva">
              <Button variant="default" size="lg" className="shadow-lg shadow-primary/20">
                <Coffee className="mr-2 h-5 w-5" /> Nueva Venta
              </Button>
            </Link>
          </div>
        </header>

        {/* KPI Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total en Inventario"
            value={stats?.total_inventory_grams != null ? `${stats.total_inventory_grams.toLocaleString()} g` : "..."}
            icon={Package}
            description="Stock actual disponible"
          />
          <KpiCard
            title="Ventas Hoy"
            value={stats?.sales_today != null ? `$ ${stats.sales_today.toLocaleString()}` : "..."}
            icon={TrendingUp}
            trend={stats && stats.sales_today > 0 ? "Activo" : "Sin ventas"}
          />
          <KpiCard
            title="Café Tostado"
            value={stats?.roasted_coffee_lbs != null ? `${Number(stats.roasted_coffee_lbs).toFixed(1)} lbs` : "..."}
            icon={Coffee}
          />
          <KpiCard
            title="Alertas Stock"
            value={stats ? `${stats.low_stock_count}` : "..."}
            icon={AlertTriangle}
            description="Items bajo mínimo"
            className={stats && stats.low_stock_count > 0 ? "border-destructive/50 text-destructive" : ""}
          />
        </div>

        {/* Content Area */}
        <div className="grid gap-4 md:grid-cols-7 lg:grid-cols-8">
          <InventoryList />

          <Card className="col-span-3 lg:col-span-3">
            <CardHeader>
              <CardTitle>Ventas Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentSales.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay ventas recientes</p>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="p-2 bg-primary/20 rounded-full flex-shrink-0">
                          <Coffee className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {sale.customers?.full_name || 'Cliente General'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {sale.customers?.address || new Date(sale.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-sm flex-shrink-0 ml-2">$ {Number(sale.total_amount).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Diagnostics />
    </main>
  );
}

function KpiCard({ title, value, icon: Icon, trend, description, className }: any) {
  return (
    <Card hoverEffect className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(trend || description) && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend && <span className="text-green-500 font-medium mr-1">{trend}</span>}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
