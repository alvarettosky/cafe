"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCustomerPortal } from "@/context/customer-portal-context";
import { motion } from "framer-motion";
import {
  Users,
  Share2,
  Gift,
  Clock,
  CheckCircle,
  Copy,
  MessageCircle,
  Loader2,
  Home,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Referral {
  id: string;
  code: string;
  status: string;
  referred_phone: string;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
  reward_claimed: boolean;
  reward_value: number;
}

interface ReferralStats {
  total: number;
  completed: number;
  pending: number;
  this_month: number;
}

interface ReferralData {
  referrals: Referral[] | null;
  stats: ReferralStats;
}

interface GeneratedCode {
  success: boolean;
  code: string;
  referral_link: string;
  referrer_benefit: string;
  referred_benefit: string;
  expires_at: string;
  whatsapp_message: string;
  error?: string;
}

export default function ReferidosPage() {
  const router = useRouter();
  const { customer, isLoading: authLoading, isAuthenticated } = useCustomerPortal();

  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchReferrals = useCallback(async () => {
    if (!customer?.customer_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_referrals', {
        p_customer_id: customer.customer_id
      });

      if (error) throw error;
      setReferralData(data);
    } catch (err) {
      console.error('Error fetching referrals:', err);
    } finally {
      setIsLoading(false);
    }
  }, [customer?.customer_id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/portal/auth');
      return;
    }

    if (customer?.customer_id) {
      fetchReferrals();
    }
  }, [authLoading, isAuthenticated, customer?.customer_id, router, fetchReferrals]);

  const generateCode = async () => {
    if (!customer?.customer_id) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_referral_code', {
        p_customer_id: customer.customer_id
      });

      if (error) throw error;

      if (data.error) {
        alert(data.error);
        return;
      }

      setGeneratedCode(data);
      fetchReferrals();
    } catch (err) {
      console.error('Error generating code:', err);
      alert('Error al generar código');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Error al copiar');
    }
  };

  const shareWhatsApp = (message: string) => {
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
      registered: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Registrado' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completado' },
      expired: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Expirado' },
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Programa de Referidos</h1>
              <p className="text-gray-600">Invita amigos y gana descuentos</p>
            </div>
          </div>
          <Link href="/portal">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Inicio
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        {referralData?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{referralData.stats.total}</p>
                  <p className="text-xs text-gray-500">Total Referidos</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
                  <p className="text-2xl font-bold">{referralData.stats.completed}</p>
                  <p className="text-xs text-gray-500">Completados</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
                  <p className="text-2xl font-bold">{referralData.stats.pending}</p>
                  <p className="text-xs text-gray-500">Pendientes</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardContent className="p-4 text-center">
                  <Gift className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                  <p className="text-2xl font-bold">{referralData.stats.this_month}</p>
                  <p className="text-xs text-gray-500">Este Mes</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Generate Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-amber-600" />
                Genera tu Código de Referido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!generatedCode ? (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">
                    Comparte tu código con amigos y ambos recibirán descuentos.
                  </p>
                  <Button
                    onClick={generateCode}
                    disabled={isGenerating}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Gift className="h-4 w-4 mr-2" />
                    )}
                    Generar Código
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Code Display */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-2">Tu código:</p>
                    <p className="text-3xl font-bold text-amber-700 tracking-wider">
                      {generatedCode.code}
                    </p>
                  </div>

                  {/* Benefits */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="font-medium text-green-800">Tu beneficio:</p>
                      <p className="text-green-600">{generatedCode.referrer_benefit}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="font-medium text-blue-800">Beneficio amigo:</p>
                      <p className="text-blue-600">{generatedCode.referred_benefit}</p>
                    </div>
                  </div>

                  {/* Share Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyToClipboard(generatedCode.referral_link)}
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied ? 'Copiado!' : 'Copiar Link'}
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => shareWhatsApp(generatedCode.whatsapp_message)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    Expira: {new Date(generatedCode.expires_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Referrals List */}
        {referralData?.referrals && referralData.referrals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Historial de Referidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referralData.referrals.map((referral) => (
                    <div
                      key={referral.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-800">
                          Código: {referral.code}
                        </p>
                        <p className="text-xs text-gray-500">
                          {referral.referred_phone || 'Sin usar'} -{' '}
                          {new Date(referral.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(referral.status)}
                        {referral.status === 'completed' && referral.reward_claimed && (
                          <span className="text-xs text-green-600 font-medium">
                            +{referral.reward_value}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Cómo Funciona</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="font-bold text-amber-700">1</span>
                  </div>
                  <p className="font-medium">Genera tu código</p>
                  <p className="text-sm text-gray-500">Crea un código único para compartir</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="font-bold text-amber-700">2</span>
                  </div>
                  <p className="font-medium">Comparte con amigos</p>
                  <p className="text-sm text-gray-500">Envía por WhatsApp o cualquier medio</p>
                </div>
                <div className="text-center p-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="font-bold text-amber-700">3</span>
                  </div>
                  <p className="font-medium">Ambos ganan</p>
                  <p className="text-sm text-gray-500">Descuentos en próximas compras</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
