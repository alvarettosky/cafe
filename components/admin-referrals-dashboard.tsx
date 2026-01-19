"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  Users,
  Gift,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  Search,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReferralStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_rewards_given: number;
  conversion_rate: number;
  this_month_referrals: number;
}

interface Referral {
  id: string;
  code: string;
  status: string;
  referrer_id: string;
  referrer_name: string;
  referred_phone: string | null;
  referred_customer_name: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  referrer_reward_percent: number;
  referred_reward_percent: number;
  reward_claimed: boolean;
}

export function AdminReferralsDashboard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch stats
      const { data: statsData, error: statsError } = await supabase.rpc(
        "get_referral_stats"
      );

      if (statsError) throw statsError;
      setStats(statsData);

      // Fetch referrals with customer names
      const { data: referralsData, error: referralsError } = await supabase
        .from("referrals")
        .select(
          `
          *,
          referrer:customers!referrals_referrer_id_fkey(full_name),
          referred:customers!referrals_referred_customer_id_fkey(full_name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (referralsError) throw referralsError;

      const formattedReferrals = (referralsData || []).map(
        (r: {
          id: string;
          code: string;
          status: string;
          referrer_id: string;
          referrer: { full_name: string } | null;
          referred: { full_name: string } | null;
          referred_phone: string | null;
          created_at: string;
          expires_at: string;
          completed_at: string | null;
          referrer_reward_percent: number;
          referred_reward_percent: number;
          reward_claimed: boolean;
        }) => ({
          id: r.id,
          code: r.code,
          status: r.status,
          referrer_id: r.referrer_id,
          referrer_name: r.referrer?.full_name || "Desconocido",
          referred_phone: r.referred_phone,
          referred_customer_name: r.referred?.full_name || null,
          created_at: r.created_at,
          expires_at: r.expires_at,
          completed_at: r.completed_at,
          referrer_reward_percent: r.referrer_reward_percent,
          referred_reward_percent: r.referred_reward_percent,
          reward_claimed: r.reward_claimed,
        })
      );

      setReferrals(formattedReferrals);
    } catch (err) {
      console.error("Error fetching referral data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredReferrals = referrals.filter((r) => {
    const matchesSearch =
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referrer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.referred_customer_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> =
      {
        pending: {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          label: "Pendiente",
        },
        registered: {
          bg: "bg-blue-100",
          text: "text-blue-800",
          label: "Registrado",
        },
        completed: {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Completado",
        },
        expired: { bg: "bg-gray-100", text: "text-gray-800", label: "Expirado" },
      };
    const style = styles[status] || styles.pending;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
      >
        {style.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{stats.total_referrals}</p>
                <p className="text-xs text-gray-500">Total Referidos</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold">{stats.completed_referrals}</p>
                <p className="text-xs text-gray-500">Completados</p>
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
                <Clock className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
                <p className="text-2xl font-bold">{stats.pending_referrals}</p>
                <p className="text-xs text-gray-500">Pendientes</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card>
              <CardContent className="p-4 text-center">
                <Gift className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                <p className="text-2xl font-bold">{stats.total_rewards_given}</p>
                <p className="text-xs text-gray-500">Recompensas</p>
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
                <TrendingUp className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                <p className="text-2xl font-bold">
                  {stats.conversion_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">Conversion</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 mx-auto text-indigo-500 mb-2" />
                <p className="text-2xl font-bold">
                  {stats.this_month_referrals}
                </p>
                <p className="text-xs text-gray-500">Este Mes</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Referidos
            </span>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por codigo o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="registered">Registrado</option>
              <option value="completed">Completado</option>
              <option value="expired">Expirado</option>
            </select>
          </div>

          {/* Referrals Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Codigo
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Referidor
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Referido
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Recompensas
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Expira
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReferrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-amber-700">
                        {referral.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">{referral.referrer_name}</td>
                    <td className="px-4 py-3">
                      {referral.referred_customer_name || (
                        <span className="text-gray-400">
                          {referral.referred_phone || "Sin usar"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(referral.status)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-green-600">
                        +{referral.referrer_reward_percent}%
                      </span>
                      {" / "}
                      <span className="text-blue-600">
                        +{referral.referred_reward_percent}%
                      </span>
                      {referral.reward_claimed && (
                        <CheckCircle className="inline h-4 w-4 ml-1 text-green-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(referral.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(referral.expires_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {filteredReferrals.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      <Eye className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      No se encontraron referidos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
