"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCustomerPortal } from "@/context/customer-portal-context";
import { motion } from "framer-motion";
import { Coffee, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type AuthState = "validating" | "success" | "error" | "expired";

function PortalAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useCustomerPortal();

  const [authState, setAuthState] = useState<AuthState>("validating");
  const [errorMessage, setErrorMessage] = useState("");
  const [customerName, setCustomerName] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    // Si ya está autenticado, redirigir al portal
    if (isAuthenticated) {
      router.push("/portal");
      return;
    }

    // Validar el token
    const validateToken = async () => {
      if (!token) {
        setAuthState("error");
        setErrorMessage("No se proporcionó un token de acceso");
        return;
      }

      try {
        const { data, error } = await supabase.rpc("validate_customer_magic_link", {
          p_token: token,
        });

        if (error) {
          console.error("Magic link validation error:", error);
          setAuthState("error");
          setErrorMessage("Error al validar el enlace");
          return;
        }

        if (data.error) {
          setAuthState("expired");
          setErrorMessage(data.error);
          return;
        }

        if (data.success) {
          // Login exitoso
          setCustomerName(data.customer_name);
          login(data.session_token, {
            customer_id: data.customer_id,
            customer_name: data.customer_name,
            customer_phone: null,
            customer_email: data.customer_email,
            typical_recurrence_days: null,
            last_purchase_date: null,
          });
          setAuthState("success");

          // Redirigir después de 2 segundos
          setTimeout(() => {
            router.push("/portal");
          }, 2000);
        }
      } catch (err) {
        console.error("Validation error:", err);
        setAuthState("error");
        setErrorMessage("Error de conexión");
      }
    };

    validateToken();
  }, [token, isAuthenticated, login, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full">
            <Coffee className="h-12 w-12 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Portal Cafe Mirador
        </h1>

        {/* Estado: Validando */}
        {authState === "validating" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8"
          >
            <Loader2 className="h-12 w-12 text-amber-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Verificando acceso...</p>
          </motion.div>
        )}

        {/* Estado: Éxito */}
        {authState === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-8"
          >
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              Bienvenido, {customerName}!
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              Redirigiendo a tu portal...
            </p>
          </motion.div>
        )}

        {/* Estado: Enlace expirado */}
        {authState === "expired" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8"
          >
            <XCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              Enlace expirado
            </p>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {errorMessage || "Este enlace ya no es valido. Solicita uno nuevo a tu vendedor."}
            </p>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = "https://wa.me/573001234567?text=Hola,%20necesito%20un%20nuevo%20enlace%20de%20acceso%20al%20portal"}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Solicitar nuevo enlace
              </Button>
            </div>
          </motion.div>
        )}

        {/* Estado: Error */}
        {authState === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8"
          >
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              Error de acceso
            </p>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {errorMessage || "No pudimos verificar tu acceso. Intenta de nuevo."}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </motion.div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Mirador Montanero Cafe Selecto
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function PortalAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
        </div>
      }
    >
      <PortalAuthContent />
    </Suspense>
  );
}
