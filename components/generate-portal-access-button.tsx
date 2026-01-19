"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Key, Loader2, Copy, CheckCircle, MessageCircle, ExternalLink } from "lucide-react";

interface GeneratePortalAccessButtonProps {
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  className?: string;
}

interface MagicLinkResult {
  success?: boolean;
  error?: string;
  magic_link?: string;
  expires_at?: string;
  whatsapp_url?: string;
  customer_name?: string;
}

export function GeneratePortalAccessButton({
  customerId,
  customerName,
  customerPhone,
  variant = "outline",
  size = "sm",
  showLabel = true,
  className = "",
}: GeneratePortalAccessButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MagicLinkResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.rpc("generate_customer_magic_link", {
        p_customer_id: customerId,
      });

      if (error) {
        console.error("Error generating magic link:", error);
        setResult({ error: "Error al generar enlace" });
        return;
      }

      setResult(data);
    } catch (err) {
      console.error("Magic link error:", err);
      setResult({ error: "Error de conexion" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setIsOpen(true);
    handleGenerate();
  };

  const handleCopyLink = async () => {
    if (result?.magic_link) {
      try {
        await navigator.clipboard.writeText(result.magic_link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Copy error:", err);
      }
    }
  };

  const handleOpenWhatsApp = () => {
    if (result?.whatsapp_url) {
      window.open(result.whatsapp_url, "_blank");
    }
  };

  // No mostrar si no tiene telefono
  if (!customerPhone || customerPhone === "N/A") {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleOpenDialog}
        className={className}
        title="Generar acceso al portal"
      >
        <Key className="h-4 w-4" />
        {showLabel && <span className="ml-2">Portal</span>}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Acceso al Portal
            </DialogTitle>
            <DialogDescription>
              Genera un enlace de acceso para {customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              </div>
            )}

            {result?.error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg text-center">
                {result.error}
              </div>
            )}

            {result?.success && result.magic_link && (
              <>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    Enlace generado correctamente
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Valido por 24 horas
                  </p>
                </div>

                {/* Link Preview */}
                <div className="bg-gray-100 dark:bg-zinc-800 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Enlace de acceso:</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 break-all font-mono">
                    {result.magic_link}
                  </p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCopyLink}
                    className="w-full"
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>

                  <Button
                    onClick={handleOpenWhatsApp}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                </div>

                {/* Open Link */}
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => window.open(result.magic_link, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir enlace
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
