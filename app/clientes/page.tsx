'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, User, Search, Calendar, Phone, Mail, TrendingUp, Edit, Home } from 'lucide-react';
import { DownloadButton } from '@/components/export';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CustomerModal } from '@/components/customer-modal';
import { NewCustomerModal } from '@/components/new-customer-modal';
import { Button } from '@/components/ui/button';
import { RepeatSaleButton } from '@/components/repeat-sale-button';
import { GeneratePortalAccessButton } from '@/components/generate-portal-access-button';
import { CustomerSegmentBadge, CustomerSegment } from '@/components/customer-segment-badge';
import type { CustomerWithRecurrence } from '@/types/customer-recurrence';

interface CustomerWithSegment extends CustomerWithRecurrence {
  segment?: CustomerSegment;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerWithSegment[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithSegment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filterCustomers = useCallback(() => {
    let filtered = customers;

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (customer) =>
          customer.full_name.toLowerCase().includes(query) ||
          customer.phone?.toLowerCase().includes(query) ||
          customer.email?.toLowerCase().includes(query)
      );
    }

    // Filtrar por segmento
    if (segmentFilter !== 'all') {
      filtered = filtered.filter(
        (customer) => customer.segment === segmentFilter
      );
    }

    setFilteredCustomers(filtered);
  }, [customers, searchQuery, segmentFilter]);

  useEffect(() => {
    filterCustomers();
  }, [filterCustomers]);

  const fetchCustomers = async () => {
    setLoading(true);

    try {
      // Intentar obtener datos con segmentos desde la vista
      const { data: segmentData, error: segmentError } = await supabase
        .from('customer_segments')
        .select('*')
        .order('full_name', { ascending: true });

      if (!segmentError && segmentData) {
        // Si la vista existe, usar esos datos
        setCustomers(segmentData.map(c => ({
          ...c,
          segment: c.segment as CustomerSegment
        })));
      } else {
        // Fallback: obtener datos básicos de customers
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('full_name', { ascending: true });

        if (error) throw error;
        setCustomers(data || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCustomerId(null);
  };

  const handleCustomerUpdated = () => {
    fetchCustomers();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Sin compras';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;

    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push('/')}
                className="bg-white hover:bg-gray-100"
              >
                <Home className="h-4 w-4" />
              </Button>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <Users className="h-10 w-10 text-blue-600" />
                Gestión de Clientes
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <NewCustomerModal onCustomerAdded={fetchCustomers} />
              <DownloadButton
                tables={['customers', 'customer_contacts']}
                format="xlsx"
                label="Exportar Clientes"
                fileName="clientes"
              />
            </div>
          </div>
          <p className="text-gray-600">
            Administra la información de recurrencia de tus clientes
          </p>
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-gray-700"
            >
              <option value="all">Todos los segmentos</option>
              <option value="champion">Champion</option>
              <option value="loyal">Leal</option>
              <option value="potential">Potencial</option>
              <option value="new">Nuevo</option>
              <option value="at_risk">En Riesgo</option>
              <option value="lost">Perdido</option>
              <option value="prospect">Prospecto</option>
            </select>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Clientes</p>
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Con Recurrencia</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customers.filter((c) => c.typical_recurrence_days !== null).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Clientes Activos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customers.filter((c) => c.last_purchase_date !== null).length}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Customers Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              Cargando clientes...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              {searchQuery
                ? 'No se encontraron clientes con esos criterios'
                : 'No hay clientes registrados'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Segmento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Última Compra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recurrencia
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => {
                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{customer.full_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {customer.segment ? (
                            <CustomerSegmentBadge segment={customer.segment} />
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="h-4 w-4" />
                                {customer.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {formatDate(customer.last_purchase_date)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {customer.typical_recurrence_days ? (
                            <span className="text-sm font-medium text-gray-900">
                              {customer.typical_recurrence_days} días
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">No configurado</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {customer.last_purchase_date && (
                              <RepeatSaleButton
                                customerId={customer.id}
                                customerName={customer.full_name}
                                onSaleCreated={fetchCustomers}
                                size="sm"
                                showLabel={false}
                              />
                            )}
                            <GeneratePortalAccessButton
                              customerId={customer.id}
                              customerName={customer.full_name}
                              customerPhone={customer.phone}
                              size="sm"
                              showLabel={false}
                            />
                            <button
                              onClick={() => handleEditCustomer(customer.id)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <Edit className="h-4 w-4" />
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Customer Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        customerId={selectedCustomerId}
        onCustomerUpdated={handleCustomerUpdated}
      />
    </div>
  );
}
