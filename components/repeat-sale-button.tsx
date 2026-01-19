"use client";

import { useState } from "react";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { NewSaleModal, SaleInitialData } from "./new-sale-modal";

interface RepeatSaleButtonProps {
  customerId: string;
  customerName: string;
  onSaleCreated?: () => void;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  className?: string;
}

export function RepeatSaleButton({
  customerId,
  customerName,
  onSaleCreated,
  variant = "outline",
  size = "sm",
  showLabel = true,
  className = "",
}: RepeatSaleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialData, setInitialData] = useState<SaleInitialData | null>(null);

  const handleClick = async () => {
    // No repetir para cliente anónimo
    if (customerId === "00000000-0000-0000-0000-000000000000") {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_last_sale_for_repeat",
        { p_customer_id: customerId }
      );

      if (rpcError) throw rpcError;

      if (!data) {
        setError("Este cliente no tiene compras previas");
        setTimeout(() => setError(null), 3000);
        return;
      }

      // Preparar datos para el modal
      const saleData: SaleInitialData = {
        customerId: data.customer_id,
        customerName: customerName,
        items: data.items || [],
        paymentMethod: data.payment_method || "Efectivo",
      };

      setInitialData(saleData);
      setIsModalOpen(true);
    } catch (err: unknown) {
      console.error("Error fetching last sale:", err);
      setError(err instanceof Error ? err.message : "Error al obtener última venta");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setInitialData(null);
  };

  const handleSaleComplete = () => {
    setIsModalOpen(false);
    setInitialData(null);
    if (onSaleCreated) {
      onSaleCreated();
    }
  };

  // No mostrar para cliente anónimo
  if (customerId === "00000000-0000-0000-0000-000000000000") {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isLoading}
        className={`${className} ${error ? "border-red-500 text-red-500" : ""}`}
        title={error || "Repetir última compra"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : error ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {showLabel && (
          <span className="ml-2">
            {error ? "Sin compras" : "Repetir"}
          </span>
        )}
      </Button>

      {/* Modal controlado externamente */}
      <NewSaleModal
        onSaleComplete={handleSaleComplete}
        externalOpen={isModalOpen}
        onExternalClose={handleModalClose}
        initialData={initialData}
        showTrigger={false}
      />
    </>
  );
}
