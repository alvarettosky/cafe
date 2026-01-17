"use client";

import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DateRange = {
  start: Date;
  end: Date;
};

type DateRangePreset = "hoy" | "esta-semana" | "este-mes" | "este-trimestre" | "este-año";

interface DateRangeSelectorProps {
  onPresetChange: (preset: DateRangePreset) => void;
  activePreset?: DateRangePreset;
}

const getDateRange = (preset: DateRangePreset): DateRange => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case "hoy":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "esta-semana":
      // Start from Monday (1) of current week
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday
      start.setDate(now.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case "este-mes":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0); // Last day of current month
      end.setHours(23, 59, 59, 999);
      break;

    case "este-trimestre":
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start.setMonth(currentQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(currentQuarter * 3 + 3, 0); // Last day of quarter
      end.setHours(23, 59, 59, 999);
      break;

    case "este-año":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
};

export const DateRangeSelector = ({
  onPresetChange,
  activePreset = "este-mes",
}: DateRangeSelectorProps) => {
  const presets: { label: string; value: DateRangePreset }[] = [
    { label: "Hoy", value: "hoy" },
    { label: "Esta Semana", value: "esta-semana" },
    { label: "Este Mes", value: "este-mes" },
    { label: "Este Trimestre", value: "este-trimestre" },
    { label: "Este Año", value: "este-año" },
  ];

  const handlePresetClick = (preset: DateRangePreset) => {
    onPresetChange(preset);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.value}
          variant={activePreset === preset.value ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetClick(preset.value)}
          className={cn(
            "gap-2",
            activePreset === preset.value && "shadow-md"
          )}
        >
          <Calendar className="h-4 w-4" />
          {preset.label}
        </Button>
      ))}
    </div>
  );
};
