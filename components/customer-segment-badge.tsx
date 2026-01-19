"use client";

import { useState, useEffect } from "react";
import {
  Crown,
  Heart,
  Sparkles,
  UserPlus,
  AlertTriangle,
  Ghost,
  User,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export type CustomerSegment =
  | "champion"
  | "loyal"
  | "potential"
  | "new"
  | "at_risk"
  | "lost"
  | "prospect";

interface SegmentConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  description: string;
}

const SEGMENT_CONFIG: Record<CustomerSegment, SegmentConfig> = {
  champion: {
    label: "Champion",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-300",
    icon: Crown,
    description: "Cliente frecuente y de alto valor",
  },
  loyal: {
    label: "Leal",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    icon: Heart,
    description: "Compra regularmente dentro de su ciclo",
  },
  potential: {
    label: "Potencial",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
    icon: Sparkles,
    description: "Pocas compras pero reciente, potencial de crecimiento",
  },
  new: {
    label: "Nuevo",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    icon: UserPlus,
    description: "Primera compra reciente",
  },
  at_risk: {
    label: "En Riesgo",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
    icon: AlertTriangle,
    description: "Pasó su fecha de recurrencia, contactar pronto",
  },
  lost: {
    label: "Perdido",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    icon: Ghost,
    description: "Mucho tiempo sin comprar",
  },
  prospect: {
    label: "Prospecto",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    icon: User,
    description: "Registrado pero sin compras",
  },
};

interface CustomerSegmentBadgeProps {
  segment?: CustomerSegment;
  customerId?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function CustomerSegmentBadge({
  segment: propSegment,
  customerId,
  size = "sm",
  showIcon = true,
  showTooltip = true,
  className = "",
}: CustomerSegmentBadgeProps) {
  const [segment, setSegment] = useState<CustomerSegment | null>(propSegment || null);
  const [isLoading, setIsLoading] = useState(false);

  // Si se proporciona customerId pero no segment, cargar desde la vista
  useEffect(() => {
    if (customerId && !propSegment) {
      fetchSegment();
    }
  }, [customerId, propSegment]);

  const fetchSegment = async () => {
    if (!customerId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_segments")
        .select("segment")
        .eq("id", customerId)
        .single();

      if (error) throw error;

      if (data?.segment) {
        setSegment(data.segment as CustomerSegment);
      }
    } catch (err) {
      console.error("Error fetching segment:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Si está cargando
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }

  // Si no hay segmento
  if (!segment) {
    return null;
  }

  const config = SEGMENT_CONFIG[segment];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.bgColor} ${config.color} ${config.borderColor} border
        ${sizeClasses[size]}
        ${className}
      `}
      title={showTooltip ? config.description : undefined}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );
}

// Componente para mostrar estadísticas de segmentos
interface SegmentStatsProps {
  className?: string;
}

export function CustomerSegmentStats({ className = "" }: SegmentStatsProps) {
  const [stats, setStats] = useState<
    Array<{ segment: CustomerSegment; count: number; total_value: number; avg_value: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc("get_customer_segment_stats");

      if (error) throw error;

      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching segment stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const totalCustomers = stats.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Segmentación de Clientes</span>
        <span className="font-medium">{totalCustomers} clientes</span>
      </div>

      <div className="space-y-2">
        {stats.map((stat) => {
          const config = SEGMENT_CONFIG[stat.segment];
          const Icon = config.icon;
          const percentage = totalCustomers > 0 ? (stat.count / totalCustomers) * 100 : 0;

          return (
            <div
              key={stat.segment}
              className={`flex items-center gap-3 p-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}
            >
              <Icon className={`h-5 w-5 ${config.color}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${config.color}`}>{config.label}</span>
                  <span className="text-sm font-bold">{stat.count}</span>
                </div>
                {/* Barra de progreso */}
                <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${config.color.replace("text-", "bg-").replace("-700", "-500")}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
