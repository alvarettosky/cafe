"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Package,
  CheckCircle,
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

interface PriceList {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  is_active: boolean;
  created_at: string;
}

interface PriceListItem {
  id: string;
  price_list_id: string;
  product_id: string;
  product_name: string;
  custom_price: number;
}

interface Product {
  product_id: string;
  product_name: string;
}

export function PriceListManager() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<PriceListItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDiscount, setFormDiscount] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [listsResult, productsResult] = await Promise.all([
        supabase
          .from("price_lists")
          .select("*")
          .order("name"),
        supabase
          .from("inventory")
          .select("product_id, product_name")
          .order("product_name"),
      ]);

      if (listsResult.error) throw listsResult.error;
      if (productsResult.error) throw productsResult.error;

      setPriceLists(listsResult.data || []);
      setProducts(productsResult.data || []);
    } catch (err) {
      console.error("Error fetching price lists:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchListItems = async (listId: string) => {
    try {
      const { data, error } = await supabase
        .from("price_list_items")
        .select(`
          *,
          product:inventory(name)
        `)
        .eq("price_list_id", listId);

      if (error) throw error;

      const items = (data || []).map((item: {
        id: string;
        price_list_id: string;
        product_id: string;
        product: { name: string } | null;
        custom_price: number;
      }) => ({
        id: item.id,
        price_list_id: item.price_list_id,
        product_id: item.product_id,
        product_name: item.product?.name || "Producto desconocido",
        custom_price: item.custom_price,
      }));

      setListItems(items);
    } catch (err) {
      console.error("Error fetching list items:", err);
    }
  };

  const openCreateModal = () => {
    setEditingList(null);
    setFormName("");
    setFormDescription("");
    setFormDiscount(0);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (list: PriceList) => {
    setEditingList(list);
    setFormName(list.name);
    setFormDescription(list.description || "");
    setFormDiscount(list.discount_percent);
    setFormIsActive(list.is_active);
    setIsModalOpen(true);
  };

  const openItemsModal = async (listId: string) => {
    setSelectedListId(listId);
    await fetchListItems(listId);
    setIsItemsModalOpen(true);
  };

  const handleSaveList = async () => {
    if (!formName.trim()) return;

    setSaving(true);
    try {
      const listData = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        discount_percent: formDiscount,
        is_active: formIsActive,
      };

      if (editingList) {
        const { error } = await supabase
          .from("price_lists")
          .update(listData)
          .eq("id", editingList.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("price_lists")
          .insert(listData);

        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving price list:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Esta seguro de eliminar esta lista de precios?")) return;

    try {
      const { error } = await supabase
        .from("price_lists")
        .delete()
        .eq("id", listId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error("Error deleting price list:", err);
    }
  };

  const handleAddItem = async (productId: string, customPrice: number) => {
    if (!selectedListId) return;

    try {
      const { error } = await supabase
        .from("price_list_items")
        .upsert({
          price_list_id: selectedListId,
          product_id: productId,
          custom_price: customPrice,
        }, {
          onConflict: "price_list_id,product_id",
        });

      if (error) throw error;
      await fetchListItems(selectedListId);
    } catch (err) {
      console.error("Error adding item:", err);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("price_list_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      if (selectedListId) await fetchListItems(selectedListId);
    } catch (err) {
      console.error("Error removing item:", err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
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
          <h2 className="text-xl font-bold text-gray-900">Listas de Precios</h2>
          <p className="text-sm text-gray-500">
            Gestiona precios diferenciados por tipo de cliente
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Lista
        </Button>
      </div>

      {/* Price Lists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {priceLists.map((list, index) => (
          <motion.div
            key={list.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={!list.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    {list.name}
                  </span>
                  {list.is_active && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      Activa
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">
                  {list.description || "Sin descripcion"}
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-bold text-amber-600">
                    -{list.discount_percent}%
                  </span>
                  <span className="text-sm text-gray-500">descuento base</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openItemsModal(list.id)}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Productos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(list)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteList(list.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {priceLists.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay listas de precios configuradas</p>
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primera lista
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingList ? "Editar Lista de Precios" : "Nueva Lista de Precios"}
            </DialogTitle>
            <DialogDescription>
              Configure los detalles de la lista de precios
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
                placeholder="Ej: Mayoristas Gold"
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
                placeholder="Descripcion opcional..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descuento Base (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formDiscount}
                onChange={(e) => setFormDiscount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se aplica a todos los productos sin precio personalizado
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="h-4 w-4 text-amber-600 rounded border-gray-300"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Lista activa
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveList} disabled={saving || !formName.trim()}>
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

      {/* Items Modal */}
      <Dialog open={isItemsModalOpen} onOpenChange={setIsItemsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Precios Personalizados
            </DialogTitle>
            <DialogDescription>
              Configure precios especificos para cada producto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Current Items */}
            {listItems.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Productos configurados</h4>
                <div className="space-y-2">
                  {listItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-amber-600">
                          {formatCurrency(item.custom_price)}/lb
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Product */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Agregar producto</h4>
              <div className="space-y-2">
                {products
                  .filter((p) => !listItems.some((i) => i.product_id === p.product_id))
                  .map((product) => (
                    <ProductPriceRow
                      key={product.product_id}
                      product={product}
                      onAdd={handleAddItem}
                    />
                  ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for adding product prices
function ProductPriceRow({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (productId: string, price: number) => void;
}) {
  const [price, setPrice] = useState(10.00); // Default price
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    await onAdd(product.product_id, price);
    setAdding(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-md">
      <div className="flex-1">
        <p className="font-medium">{product.product_name}</p>
      </div>
      <input
        type="number"
        min="0"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        className="w-28 px-2 py-1 border border-gray-300 rounded-md text-sm"
      />
      <Button size="sm" onClick={handleAdd} disabled={adding}>
        {adding ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
