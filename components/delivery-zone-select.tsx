"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MapPin, Loader2 } from "lucide-react";

interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  delivery_days: string[] | null;
  color: string | null;
  is_active: boolean;
}

interface DeliveryZoneSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function DeliveryZoneSelect({
  value,
  onChange,
  disabled = false,
}: DeliveryZoneSelectProps) {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchZones = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("delivery_zones")
          .select("*")
          .eq("is_active", true)
          .order("sort_order");

        if (error) throw error;
        setZones(data || []);
      } catch (err) {
        console.error("Error fetching zones:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchZones();
  }, []);

  const selectedZone = zones.find((z) => z.id === value);

  const getDaysLabel = (days: string[] | null) => {
    if (!days || days.length === 0) return "";
    const dayMap: Record<string, string> = {
      monday: "Lun",
      tuesday: "Mar",
      wednesday: "Mié",
      thursday: "Jue",
      friday: "Vie",
      saturday: "Sáb",
      sunday: "Dom",
    };
    return days.map((d) => dayMap[d] || d).join(", ");
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Zona de Entrega
        </label>
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="text-gray-500">Cargando zonas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Zona de Entrega
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            {selectedZone ? (
              <>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedZone.color || "#9CA3AF" }}
                />
                <span className="font-medium">{selectedZone.name}</span>
                {selectedZone.delivery_days && (
                  <span className="text-xs text-gray-500">
                    ({getDaysLabel(selectedZone.delivery_days)})
                  </span>
                )}
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Sin zona asignada</span>
              </>
            )}
          </div>
          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
            {/* Option to clear selection */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                !value ? "bg-gray-50" : ""
              }`}
            >
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-gray-500">Sin zona asignada</span>
            </button>

            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() => {
                  onChange(zone.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                  zone.id === value ? "bg-amber-50" : ""
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: zone.color || "#9CA3AF" }}
                />
                <div className="text-left flex-1">
                  <p className={`font-medium ${zone.id === value ? "text-amber-700" : "text-gray-800"}`}>
                    {zone.name}
                  </p>
                  {zone.delivery_days && (
                    <p className="text-xs text-gray-500">
                      Entregas: {getDaysLabel(zone.delivery_days)}
                    </p>
                  )}
                </div>
                {zone.id === value && (
                  <svg className="h-5 w-5 text-amber-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}

            {zones.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                No hay zonas de entrega configuradas
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
