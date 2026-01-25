'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Phone, Mail, Calendar, Save, TrendingUp, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { RecurrenceInput } from './recurrence-input';
import { CustomerTypeSelect, CustomerType } from './customer-type-select';
import { DeliveryZoneSelect } from './delivery-zone-select';
import { supabase } from '@/lib/supabase';
import type { CustomerWithRecurrence } from '@/types/customer-recurrence';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string | null;
  onCustomerUpdated?: () => void;
}

export function CustomerModal({
  isOpen,
  onClose,
  customerId,
  onCustomerUpdated,
}: CustomerModalProps) {
  const [customer, setCustomer] = useState<CustomerWithRecurrence | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [lastPurchaseDate, setLastPurchaseDate] = useState('');
  const [recurrenceDays, setRecurrenceDays] = useState<number | null>(null);
  const [suggestedRecurrence, setSuggestedRecurrence] = useState<number | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType>('retail');
  const [deliveryZoneId, setDeliveryZoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomerData = useCallback(async () => {
    if (!customerId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (fetchError) throw fetchError;

      setCustomer(data);
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setAddress(data.address || '');
      setLastPurchaseDate(data.last_purchase_date || '');
      setRecurrenceDays(data.typical_recurrence_days);
      setCustomerType(data.customer_type || 'retail');
      setDeliveryZoneId(data.delivery_zone_id || null);
    } catch (err) {
      console.error('Error fetching customer:', err);
      setError('Error al cargar datos del cliente');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const fetchSuggestedRecurrence = useCallback(async () => {
    if (!customerId) return;

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'calculate_customer_recurrence',
        { p_customer_id: customerId }
      );

      if (rpcError) throw rpcError;

      setSuggestedRecurrence(data);
    } catch (err) {
      console.error('Error calculating suggested recurrence:', err);
    }
  }, [customerId]);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerData();
      fetchSuggestedRecurrence();
    }
  }, [isOpen, customerId, fetchCustomerData, fetchSuggestedRecurrence]);

  const handleSave = async () => {
    if (!customerId) return;

    if (!fullName.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Format last purchase date properly for PostgreSQL
      let formattedDate = null;
      if (lastPurchaseDate) {
        try {
          formattedDate = new Date(lastPurchaseDate).toISOString();
        } catch (dateError) {
          console.error('Error formatting date:', dateError);
          formattedDate = null;
        }
      }

      // Prepare update data
      const updateData = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        last_purchase_date: formattedDate,
        typical_recurrence_days: recurrenceDays,
        customer_type: customerType,
        delivery_zone_id: deliveryZoneId,
      };

      // Update customer data
      const { data: updatedData, error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customerId)
        .select();

      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw updateError;
      }

      if (!updatedData || updatedData.length === 0) {
        throw new Error('No se pudo actualizar el cliente. Verifica los permisos.');
      }

      onCustomerUpdated?.();
      onClose();
    } catch (err: unknown) {
      console.error('Error updating customer:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin compras';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!customerId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información del Cliente
          </DialogTitle>
          <DialogDescription>
            Gestiona la información y recurrencia de compra del cliente
          </DialogDescription>
          <DialogClose />
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-500">
            Cargando información del cliente...
          </div>
        ) : error ? (
          <div className="py-4 text-center text-red-600">{error}</div>
        ) : customer ? (
          <>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Customer Info */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Nombre completo *
                    </div>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del cliente"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Teléfono
                      </div>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="3001234567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="cliente@ejemplo.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Dirección
                    </div>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección del cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Fecha de última compra
                    </div>
                  </label>
                  <input
                    type="datetime-local"
                    value={lastPurchaseDate ? new Date(lastPurchaseDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setLastPurchaseDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Normalmente se actualiza automáticamente con las ventas
                  </p>
                </div>

                {/* Customer Type and Delivery Zone */}
                <div className="grid grid-cols-2 gap-4">
                  <CustomerTypeSelect
                    value={customerType}
                    onChange={setCustomerType}
                  />
                  <DeliveryZoneSelect
                    value={deliveryZoneId}
                    onChange={setDeliveryZoneId}
                  />
                </div>
              </div>

              {/* Recurrence Input */}
              <div className="border-t pt-6">
                <RecurrenceInput
                  value={recurrenceDays}
                  onChange={setRecurrenceDays}
                  suggestedValue={suggestedRecurrence}
                  showSuggestion={suggestedRecurrence !== null}
                  helperText="Configura cada cuántos días este cliente suele hacer compras"
                />
              </div>

              {/* Purchase History Info */}
              {customer.last_purchase_date && recurrenceDays && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">
                        Próxima compra esperada
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Aproximadamente{' '}
                        {formatDate(
                          new Date(
                            new Date(customer.last_purchase_date).getTime() +
                              recurrenceDays * 24 * 60 * 60 * 1000
                          ).toISOString()
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions - Fixed at bottom */}
            <div className="flex justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>Guardando...</>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar cambios
                  </>
                )}
              </button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
