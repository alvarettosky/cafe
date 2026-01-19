'use client';

import { useState, useMemo } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';

interface RecurrenceInputProps {
  value: number | null;
  onChange: (days: number | null) => void;
  suggestedValue?: number | null;
  label?: string;
  helperText?: string;
  showSuggestion?: boolean;
}

export function RecurrenceInput({
  value,
  onChange,
  suggestedValue = null,
  label = 'Recurrencia típica (días)',
  helperText = '¿Cada cuántos días suele comprar este cliente?',
  showSuggestion = false,
}: RecurrenceInputProps) {
  // Use local state only for the current editing session
  const [localInput, setLocalInput] = useState<string | null>(null);

  // Derive display value from prop or local input
  const inputValue = useMemo(() => {
    if (localInput !== null) return localInput;
    return value?.toString() || '';
  }, [localInput, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalInput(newValue);

    if (newValue === '') {
      onChange(null);
    } else {
      const parsed = parseInt(newValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        onChange(parsed);
      }
    }
  };

  const handleUseSuggestion = () => {
    if (suggestedValue !== null) {
      onChange(suggestedValue);
      setLocalInput(null); // Reset local input so it derives from value
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {label}
        </div>
      </label>

      {helperText && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min="1"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Ej: 15 días"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            días
          </span>
        </div>

        {showSuggestion && suggestedValue !== null && (
          <button
            type="button"
            onClick={handleUseSuggestion}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-2 whitespace-nowrap"
            title="Usar valor sugerido basado en últimas 3 compras"
          >
            <TrendingUp className="h-4 w-4" />
            Usar {suggestedValue}d
          </button>
        )}
      </div>

      {showSuggestion && suggestedValue !== null && (
        <p className="text-xs text-blue-600 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Sugerencia: {suggestedValue} días (basado en últimas compras)
        </p>
      )}

      {value !== null && value > 0 && (
        <p className="text-xs text-gray-600">
          Próxima compra esperada: aproximadamente cada {value} días
        </p>
      )}
    </div>
  );
}
