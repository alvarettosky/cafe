"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Save,
  Loader2,
  Calendar,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  delivery_days: string[];
  color: string;
  sort_order: number;
  is_active: boolean;
  customer_count?: number;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miercoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sabado" },
  { value: "sunday", label: "Domingo" },
];

const COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#EC4899", // pink
];

export function DeliveryZonesManager() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDays, setFormDays] = useState<string[]>([]);
  const [formColor, setFormColor] = useState(COLORS[0]);
  const [formIsActive, setFormIsActive] = useState(true);

  const fetchZones = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get zones with customer count
      const { data, error } = await supabase
        .from("delivery_zones")
        .select(`
          *,
          customers:customers(count)
        `)
        .order("sort_order");

      if (error) throw error;

      const zonesWithCount = (data || []).map((zone: {
        id: string;
        name: string;
        description: string | null;
        delivery_days: string[];
        color: string;
        sort_order: number;
        is_active: boolean;
        customers: { count: number }[];
      }) => ({
        ...zone,
        customer_count: zone.customers?.[0]?.count || 0,
      }));

      setZones(zonesWithCount);
    } catch (err) {
      console.error("Error fetching zones:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const openCreateModal = () => {
    setEditingZone(null);
    setFormName("");
    setFormDescription("");
    setFormDays([]);
    setFormColor(COLORS[zones.length % COLORS.length]);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormName(zone.name);
    setFormDescription(zone.description || "");
    setFormDays(zone.delivery_days || []);
    setFormColor(zone.color || COLORS[0]);
    setFormIsActive(zone.is_active);
    setIsModalOpen(true);
  };

  const handleSaveZone = async () => {
    if (!formName.trim()) return;

    setSaving(true);
    try {
      const zoneData = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        delivery_days: formDays,
        color: formColor,
        is_active: formIsActive,
        sort_order: editingZone?.sort_order ?? zones.length,
      };

      if (editingZone) {
        const { error } = await supabase
          .from("delivery_zones")
          .update(zoneData)
          .eq("id", editingZone.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("delivery_zones")
          .insert(zoneData);

        if (error) throw error;
      }

      await fetchZones();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving zone:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Esta seguro de eliminar esta zona? Los clientes asignados quedaran sin zona.")) return;

    try {
      const { error } = await supabase
        .from("delivery_zones")
        .delete()
        .eq("id", zoneId);

      if (error) throw error;
      await fetchZones();
    } catch (err) {
      console.error("Error deleting zone:", err);
    }
  };

  const toggleDay = (day: string) => {
    setFormDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  const getDaysLabel = (days: string[]) => {
    if (!days || days.length === 0) return "Sin dias asignados";
    const dayMap: Record<string, string> = {
      monday: "Lun",
      tuesday: "Mar",
      wednesday: "Mie",
      thursday: "Jue",
      friday: "Vie",
      saturday: "Sab",
      sunday: "Dom",
    };
    return days.map((d) => dayMap[d] || d).join(", ");
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Zonas de Entrega</h2>
          <p className="text-sm text-gray-500">
            Organiza rutas de entrega por zona geografica
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Zona
        </Button>
      </div>

      {/* Zones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((zone, index) => (
          <motion.div
            key={zone.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={!zone.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: zone.color }}
                    />
                    {zone.name}
                  </span>
                  {!zone.is_active && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      Inactiva
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">
                  {zone.description || "Sin descripcion"}
                </p>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>{getDaysLabel(zone.delivery_days)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Users className="h-4 w-4" />
                  <span>{zone.customer_count || 0} clientes</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(zone)}
                    className="flex-1"
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteZone(zone.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {zones.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay zonas de entrega configuradas</p>
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primera zona
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingZone ? "Editar Zona" : "Nueva Zona de Entrega"}
            </DialogTitle>
            <DialogDescription>
              Configure los detalles de la zona de entrega
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Ej: Zona Norte"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripcion
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                rows={2}
                placeholder="Barrios o areas incluidas..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dias de Entrega
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      formDays.includes(day.value)
                        ? "bg-amber-100 border-amber-300 text-amber-800"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      formColor === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="zoneIsActive"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="h-4 w-4 text-amber-600 rounded border-gray-300"
              />
              <label htmlFor="zoneIsActive" className="text-sm text-gray-700">
                Zona activa
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveZone} disabled={saving || !formName.trim()}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
