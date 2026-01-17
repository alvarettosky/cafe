'use client';

import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AdvancedKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function AdvancedKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: AdvancedKPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:bg-white/10">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-white/60">{title}</p>
              <p className="text-3xl font-bold text-white">{value}</p>
              {subtitle && (
                <p className="text-sm text-white/40">{subtitle}</p>
              )}
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <Icon className="h-6 w-6 text-white" />
            </div>
          </div>

          {trend && (
            <div className="mt-4 flex items-center gap-1">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-sm text-white/40">vs last period</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
