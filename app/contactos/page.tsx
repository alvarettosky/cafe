'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, Calendar, AlertTriangle, Clock, CheckCircle, Users, Filter, UserPlus, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { SmartWhatsAppButton } from '@/components/smart-whatsapp-button';
import { RepeatSaleButton } from '@/components/repeat-sale-button';
import type { CustomerToContact } from '@/types/customer-recurrence';

interface Prospect {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  days_since_registered: number;
}

export default function ContactosPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<CustomerToContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<CustomerToContact[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProspects, setLoadingProspects] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [daysThreshold, setDaysThreshold] = useState(7);

  const fetchContacts = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_customers_to_contact', {
        p_days_threshold: daysThreshold,
      });

      if (error) throw error;

      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [daysThreshold]);

  const fetchProspects = useCallback(async () => {
    setLoadingProspects(true);

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, phone, email, created_at')
        .is('last_purchase_date', null)
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const prospectsWithDays = (data || []).map((p) => ({
        ...p,
        days_since_registered: Math.floor(
          (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

      setProspects(prospectsWithDays);
    } catch (error) {
      console.error('Error fetching prospects:', error);
    } finally {
      setLoadingProspects(false);
    }
  }, []);

  const filterContacts = useCallback(() => {
    if (urgencyFilter === 'all') {
      setFilteredContacts(contacts);
      return;
    }

    const filtered = contacts.filter((contact) => contact.urgency === urgencyFilter);
    setFilteredContacts(filtered);
  }, [urgencyFilter, contacts]);

  useEffect(() => {
    fetchContacts();
    fetchProspects();
  }, [fetchContacts, fetchProspects]);

  useEffect(() => {
    filterContacts();
  }, [filterContacts]);

  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return {
          color: 'bg-red-100 border-red-300 text-red-800',
          iconColor: 'text-red-600',
          icon: AlertTriangle,
          label: 'Urgente',
          badge: 'bg-red-500 text-white',
        };
      case 'medium':
        return {
          color: 'bg-orange-100 border-orange-300 text-orange-800',
          iconColor: 'text-orange-600',
          icon: Clock,
          label: 'Pronto',
          badge: 'bg-orange-500 text-white',
        };
      case 'low':
        return {
          color: 'bg-yellow-100 border-yellow-300 text-yellow-800',
          iconColor: 'text-yellow-600',
          icon: Calendar,
          label: 'Planificado',
          badge: 'bg-yellow-500 text-white',
        };
      default:
        return {
          color: 'bg-gray-100 border-gray-300 text-gray-800',
          iconColor: 'text-gray-600',
          icon: Users,
          label: 'Sin datos',
          badge: 'bg-gray-500 text-white',
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePhoneCall = (contact: CustomerToContact) => {
    if (!contact.phone) return;
    window.location.href = `tel:${contact.phone}`;
  };

  const handlePhoneCallProspect = (prospect: Prospect) => {
    if (!prospect.phone) return;
    window.location.href = `tel:${prospect.phone}`;
  };

  const stats = {
    total: contacts.length,
    high: contacts.filter((c) => c.urgency === 'high').length,
    medium: contacts.filter((c) => c.urgency === 'medium').length,
    low: contacts.filter((c) => c.urgency === 'low').length,
    unknown: contacts.filter((c) => c.urgency === 'unknown').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/')}
              className="bg-white hover:bg-gray-100"
            >
              <Home className="h-4 w-4" />
            </Button>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Phone className="h-10 w-10 text-purple-600" />
              Lista de Contacto
            </h1>
          </div>
          <p className="text-gray-600">
            Clientes que necesitan ser contactados según su recurrencia de compra
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
        >
          <div
            className={`rounded-lg p-4 shadow-sm border-2 cursor-pointer transition-all ${
              urgencyFilter === 'all'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-purple-300'
            }`}
            onClick={() => setUrgencyFilter('all')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg p-4 shadow-sm border-2 cursor-pointer transition-all ${
              urgencyFilter === 'high'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 bg-white hover:border-red-300'
            }`}
            onClick={() => setUrgencyFilter('high')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Urgente</p>
                <p className="text-2xl font-bold text-gray-900">{stats.high}</p>
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg p-4 shadow-sm border-2 cursor-pointer transition-all ${
              urgencyFilter === 'medium'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-orange-300'
            }`}
            onClick={() => setUrgencyFilter('medium')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pronto</p>
                <p className="text-2xl font-bold text-gray-900">{stats.medium}</p>
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg p-4 shadow-sm border-2 cursor-pointer transition-all ${
              urgencyFilter === 'low'
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-gray-200 bg-white hover:border-yellow-300'
            }`}
            onClick={() => setUrgencyFilter('low')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Planificado</p>
                <p className="text-2xl font-bold text-gray-900">{stats.low}</p>
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg p-4 shadow-sm border-2 cursor-pointer transition-all ${
              urgencyFilter === 'unknown'
                ? 'border-gray-500 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
            onClick={() => setUrgencyFilter('unknown')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Sin datos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unknown}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 bg-white rounded-lg p-4 shadow-sm border border-gray-200"
        >
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">
              Umbral de urgencia (días tarde):
            </label>
            <select
              value={daysThreshold}
              onChange={(e) => setDaysThreshold(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={3}>3 días</option>
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
            </select>
          </div>
        </motion.div>

        {/* Contact List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              Cargando lista de contactos...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                ¡Todo al día!
              </p>
              <p className="text-gray-600">
                {urgencyFilter === 'all'
                  ? 'No hay clientes que necesiten contacto en este momento'
                  : `No hay clientes con urgencia "${urgencyFilter}"`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => {
                const config = getUrgencyConfig(contact.urgency);
                const Icon = config.icon;

                return (
                  <motion.div
                    key={contact.customer_id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-lg p-5 shadow-sm border-2 ${config.color}`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${config.badge}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{contact.full_name}</h3>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${config.badge}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>Última compra: {formatDate(contact.last_purchase_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4" />
                        <span>{contact.days_since_last_purchase} días sin comprar</span>
                      </div>
                      {contact.typical_recurrence_days && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4" />
                          <span>Compra cada {contact.typical_recurrence_days} días</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {contact.phone && (
                        <>
                          <SmartWhatsAppButton
                            customerId={contact.customer_id}
                            customerName={contact.full_name}
                            phone={contact.phone}
                            variant="default"
                            size="sm"
                            showLabel={true}
                            className="flex-1"
                          />
                          <button
                            onClick={() => handlePhoneCall(contact)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            title="Llamar"
                          >
                            <Phone className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <RepeatSaleButton
                        customerId={contact.customer_id}
                        customerName={contact.full_name}
                        onSaleCreated={fetchContacts}
                        variant="outline"
                        size="sm"
                        showLabel={false}
                      />
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                          title="Enviar email"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Prospects Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Prospectos</h2>
              <p className="text-gray-600">Clientes potenciales que aún no han comprado</p>
            </div>
            <span className="ml-auto bg-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {prospects.length}
            </span>
          </div>

          {loadingProspects ? (
            <div className="py-8 text-center text-gray-500">
              Cargando prospectos...
            </div>
          ) : prospects.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900 mb-1">
                Sin prospectos pendientes
              </p>
              <p className="text-gray-600">
                Todos los clientes registrados ya han realizado al menos una compra
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prospects.map((prospect) => (
                <motion.div
                  key={prospect.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-lg p-5 shadow-sm border-2 bg-blue-50 border-blue-200 text-blue-900"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-500 text-white">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{prospect.full_name}</h3>
                        <span className="text-xs font-medium px-2 py-1 rounded bg-blue-500 text-white">
                          Prospecto
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>Registrado hace {prospect.days_since_registered} días</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700 font-medium">Sin compras registradas</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {prospect.phone && (
                      <>
                        <SmartWhatsAppButton
                          customerId={prospect.id}
                          customerName={prospect.full_name}
                          phone={prospect.phone}
                          messageType="prospect"
                          variant="default"
                          size="sm"
                          showLabel={true}
                          className="flex-1"
                        />
                        <button
                          onClick={() => handlePhoneCallProspect(prospect)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          title="Llamar"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {prospect.email && (
                      <a
                        href={`mailto:${prospect.email}`}
                        className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                        title="Enviar email"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                    {!prospect.phone && !prospect.email && (
                      <span className="text-sm text-gray-500 italic">Sin datos de contacto</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
