"use client";

import { useState } from "react";
import {
  User,
  Building2,
  Store,
  Coffee,
  Settings,
} from "lucide-react";

export type CustomerType = "retail" | "wholesale_small" | "wholesale_large" | "cafe" | "custom";

interface CustomerTypeSelectProps {
  value: CustomerType;
  onChange: (value: CustomerType) => void;
  disabled?: boolean;
}

const customerTypes: { value: CustomerType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "retail",
    label: "Consumidor Final",
    description: "Precio base",
    icon: <User className="h-4 w-4" />,
  },
  {
    value: "wholesale_small",
    label: "Mayorista Pequeño",
    description: "5-10% descuento",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "wholesale_large",
    label: "Mayorista Grande",
    description: "10-20% descuento",
    icon: <Store className="h-4 w-4" />,
  },
  {
    value: "cafe",
    label: "Cafetería",
    description: "Precios especiales",
    icon: <Coffee className="h-4 w-4" />,
  },
  {
    value: "custom",
    label: "Personalizado",
    description: "Lista de precios custom",
    icon: <Settings className="h-4 w-4" />,
  },
];

export function CustomerTypeSelect({
  value,
  onChange,
  disabled = false,
}: CustomerTypeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedType = customerTypes.find((t) => t.value === value) || customerTypes[0];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Tipo de Cliente
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            {selectedType.icon}
            <span className="font-medium">{selectedType.label}</span>
            <span className="text-xs text-gray-500">({selectedType.description})</span>
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
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
            {customerTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => {
                  onChange(type.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${
                  type.value === value ? "bg-amber-50" : ""
                }`}
              >
                <div className={type.value === value ? "text-amber-600" : "text-gray-400"}>
                  {type.icon}
                </div>
                <div className="text-left">
                  <p className={`font-medium ${type.value === value ? "text-amber-700" : "text-gray-800"}`}>
                    {type.label}
                  </p>
                  <p className="text-xs text-gray-500">{type.description}</p>
                </div>
                {type.value === value && (
                  <svg className="h-5 w-5 text-amber-600 ml-auto" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
