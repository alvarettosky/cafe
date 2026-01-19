"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCustomerPortal } from "@/context/customer-portal-context";
import { motion } from "framer-motion";
import {
  Coffee,
  Loader2,
  ArrowLeft,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface OrderItem {
  product_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_price: number;
}

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  payment_method: string;
  status: string | null;
  notes: string | null;
  items: OrderItem[];
}

export default function PortalPedidosPage() {
  const router = useRouter();
  const { customer, isLoading: authLoading, isAuthenticated } = useCustomerPortal();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/portal/auth");
      return;
    }

    const fetchOrders = async () => {
      if (!customer) return;

      try {
        const { data, error } = await supabase.rpc("get_customer_order_history", {
          p_customer_id: customer.customer_id,
          p_limit: limit,
          p_offset: offset,
        });

        if (error) {
          console.error("Orders fetch error:", error);
          return;
        }

        setOrders(data.orders || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error("Orders error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (customer) {
      fetchOrders();
    }
  }, [customer, authLoading, isAuthenticated, router, offset]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
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

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/portal">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Coffee className="h-6 w-6 text-amber-600" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              Mis Pedidos
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <p className="text-gray-600 dark:text-gray-300">
          Historial completo de tus pedidos ({total} pedidos)
        </p>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No tienes pedidos aun</p>
              <Link href="/portal/nuevo-pedido">
                <Button className="mt-4 bg-amber-600 hover:bg-amber-700">
                  Hacer mi primer pedido
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
                    onClick={() => toggleExpand(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatDate(order.created_at)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {order.items?.length || 0} producto(s)
                          {order.status === "pending_confirmation" && (
                            <span className="ml-2 text-orange-600 font-medium">
                              Pendiente
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-amber-600">
                          {formatCurrency(order.total_amount)}
                        </p>
                        {expandedOrder === order.id ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedOrder === order.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="border-t border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 p-4"
                    >
                      <div className="space-y-2">
                        {order.items?.map((item, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-700 dark:text-gray-300">
                              {item.quantity} {item.unit} {item.product_name}
                            </span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {formatCurrency(item.total_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-zinc-600 flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Pago: {order.payment_method || "No especificado"}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          Total: {formatCurrency(order.total_amount)}
                        </span>
                      </div>
                      {order.notes && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                          Nota: {order.notes}
                        </p>
                      )}
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            ))}

            {/* Pagination */}
            {total > limit && (
              <div className="flex justify-center gap-4 pt-4">
                <Button
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
