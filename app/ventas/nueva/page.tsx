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
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Coffee, Loader2, ArrowLeft } from "lucide-react";
import { RecurrenceInput } from "@/components/recurrence-input";
import Link from "next/link";

export default function NuevaVentaPage() {
    const router = useRouter();
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

    // Update suggested price when unit changes
    useEffect(() => {
        const suggestedPrice = unit === 'libra' ? 10.00 : 5.00;
        setPricePerUnit(suggestedPrice);
    }, [unit]);

    useEffect(() => {
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
    }, []);

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

            // Navigate back to home
            router.push('/');
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error processing sale");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/">
                        <Button variant="ghost" className="mb-4">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al Dashboard
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Coffee className="h-8 w-8 text-primary" />
                        Registrar Venta de Café
                    </h1>
                </div>

                {/* Form Card */}
                <div className="bg-card glass border border-white/10 rounded-lg p-6 shadow-xl">
                    <div className="grid gap-4">
                        {/* Customer Selection Section */}
                        <div className="flex flex-col space-y-2 border-b pb-4 mb-2">
                            <label className="text-sm font-medium">Cliente</label>
                            {!isNewCustomerMode ? (
                                <div className="flex gap-2">
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                                <div className="space-y-3 p-4 bg-muted/20 rounded-md border border-dashed">
                                    <p className="text-sm font-semibold text-primary">Registrar Nuevo Cliente</p>
                                    <input
                                        placeholder="Nombre Completo"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        value={newCustomerName}
                                        onChange={(e) => setNewCustomerName(e.target.value)}
                                    />
                                    <input
                                        placeholder="Teléfono (Opcional)"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                        value={newCustomerPhone}
                                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                                    />
                                    <input
                                        placeholder="Dirección (Opcional)"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                                    <Button variant="ghost" size="sm" onClick={() => setIsNewCustomerMode(false)} className="text-xs w-full">
                                        Cancelar / Seleccionar Existente
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Recurrence Input for existing customer without recurrence */}
                        {showRecurrenceInput && !isNewCustomerMode && (
                            <div className="border-b pb-4 mb-2">
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
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
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
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex flex-col space-y-2">
                                <label htmlFor="unit-select" className="text-sm font-medium">Unidad</label>
                                <select
                                    id="unit-select"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value as "libra" | "media_libra")}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="libra">Libra (500g)</option>
                                    <option value="media_libra">Media Libra (250g)</option>
                                </select>
                            </div>
                        </div>

                        {/* Price Section */}
                        <div className="flex flex-col space-y-2">
                            <label htmlFor="price-input" className="text-sm font-medium">Precio por Unidad ($)</label>
                            <input
                                id="price-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={pricePerUnit}
                                onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                            <div className="flex justify-between items-center p-3 bg-primary/5 rounded-md border border-primary/20">
                                <span className="text-sm font-medium text-muted-foreground">Total:</span>
                                <span className="text-2xl font-bold text-primary">
                                    ${(quantity * pricePerUnit).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium">Medio de Pago</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black dark:text-white"
                                value={saleDate}
                                onChange={(e) => setSaleDate(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Dejar vacío para usar fecha actual.</p>
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20">
                                {error}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t">
                            <Link href="/" className="flex-1">
                                <Button variant="outline" className="w-full" type="button">
                                    Cancelar
                                </Button>
                            </Link>
                            <Button onClick={handleSale} disabled={isLoading} className="flex-1">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar Venta
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
