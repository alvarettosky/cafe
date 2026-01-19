"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCustomerPortal } from "@/context/customer-portal-context";
import { motion } from "framer-motion";
import {
  Coffee,
  Loader2,
  ShoppingBag,
  Clock,
  RefreshCw,
  User,
  LogOut,
  MessageCircle,
  History,
  Calendar,
  Package,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface DashboardData {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    typical_recurrence_days: number | null;
  };
  last_sale: {
    id: string;
    created_at: string;
    total_amount: number;
    payment_method: string;
    items: Array<{
      product_name: string;
      quantity: number;
      unit: string;
      price_per_unit: number;
      total_price: number;
    }>;
  } | null;
  days_since_purchase: number | null;
  days_until_next: number | null;
  recent_sales: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    items_summary: string;
  }>;
  status: "new" | "ok" | "soon" | "due";
  has_subscription: boolean;
  subscription: {
    id: string;
    frequency_days: number;
    next_order_date: string;
    status: string;
  } | null;
}

export default function PortalDashboard() {
  const router = useRouter();
  const { customer, isLoading: authLoading, isAuthenticated, logout } = useCustomerPortal();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirigir si no está autenticado (después de cargar)
    if (!authLoading && !isAuthenticated) {
      router.push("/portal/auth");
      return;
    }

    // Cargar datos del dashboard
    const fetchDashboard = async () => {
      if (!customer) return;

      try {
        const { data, error: fetchError } = await supabase.rpc(
          "get_customer_portal_dashboard",
          { p_customer_id: customer.customer_id }
        );

        if (fetchError) {
          console.error("Dashboard fetch error:", fetchError);
          setError("Error al cargar datos");
          return;
        }

        if (data.error) {
          setError(data.error);
          return;
        }

        setDashboardData(data);
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("Error de conexión");
      } finally {
        setIsLoading(false);
      }
    };

    if (customer) {
      fetchDashboard();
    }
  }, [customer, authLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/portal/auth");
  };

  const handleRepeatLastOrder = () => {
    if (dashboardData?.last_sale) {
      // Almacenar datos para el formulario de nuevo pedido
      sessionStorage.setItem(
        "repeat_order",
        JSON.stringify(dashboardData.last_sale.items)
      );
      router.push("/portal/nuevo-pedido?repeat=true");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Error</p>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColors = {
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ok: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    soon: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    due: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const statusLabels = {
    new: "Nuevo cliente",
    ok: "Todo bien",
    soon: "Pedido pronto",
    due: "Es hora de pedir",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coffee className="h-8 w-8 text-amber-600" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              Cafe Mirador
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/portal/perfil">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hola, {dashboardData?.customer.name || customer?.customer_name}!
          </h1>
          {dashboardData && (
            <span
              className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                statusColors[dashboardData.status]
              }`}
            >
              {statusLabels[dashboardData.status]}
            </span>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          {/* Last Order Card */}
          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Ultimo pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.last_sale ? (
                <>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    hace {dashboardData.days_since_purchase || 0} dias
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                    {dashboardData.last_sale.items
                      ?.map((i) => `${i.quantity} ${i.unit} ${i.product_name}`)
                      .join(", ")}
                  </p>
                  <p className="text-amber-600 font-semibold mt-1">
                    {formatCurrency(dashboardData.last_sale.total_amount)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={handleRepeatLastOrder}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Repetir
                  </Button>
                </>
              ) : (
                <p className="text-gray-500">Sin pedidos aun</p>
              )}
            </CardContent>
          </Card>

          {/* Next Order Card */}
          <Card className="col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Proximo pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData && dashboardData.days_until_next !== null ? (
                <>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {dashboardData.days_until_next > 0
                      ? `en ~${dashboardData.days_until_next} dias`
                      : dashboardData.days_until_next === 0
                      ? "Hoy!"
                      : `hace ${Math.abs(dashboardData.days_until_next)} dias`}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Recurrencia: cada{" "}
                    {dashboardData.customer.typical_recurrence_days || 15} dias
                  </p>
                </>
              ) : (
                <p className="text-gray-500">Aun no hay datos</p>
              )}
              <Link href="/portal/nuevo-pedido">
                <Button className="mt-3 w-full bg-amber-600 hover:bg-amber-700">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Hacer pedido
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Subscription Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {dashboardData?.has_subscription && dashboardData.subscription ? (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Suscripcion Activa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 dark:text-white">
                  Pedido automatico cada{" "}
                  <strong>{dashboardData.subscription.frequency_days}</strong>{" "}
                  dias
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Proximo:{" "}
                  {formatDate(dashboardData.subscription.next_order_date)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href="/portal/suscripcion">
                    <Button variant="outline" size="sm">
                      Gestionar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-gray-300 dark:border-zinc-600">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <RefreshCw className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Suscripcion automatica
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Recibe tu cafe sin hacer pedidos
                      </p>
                    </div>
                  </div>
                  <Link href="/portal/suscripcion">
                    <Button variant="outline" size="sm">
                      Configurar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Mis pedidos recientes
              </CardTitle>
              <Link href="/portal/pedidos">
                <Button variant="ghost" size="sm">
                  Ver todos
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {dashboardData?.recent_sales &&
              dashboardData.recent_sales.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.recent_sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-zinc-700 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatDate(sale.created_at)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                          {sale.items_summary}
                        </p>
                      </div>
                      <p className="font-semibold text-amber-600">
                        {formatCurrency(sale.total_amount)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No tienes pedidos aun
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  <span className="text-gray-900 dark:text-white">
                    Necesitas ayuda?
                  </span>
                </div>
                <a
                  href="https://wa.me/573001234567?text=Hola,%20tengo%20una%20pregunta%20sobre%20mi%20pedido"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    Escribir por WhatsApp
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
        Mirador Montanero Cafe Selecto
      </footer>
    </div>
  );
}
