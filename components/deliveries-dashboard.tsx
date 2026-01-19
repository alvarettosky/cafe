"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  Truck,
  Calendar,
  MapPin,
  Phone,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DeliveryItem {
  product_name: string;
  quantity: number;
  unit: string;
}

interface Delivery {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  zone_id: string | null;
  zone_name: string | null;
  zone_color: string | null;
  scheduled_date: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  items: DeliveryItem[];
  completed_at: string | null;
}

interface ZoneGroup {
  zone_id: string | null;
  zone_name: string;
  zone_color: string;
  deliveries: Delivery[];
}

export function DeliveriesDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDeliveries = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split("T")[0];

      const { data, error } = await supabase.rpc("get_deliveries_for_date", {
        p_date: dateStr,
      });

      if (error) throw error;
      setDeliveries(data || []);
    } catch (err) {
      console.error("Error fetching deliveries:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const updateDeliveryStatus = async (
    deliveryId: string,
    newStatus: Delivery["status"]
  ) => {
    try {
      const updateData: { status: string; completed_at?: string | null } = {
        status: newStatus,
      };

      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from("deliveries")
        .update(updateData)
        .eq("id", deliveryId);

      if (error) throw error;
      await fetchDeliveries();
    } catch (err) {
      console.error("Error updating delivery:", err);
    }
  };

  const goToPreviousDay = () => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const goToNextDay = () => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Group deliveries by zone
  const zoneGroups: ZoneGroup[] = deliveries.reduce((groups, delivery) => {
    const zoneId = delivery.zone_id || "no-zone";
    const existingGroup = groups.find((g) => (g.zone_id || "no-zone") === zoneId);

    if (existingGroup) {
      existingGroup.deliveries.push(delivery);
    } else {
      groups.push({
        zone_id: delivery.zone_id,
        zone_name: delivery.zone_name || "Sin Zona",
        zone_color: delivery.zone_color || "#9CA3AF",
        deliveries: [delivery],
      });
    }

    return groups;
  }, [] as ZoneGroup[]);

  const getStatusIcon = (status: Delivery["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Truck className="h-5 w-5 text-blue-500" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusLabel = (status: Delivery["status"]) => {
    const labels: Record<Delivery["status"], string> = {
      pending: "Pendiente",
      in_progress: "En camino",
      completed: "Entregado",
      cancelled: "Cancelado",
    };
    return labels[status];
  };

  // Stats
  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === "pending").length,
    inProgress: deliveries.filter((d) => d.status === "in_progress").length,
    completed: deliveries.filter((d) => d.status === "completed").length,
    cancelled: deliveries.filter((d) => d.status === "cancelled").length,
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
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <p className="font-medium capitalize">{formatDate(selectedDate)}</p>
            {isToday(selectedDate) && (
              <span className="text-xs text-amber-600">Hoy</span>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          {!isToday(selectedDate) && (
            <Button variant="outline" size="sm" onClick={goToToday}>
              <Calendar className="h-4 w-4 mr-2" />
              Hoy
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchDeliveries}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Truck className="h-6 w-6 mx-auto text-gray-500 mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Truck className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{stats.inProgress}</p>
            <p className="text-xs text-gray-500">En camino</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{stats.completed}</p>
            <p className="text-xs text-gray-500">Entregados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 mx-auto text-red-500 mb-2" />
            <p className="text-2xl font-bold">{stats.cancelled}</p>
            <p className="text-xs text-gray-500">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Deliveries by Zone */}
      {zoneGroups.length > 0 ? (
        <div className="space-y-6">
          {zoneGroups.map((group, groupIndex) => (
            <motion.div
              key={group.zone_id || "no-zone"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: group.zone_color }}
                    />
                    {group.zone_name}
                    <span className="text-sm font-normal text-gray-500">
                      ({group.deliveries.length} entregas)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.deliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className={`p-4 rounded-lg border ${
                          delivery.status === "completed"
                            ? "bg-green-50 border-green-200"
                            : delivery.status === "in_progress"
                            ? "bg-blue-50 border-blue-200"
                            : delivery.status === "cancelled"
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(delivery.status)}
                              <span className="font-medium">
                                {delivery.customer_name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {getStatusLabel(delivery.status)}
                              </span>
                            </div>

                            {delivery.customer_address && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                <MapPin className="h-4 w-4" />
                                {delivery.customer_address}
                              </div>
                            )}

                            {delivery.customer_phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                <Phone className="h-4 w-4" />
                                <a
                                  href={`tel:${delivery.customer_phone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {delivery.customer_phone}
                                </a>
                              </div>
                            )}

                            {/* Items */}
                            {delivery.items && delivery.items.length > 0 && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Package className="h-4 w-4" />
                                {delivery.items
                                  .map(
                                    (item) =>
                                      `${item.quantity} ${item.unit} ${item.product_name}`
                                  )
                                  .join(", ")}
                              </div>
                            )}

                            {delivery.notes && (
                              <p className="text-sm text-gray-500 mt-2 italic">
                                Nota: {delivery.notes}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 ml-4">
                            {delivery.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateDeliveryStatus(
                                      delivery.id,
                                      "in_progress"
                                    )
                                  }
                                >
                                  <Truck className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600"
                                  onClick={() =>
                                    updateDeliveryStatus(
                                      delivery.id,
                                      "completed"
                                    )
                                  }
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {delivery.status === "in_progress" && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() =>
                                  updateDeliveryStatus(
                                    delivery.id,
                                    "completed"
                                  )
                                }
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Entregado
                              </Button>
                            )}
                            {(delivery.status === "pending" ||
                              delivery.status === "in_progress") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() =>
                                  updateDeliveryStatus(
                                    delivery.id,
                                    "cancelled"
                                  )
                                }
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay entregas programadas para este dia</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
