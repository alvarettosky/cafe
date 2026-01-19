"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ShoppingBag,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  available: boolean;
}

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_type: "libra" | "media_libra";
}

function NuevoPedidoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer, isLoading: authLoading, isAuthenticated } = useCustomerPortal();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRepeat = searchParams.get("repeat") === "true";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/portal/auth");
      return;
    }

    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase.rpc("get_products_for_customer_order");

        if (error) {
          console.error("Products fetch error:", error);
          return;
        }

        setProducts(data || []);

        // Si es repetir pedido, cargar items del storage
        if (isRepeat) {
          const repeatData = sessionStorage.getItem("repeat_order");
          if (repeatData) {
            try {
              const items = JSON.parse(repeatData);
              const cartItems: CartItem[] = items.map((item: any) => ({
                product_id: item.product_id || "",
                product_name: item.product_name,
                quantity: item.quantity,
                unit_type: item.unit === "libra" ? "libra" : "media_libra",
              }));
              setCart(cartItems.filter((i) => i.product_id));
              sessionStorage.removeItem("repeat_order");
            } catch (e) {
              console.error("Error parsing repeat order:", e);
            }
          }
        }
      } catch (err) {
        console.error("Products error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (customer) {
      fetchProducts();
    }
  }, [customer, authLoading, isAuthenticated, router, isRepeat]);

  const addToCart = (product: Product) => {
    const existing = cart.find((i) => i.product_id === product.id);
    if (existing) {
      setCart(
        cart.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setCart([
        ...cart,
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
    setCart(
      cart
        .map((i) =>
          i.product_id === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const toggleUnit = (productId: string) => {
    setCart(
      cart.map((i) =>
        i.product_id === productId
          ? {
              ...i,
              unit_type: i.unit_type === "libra" ? "media_libra" : "libra",
            }
          : i
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((i) => i.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (!customer || cart.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: submitError } = await supabase.rpc(
        "create_customer_order",
        {
          p_customer_id: customer.customer_id,
          p_items: cart.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_type: i.unit_type,
          })),
          p_notes: notes || null,
        }
      );

      if (submitError) {
        console.error("Order submit error:", submitError);
        setError("Error al enviar pedido");
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      setOrderSuccess(true);
    } catch (err) {
      console.error("Submit error:", err);
      setError("Error de conexion");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
      </div>
    );
  }

  // Success State
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="max-w-md w-full text-center">
            <CardContent className="py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Pedido Recibido!
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Te confirmaremos pronto por WhatsApp con el precio y detalles de
                entrega.
              </p>
              <Link href="/portal">
                <Button className="w-full bg-amber-600 hover:bg-amber-700">
                  Volver al inicio
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
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
              Nuevo Pedido
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selecciona productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <motion.button
                  key={product.id}
                  whileTap={{ scale: 0.95 }}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    cart.find((i) => i.product_id === product.id)
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-200 dark:border-zinc-700 hover:border-amber-300"
                  } ${
                    !product.available
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  onClick={() => product.available && addToCart(product)}
                  disabled={!product.available}
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {product.name}
                  </p>
                  {!product.available && (
                    <p className="text-xs text-red-500 mt-1">Sin stock</p>
                  )}
                  {cart.find((i) => i.product_id === product.id) && (
                    <p className="text-xs text-amber-600 mt-1">En carrito</p>
                  )}
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        {cart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Tu pedido ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.map((item) => (
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
                      onClick={() => removeFromCart(item.product_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Notes */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas adicionales (opcional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white resize-none"
                  rows={2}
                  placeholder="Ej: Entregar en la tarde, molienda fina, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ShoppingBag className="h-5 w-5 mr-2" />
                    Enviar Pedido
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-gray-500">
                El precio final te lo confirmaremos por WhatsApp
              </p>
            </CardContent>
          </Card>
        )}

        {cart.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Selecciona los productos que deseas pedir
          </p>
        )}
      </main>
    </div>
  );
}

export default function NuevoPedidoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
        </div>
      }
    >
      <NuevoPedidoContent />
    </Suspense>
  );
}
