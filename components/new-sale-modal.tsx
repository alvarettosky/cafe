"use client";

import { useState, useEffect, useCallback } from "react";

interface Product {
    product_id: string;
    product_name: string;
}

interface Customer {
    id: string;
    full_name: string;
    typical_recurrence_days: number | null;
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Coffee, Loader2, RefreshCw, Tag, Percent } from "lucide-react";
import { RecurrenceInput } from "./recurrence-input";

// Tipo para información de precio por cliente
interface CustomerPriceInfo {
    product_id: string;
    product_name: string;
    base_price_per_lb: number;
    base_price_per_half_lb: number;
    price_per_lb: number;
    price_per_half_lb: number;
    customer_type: string | null;
    price_list_name: string | null;
    discount_applied: number | null;
}

// Tipo para datos iniciales (usado por RepeatSaleButton)
export interface SaleInitialData {
    customerId: string;
    customerName: string;
    items: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_type: string;
        unit_price: number;
    }>;
    paymentMethod: string;
}

interface NewSaleModalProps {
    onSaleComplete: () => void;
    // Props opcionales para control externo
    externalOpen?: boolean;
    onExternalClose?: () => void;
    initialData?: SaleInitialData | null;
    showTrigger?: boolean;
}

export function NewSaleModal({
    onSaleComplete,
    externalOpen,
    onExternalClose,
    initialData,
    showTrigger = true
}: NewSaleModalProps) {
    // Control interno vs externo
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = externalOpen !== undefined;
    const isOpen = isControlled ? externalOpen : internalOpen;
    const setIsOpen = isControlled ? (open: boolean) => {
        if (!open && onExternalClose) onExternalClose();
    } : setInternalOpen;
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState<"libra" | "media_libra">("libra");
    const [productId, setProductId] = useState("");
    const [products, setProducts] = useState<Product[]>([]);
    const [pricePerUnit, setPricePerUnit] = useState(10.00);

    // Customer State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [newCustomerAddress, setNewCustomerAddress] = useState("");
    const [newCustomerRecurrence, setNewCustomerRecurrence] = useState<number | null>(null);
    const [saleDate, setSaleDate] = useState(""); // Empty means now
    const [paymentMethod, setPaymentMethod] = useState("Efectivo");

    // Recurrence State
    const [customerRecurrence, setCustomerRecurrence] = useState<number | null>(null);
    const [suggestedRecurrence, setSuggestedRecurrence] = useState<number | null>(null);
    const [showRecurrenceInput, setShowRecurrenceInput] = useState(false);

    const paymentMethods = [
        "Efectivo",
        "Transf. Davivienda",
        "Transf. Bancolombia",
        "Nequi Alvaretto",
        "Nequi La Negra",
        "DaviPlata",
        "Pago a crédito o pendiente"
    ];

    // Estado para indicar que es una repetición de venta
    const [isRepeatSale, setIsRepeatSale] = useState(false);

    // Estado para precios dinámicos por tipo de cliente
    const [customerPriceInfo, setCustomerPriceInfo] = useState<CustomerPriceInfo | null>(null);
    const [loadingPrice, setLoadingPrice] = useState(false);

    // Update suggested price when unit changes (solo si no es repeat sale)
    useEffect(() => {
        if (!isRepeatSale) {
            const suggestedPrice = unit === 'libra' ? 10.00 : 5.00;
            setPricePerUnit(suggestedPrice);
        }
    }, [unit, isRepeatSale]);

    // Aplicar datos iniciales cuando se abre con initialData
    useEffect(() => {
        if (isOpen && initialData) {
            setIsRepeatSale(true);
            setSelectedCustomerId(initialData.customerId);
            setPaymentMethod(initialData.paymentMethod || 'Efectivo');

            // Si hay items, usar el primero (por ahora solo soportamos un item)
            if (initialData.items && initialData.items.length > 0) {
                const firstItem = initialData.items[0];
                setProductId(firstItem.product_id);
                setQuantity(firstItem.quantity);
                setUnit(firstItem.unit_type === 'libra' ? 'libra' : 'media_libra');
                setPricePerUnit(firstItem.unit_price);
            }
        } else if (!isOpen) {
            // Resetear el flag cuando se cierra
            setIsRepeatSale(false);
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        if (isOpen) {
            const fetchProducts = async () => {
                const { data, error } = await supabase.from('inventory').select('product_id, product_name');
                if (error) {
                    console.error("Error fetching products:", error);
                    setError("Error cargando productos: " + error.message);
                }
                if (data) {
                    console.log("Productos cargados:", data);
                    setProducts(data);
                }
            };
            const fetchCustomers = async () => {
                const { data } = await supabase.from('customers').select('id, full_name, typical_recurrence_days');
                if (data) setCustomers(data);
            };
            fetchProducts();
            fetchCustomers();
        }
    }, [isOpen]);

    const fetchCustomerRecurrence = useCallback(async () => {
        if (!selectedCustomerId) return;

        try {
            // Get customer's existing recurrence
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (customer?.typical_recurrence_days) {
                setCustomerRecurrence(customer.typical_recurrence_days);
                setShowRecurrenceInput(false);
            } else {
                // Customer doesn't have recurrence set, show input
                setCustomerRecurrence(null);
                setShowRecurrenceInput(true);

                // Try to get suggested recurrence
                const { data, error } = await supabase.rpc(
                    'calculate_customer_recurrence',
                    { p_customer_id: selectedCustomerId }
                );

                if (!error && data) {
                    setSuggestedRecurrence(data);
                }
            }
        } catch (err) {
            console.error('Error fetching recurrence:', err);
        }
    }, [selectedCustomerId, customers]);

    // Fetch suggested recurrence when customer is selected
    useEffect(() => {
        if (selectedCustomerId && selectedCustomerId !== '00000000-0000-0000-0000-000000000000') {
            fetchCustomerRecurrence();
        } else {
            setCustomerRecurrence(null);
            setSuggestedRecurrence(null);
            setShowRecurrenceInput(false);
        }
    }, [selectedCustomerId, fetchCustomerRecurrence]);

    // Obtener precio dinámico cuando cambia cliente o producto
    const fetchCustomerPrice = useCallback(async () => {
        if (!productId || !selectedCustomerId || selectedCustomerId === '00000000-0000-0000-0000-000000000000') {
            setCustomerPriceInfo(null);
            return;
        }

        setLoadingPrice(true);
        try {
            const { data, error } = await supabase.rpc('get_product_price_for_customer', {
                p_product_id: productId,
                p_customer_id: selectedCustomerId
            });

            if (error) {
                console.error('Error fetching customer price:', error);
                setCustomerPriceInfo(null);
                return;
            }

            if (data && !data.error) {
                setCustomerPriceInfo(data);
                // Solo actualizar precio si no es una repetición de venta
                if (!isRepeatSale) {
                    const price = unit === 'libra' ? data.price_per_lb : data.price_per_half_lb;
                    if (price && price > 0) {
                        setPricePerUnit(price);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching customer price:', err);
        } finally {
            setLoadingPrice(false);
        }
    }, [productId, selectedCustomerId, unit, isRepeatSale]);

    // Llamar cuando cambie producto o cliente
    useEffect(() => {
        fetchCustomerPrice();
    }, [fetchCustomerPrice]);

    const handleSale = async () => {
        if (!productId) {
            setError("Selecciona un producto");
            return;
        }

        if (pricePerUnit <= 0) {
            setError("El precio debe ser mayor a $0");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Use the price from state (user can edit it)
            const price = pricePerUnit;

            // Handle Customer (Existing or New)
            let finalCustomerId = selectedCustomerId;
            let recurrenceToSave = customerRecurrence;

            if (isNewCustomerMode) {
                if (!newCustomerName) throw new Error("Nombre del cliente requerido");

                // Create new customer with recurrence
                const { data: newCust, error: custError } = await supabase
                    .from('customers')
                    .insert([{
                        full_name: newCustomerName,
                        phone: newCustomerPhone,
                        address: newCustomerAddress || null,
                        typical_recurrence_days: newCustomerRecurrence
                    }])
                    .select()
                    .single();

                if (custError) throw custError;
                finalCustomerId = newCust.id;
                recurrenceToSave = newCustomerRecurrence;
            } else if (!finalCustomerId) {
                // Default to Guest if nothing selected
                finalCustomerId = '00000000-0000-0000-0000-000000000000';
                recurrenceToSave = null;
            } else if (showRecurrenceInput && customerRecurrence) {
                // Update customer's recurrence if it was set during this sale
                await supabase.rpc('update_customer_recurrence', {
                    p_customer_id: finalCustomerId,
                    p_recurrence_days: customerRecurrence
                });
            }

            // Call RPC with recurrence
            const { error } = await supabase.rpc('process_coffee_sale', {
                p_customer_id: finalCustomerId,
                p_items: [{
                    product_id: productId,
                    unit,
                    quantity,
                    price
                }],
                p_created_at: saleDate ? new Date(saleDate).toISOString() : undefined,
                p_payment_method: paymentMethod,
                p_customer_recurrence_days: recurrenceToSave
            });

            if (error) throw error;

            // Reset form
            setIsOpen(false);
            setSelectedCustomerId("");
            setIsNewCustomerMode(false);
            setNewCustomerName("");
            setNewCustomerPhone("");
            setNewCustomerAddress("");
            setNewCustomerRecurrence(null);
            setCustomerRecurrence(null);
            setSuggestedRecurrence(null);
            setShowRecurrenceInput(false);
            setIsRepeatSale(false);
            setProductId("");
            setQuantity(1);
            setUnit("libra");
            setPricePerUnit(10.00);

            onSaleComplete();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error processing sale");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {showTrigger && (
                <DialogTrigger asChild>
                    <Button variant="default" size="lg" className="shadow-lg shadow-primary/20">
                        <Coffee className="mr-2 h-5 w-5" /> Nueva Venta
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px] bg-card glass border-white/10 max-h-[85vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        {isRepeatSale && <RefreshCw className="h-5 w-5 text-green-500" />}
                        {isRepeatSale ? 'Repetir Venta' : 'Registrar Venta de Café'}
                    </DialogTitle>
                    {isRepeatSale && initialData && (
                        <p className="text-sm text-muted-foreground mt-1">
                            Repitiendo última compra de {initialData.customerName}
                        </p>
                    )}
                </DialogHeader>
                <div className="grid gap-3 py-3 overflow-y-auto flex-1 pr-2">
                    {/* Customer Selection Section */}
                    <div className="flex flex-col space-y-2 border-b pb-3 mb-2">
                        <label className="text-sm font-medium">Cliente</label>
                        {!isNewCustomerMode ? (
                            <div className="flex gap-2">
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                    value={selectedCustomerId}
                                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                                >
                                    <option value="">Cliente General (Anónimo)</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.full_name}</option>
                                    ))}
                                </select>
                                <Button variant="outline" onClick={() => setIsNewCustomerMode(true)} type="button">
                                    + Nuevo
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2 p-2.5 bg-muted/20 rounded-md border border-dashed">
                                <p className="text-xs font-semibold text-primary">Registrar Nuevo Cliente</p>
                                <input
                                    placeholder="Nombre Completo"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    value={newCustomerName}
                                    onChange={(e) => setNewCustomerName(e.target.value)}
                                />
                                <input
                                    placeholder="Teléfono (Opcional)"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    value={newCustomerPhone}
                                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                                />
                                <input
                                    placeholder="Dirección (Opcional)"
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    value={newCustomerAddress}
                                    onChange={(e) => setNewCustomerAddress(e.target.value)}
                                />
                                <RecurrenceInput
                                    value={newCustomerRecurrence}
                                    onChange={setNewCustomerRecurrence}
                                    label="Recurrencia típica (opcional)"
                                    helperText="¿Cada cuántos días suele comprar?"
                                    showSuggestion={false}
                                />
                                <Button variant="ghost" size="sm" onClick={() => setIsNewCustomerMode(false)} className="text-xs h-6 w-full mt-2">
                                    Cancelar / Seleccionar Existente
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Recurrence Input for existing customer without recurrence */}
                    {showRecurrenceInput && !isNewCustomerMode && (
                        <div className="border-b pb-3 mb-2">
                            <RecurrenceInput
                                value={customerRecurrence}
                                onChange={setCustomerRecurrence}
                                suggestedValue={suggestedRecurrence}
                                showSuggestion={suggestedRecurrence !== null}
                                helperText="Este cliente no tiene recurrencia configurada. ¿Cada cuántos días suele comprar?"
                            />
                        </div>
                    )}

                    {/* Dynamic Product Selection */}
                    <div className="flex flex-col space-y-2">
                        <label htmlFor="product-select" className="text-sm font-medium">Producto</label>
                        <select
                            id="product-select"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                            onChange={(e) => setProductId(e.target.value)}
                            value={productId}
                        >
                            <option value="" className="text-black dark:text-white bg-white dark:bg-zinc-900">Seleccionar Café...</option>
                            {products.map((p) => (
                                <option key={p.product_id} value={p.product_id} className="text-black dark:text-white bg-white dark:bg-zinc-900">
                                    {p.product_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-2">
                            <label htmlFor="quantity-input" className="text-sm font-medium">Cantidad</label>
                            <input
                                id="quantity-input"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value))}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            />
                        </div>
                        <div className="flex flex-col space-y-2">
                            <label htmlFor="unit-select" className="text-sm font-medium">Unidad</label>
                            <select
                                id="unit-select"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value as "libra" | "media_libra")}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            >
                                <option value="libra">Libra (500g)</option>
                                <option value="media_libra">Media Libra (250g)</option>
                            </select>
                        </div>
                    </div>

                    {/* Price Section */}
                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                            <label htmlFor="price-input" className="text-sm font-medium">Precio por Unidad ($)</label>
                            {loadingPrice && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                        <input
                            id="price-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricePerUnit}
                            onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                        {/* Indicador de descuento aplicado */}
                        {customerPriceInfo && customerPriceInfo.discount_applied && customerPriceInfo.discount_applied > 0 && (
                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                                <Percent className="h-4 w-4 text-green-600" />
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-green-700 dark:text-green-400">
                                        Descuento aplicado: {customerPriceInfo.discount_applied.toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-500">
                                        {customerPriceInfo.price_list_name || customerPriceInfo.customer_type || 'Lista especial'}
                                    </p>
                                </div>
                                <Tag className="h-4 w-4 text-green-600" />
                            </div>
                        )}
                        <div className="flex justify-between items-center p-2.5 bg-primary/5 rounded-md border border-primary/20">
                            <span className="text-sm font-medium text-muted-foreground">Total:</span>
                            <span className="text-lg font-bold text-primary">
                                ${(quantity * pricePerUnit).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Medio de Pago</label>
                        <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            {paymentMethods.map(pm => (
                                <option key={pm} value={pm}>{pm}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Selection */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Fecha de Venta (Opcional)</label>
                        <input
                            type="datetime-local"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-black dark:text-white"
                            value={saleDate}
                            onChange={(e) => setSaleDate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Dejar vacío para usar fecha actual.</p>
                    </div>

                    {error && (
                        <div className="p-2.5 text-sm text-red-500 bg-red-500/10 rounded-md">
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end pt-3 border-t flex-shrink-0">
                    <Button onClick={handleSale} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Venta
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
