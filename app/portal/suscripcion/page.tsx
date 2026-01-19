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
  Plus,
  Minus,
  Trash2,
  Calendar,
  Pause,
  Play,
  SkipForward,
  XCircle,
  CheckCircle,
  RefreshCw,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  available: boolean;
}

interface SubscriptionItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_type: "libra" | "media_libra";
}

interface Subscription {
  id: string;
  frequency_days: number;
  status: "active" | "paused" | "cancelled";
  next_delivery_date: string | null;
  skip_next: boolean;
  items: SubscriptionItem[];
  created_at: string;
}

export default function PortalSuscripcionPage() {
  const router = useRouter();
  const { customer, isLoading: authLoading, isAuthenticated } = useCustomerPortal();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit state
  const [editItems, setEditItems] = useState<SubscriptionItem[]>([]);
  const [editFrequency, setEditFrequency] = useState(14);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/portal/auth");
      return;
    }

    const fetchData = async () => {
      if (!customer) return;

      try {
        // Fetch subscription
        const { data: subData, error: subError } = await supabase.rpc(
          "get_customer_subscription",
          { p_customer_id: customer.customer_id }
        );

        if (!subError && subData && !subData.error) {
          setSubscription(subData);
          setEditItems(subData.items || []);
          setEditFrequency(subData.frequency_days || 14);
        }

        // Fetch products for editing
        const { data: prodData } = await supabase.rpc("get_products_for_customer_order");
        setProducts(prodData || []);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (customer) {
      fetchData();
    }
  }, [customer, authLoading, isAuthenticated, router]);

  const handleAction = async (action: "pause" | "resume" | "skip" | "cancel") => {
    if (!customer) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: actionError } = await supabase.rpc(
        "toggle_subscription_status",
        {
          p_customer_id: customer.customer_id,
          p_action: action,
        }
      );

      if (actionError) {
        setError("Error al procesar la accion");
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      // Refresh subscription
      const { data: subData } = await supabase.rpc("get_customer_subscription", {
        p_customer_id: customer.customer_id,
      });

      if (subData && !subData.error) {
        setSubscription(subData);
      }

      const messages: Record<string, string> = {
        pause: "Suscripcion pausada",
        resume: "Suscripcion reanudada",
        skip: "Siguiente entrega omitida",
        cancel: "Suscripcion cancelada",
      };
      setSuccess(messages[action]);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Action error:", err);
      setError("Error de conexion");
    } finally {
      setIsSaving(false);
    }
  };

  const addProduct = (product: Product) => {
    const existing = editItems.find((i) => i.product_id === product.id);
    if (existing) {
      setEditItems(
        editItems.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setEditItems([
        ...editItems,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_type: "libra",
        },
      ]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setEditItems(
      editItems
        .map((i) =>
          i.product_id === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const toggleUnit = (productId: string) => {
    setEditItems(
      editItems.map((i) =>
        i.product_id === productId
          ? {
              ...i,
              unit_type: i.unit_type === "libra" ? "media_libra" : "libra",
            }
          : i
      )
    );
  };

  const removeItem = (productId: string) => {
    setEditItems(editItems.filter((i) => i.product_id !== productId));
  };

  const handleSave = async () => {
    if (!customer || editItems.length === 0) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: saveError } = await supabase.rpc(
        "upsert_customer_subscription",
        {
          p_customer_id: customer.customer_id,
          p_frequency_days: editFrequency,
          p_items: editItems.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_type: i.unit_type,
          })),
        }
      );

      if (saveError) {
        console.error("Save error:", saveError);
        setError("Error al guardar suscripcion");
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      // Refresh subscription
      const { data: subData } = await supabase.rpc("get_customer_subscription", {
        p_customer_id: customer.customer_id,
      });

      if (subData && !subData.error) {
        setSubscription(subData);
      }

      setSuccess(subscription ? "Suscripcion actualizada" : "Suscripcion creada");
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setError("Error de conexion");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Por calcular";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
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
              Mi Suscripcion
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg text-center"
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-4 rounded-lg text-center flex items-center justify-center gap-2"
          >
            <CheckCircle className="h-5 w-5" />
            {success}
          </motion.div>
        )}

        {/* No Subscription - Create */}
        {!subscription && !isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No tienes una suscripcion activa
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Crea una suscripcion para recibir tu cafe automaticamente
                  cada cierto tiempo sin tener que hacer pedidos.
                </p>
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => setIsEditing(true)}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Crear Suscripcion
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Active Subscription View */}
        {subscription && !isEditing && (
          <>
            {/* Status Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Estado
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        subscription.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : subscription.status === "paused"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {subscription.status === "active"
                        ? "Activa"
                        : subscription.status === "paused"
                        ? "Pausada"
                        : "Cancelada"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <Calendar className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm text-gray-500">Proxima entrega</p>
                      <p className="font-medium">
                        {subscription.skip_next ? (
                          <span className="text-yellow-600">Omitida</span>
                        ) : (
                          formatDate(subscription.next_delivery_date)
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <RefreshCw className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm text-gray-500">Frecuencia</p>
                      <p className="font-medium">
                        Cada {subscription.frequency_days} dias
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Products Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Productos en suscripcion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {subscription.items?.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-zinc-700 last:border-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.product_name}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {item.quantity}{" "}
                          {item.unit_type === "libra" ? "libra(s)" : "media(s)"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Acciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setIsEditing(true)}
                    disabled={subscription.status === "cancelled"}
                  >
                    <Package className="h-4 w-4 mr-3" />
                    Editar productos y frecuencia
                  </Button>

                  {subscription.status === "active" && (
                    <>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleAction("skip")}
                        disabled={isSaving || subscription.skip_next}
                      >
                        <SkipForward className="h-4 w-4 mr-3" />
                        {subscription.skip_next
                          ? "Ya omitida la proxima"
                          : "Omitir proxima entrega"}
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start text-yellow-600 hover:text-yellow-700"
                        onClick={() => handleAction("pause")}
                        disabled={isSaving}
                      >
                        <Pause className="h-4 w-4 mr-3" />
                        Pausar suscripcion
                      </Button>
                    </>
                  )}

                  {subscription.status === "paused" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start text-green-600 hover:text-green-700"
                      onClick={() => handleAction("resume")}
                      disabled={isSaving}
                    >
                      <Play className="h-4 w-4 mr-3" />
                      Reanudar suscripcion
                    </Button>
                  )}

                  {subscription.status !== "cancelled" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start text-red-600 hover:text-red-700"
                      onClick={() => handleAction("cancel")}
                      disabled={isSaving}
                    >
                      <XCircle className="h-4 w-4 mr-3" />
                      Cancelar suscripcion
                    </Button>
                  )}

                  {isSaving && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {/* Edit/Create Mode */}
        {isEditing && (
          <>
            {/* Frequency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Frecuencia de entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[7, 14, 21, 28, 30, 45].map((days) => (
                    <Button
                      key={days}
                      variant={editFrequency === days ? "default" : "outline"}
                      className={
                        editFrequency === days
                          ? "bg-amber-600 hover:bg-amber-700"
                          : ""
                      }
                      onClick={() => setEditFrequency(days)}
                    >
                      {days} dias
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Products Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Selecciona productos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {products.map((product) => (
                    <motion.button
                      key={product.id}
                      whileTap={{ scale: 0.95 }}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        editItems.find((i) => i.product_id === product.id)
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                          : "border-gray-200 dark:border-zinc-700 hover:border-amber-300"
                      } ${
                        !product.available
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                      onClick={() => product.available && addProduct(product)}
                      disabled={!product.available}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </p>
                      {!product.available && (
                        <p className="text-xs text-red-500 mt-1">Sin stock</p>
                      )}
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cart */}
            {editItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Productos seleccionados ({editItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editItems.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-zinc-700 last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.product_name}
                        </p>
                        <button
                          className="text-sm text-amber-600 hover:underline"
                          onClick={() => toggleUnit(item.product_id)}
                        >
                          {item.unit_type === "libra" ? "Libra" : "Media libra"}
                          <span className="text-gray-400 ml-1">(cambiar)</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-700 rounded-lg">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product_id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.product_id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => removeItem(item.product_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsEditing(false);
                  if (subscription) {
                    setEditItems(subscription.items || []);
                    setEditFrequency(subscription.frequency_days || 14);
                  } else {
                    setEditItems([]);
                    setEditFrequency(14);
                  }
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                onClick={handleSave}
                disabled={isSaving || editItems.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {subscription ? "Guardar cambios" : "Crear suscripcion"}
                  </>
                )}
              </Button>
            </div>

            {editItems.length === 0 && (
              <p className="text-center text-gray-500">
                Selecciona al menos un producto
              </p>
            )}
          </>
        )}

        {/* Info */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Con la suscripcion, recibiras tu cafe automaticamente segun la
              frecuencia que elijas. Te contactaremos antes de cada entrega para
              confirmar y coordinar.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
