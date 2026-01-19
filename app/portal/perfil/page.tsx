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
  User,
  Phone,
  Mail,
  MapPin,
  Save,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PortalPerfilPage() {
  const router = useRouter();
  const { customer, isLoading: authLoading, isAuthenticated, refreshSession } = useCustomerPortal();

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/portal/auth");
      return;
    }

    const fetchProfile = async () => {
      if (!customer) return;

      try {
        // Usar el dashboard para obtener datos actuales
        const { data, error } = await supabase.rpc("get_customer_portal_dashboard", {
          p_customer_id: customer.customer_id,
        });

        if (!error && data && data.customer) {
          setPhone(data.customer.phone || "");
          setEmail(data.customer.email || "");
          setAddress(data.customer.address || "");
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (customer) {
      fetchProfile();
    }
  }, [customer, authLoading, isAuthenticated, router]);

  const handleSave = async () => {
    if (!customer) return;

    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      const { data, error: saveError } = await supabase.rpc("update_customer_profile", {
        p_customer_id: customer.customer_id,
        p_phone: phone || null,
        p_email: email || null,
        p_address: address || null,
      });

      if (saveError) {
        console.error("Profile save error:", saveError);
        setError("Error al guardar");
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      setSaved(true);
      await refreshSession();

      // Reset saved indicator after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setError("Error de conexion");
    } finally {
      setIsSaving(false);
    }
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
              Mi Perfil
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {customer?.customer_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Phone className="h-4 w-4" />
                  Telefono
                </label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                  placeholder="Tu numero de telefono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail className="h-4 w-4" />
                  Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                  placeholder="Tu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Address */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPin className="h-4 w-4" />
                  Direccion de entrega
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white resize-none"
                  rows={2}
                  placeholder="Tu direccion para entregas"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              {saved && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-green-600 text-sm text-center flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Guardado correctamente
                </motion.p>
              )}

              <Button
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Card */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tu informacion nos ayuda a brindarte un mejor servicio.
              Mantenemos tus datos seguros y nunca los compartimos con terceros.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
