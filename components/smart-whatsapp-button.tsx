"use client";

import { useState } from "react";
import { MessageCircle, Loader2, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type MessageType = 'auto' | 'reminder_preventive' | 'reminder_due' | 'reminder_overdue' | 'post_sale' | 'first_purchase' | 'prospect';

interface SmartWhatsAppButtonProps {
  customerId: string;
  customerName: string;
  phone?: string | null;
  messageType?: MessageType;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  showPreview?: boolean;
  className?: string;
}

interface WhatsAppMessage {
  message: string;
  phone: string;
  phone_clean: string;
  customer_name: string;
  template_used: string;
  days_since_purchase: number;
  whatsapp_url: string;
}

export function SmartWhatsAppButton({
  customerId,
  customerName,
  phone,
  messageType = 'auto',
  variant = "default",
  size = "sm",
  showLabel = true,
  showPreview = true,
  className = "",
}: SmartWhatsAppButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [messageData, setMessageData] = useState<WhatsAppMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Si no tiene teléfono, no mostrar el botón
  if (!phone) {
    return null;
  }

  const fetchMessage = async (): Promise<WhatsAppMessage | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Primero determinar el template a usar si es 'auto'
      let templateKey = messageType;

      if (messageType === 'auto') {
        const { data: autoTemplate, error: templateError } = await supabase.rpc(
          'get_customer_whatsapp_template',
          { p_customer_id: customerId }
        );

        if (templateError) {
          console.error('Error getting template:', templateError);
          // Fallback a mensaje genérico
          templateKey = 'reminder_preventive';
        } else {
          templateKey = autoTemplate || 'reminder_preventive';
        }
      }

      // Generar el mensaje
      const { data, error: msgError } = await supabase.rpc(
        'generate_whatsapp_message',
        {
          p_customer_id: customerId,
          p_template_key: templateKey
        }
      );

      if (msgError) throw msgError;

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as WhatsAppMessage;
    } catch (err: any) {
      console.error('Error generating message:', err);
      setError(err.message || 'Error al generar mensaje');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = async () => {
    if (showPreview) {
      // Mostrar preview primero
      const data = await fetchMessage();
      if (data) {
        setMessageData(data);
        setIsPreviewOpen(true);
      }
    } else {
      // Enviar directamente
      const data = await fetchMessage();
      if (data?.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank');
      }
    }
  };

  const handleSend = () => {
    if (messageData?.whatsapp_url) {
      window.open(messageData.whatsapp_url, '_blank');
      setIsPreviewOpen(false);
    }
  };

  const getTemplateLabel = (template: string): string => {
    const labels: Record<string, string> = {
      'reminder_preventive': 'Recordatorio preventivo',
      'reminder_due': 'Cliente por contactar',
      'reminder_overdue': 'Cliente atrasado',
      'post_sale': 'Post-venta',
      'first_purchase': 'Primera compra',
      'prospect': 'Prospecto',
    };
    return labels[template] || template;
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isLoading}
        className={`${className} bg-green-600 hover:bg-green-700 text-white`}
        title={error || `WhatsApp a ${customerName}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        {showLabel && <span className="ml-2">WhatsApp</span>}
      </Button>

      {/* Dialog de preview */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Mensaje para {customerName}
            </DialogTitle>
            <DialogDescription>
              {messageData && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {getTemplateLabel(messageData.template_used)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {messageData && (
            <div className="space-y-4">
              {/* Preview del mensaje */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {messageData.message}
                </p>
              </div>

              {/* Info adicional */}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>📱 {messageData.phone}</span>
                {messageData.days_since_purchase > 0 && (
                  <span>📅 Última compra: hace {messageData.days_since_purchase} días</span>
                )}
              </div>

              {/* Acciones */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSend}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar por WhatsApp
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm p-3 bg-red-50 rounded">
              {error}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
