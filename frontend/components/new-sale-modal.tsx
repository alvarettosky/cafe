"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Coffee, Loader2 } from "lucide-react";

export function NewSaleModal({ onSaleComplete }: { onSaleComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState<"libra" | "media_libra">("libra");
    const [productId, setProductId] = useState("");
    const [products, setProducts] = useState<any[]>([]);

    // Customer State
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPhone, setNewCustomerPhone] = useState("");
    const [saleDate, setSaleDate] = useState(""); // Empty means now
    const [paymentMethod, setPaymentMethod] = useState("Efectivo");

    const paymentMethods = [
        "Efectivo",
        "Transf. Davivienda",
        "Transf. Bancolombia",
        "Nequi Alvaretto",
        "Nequi La Negra",
        "DaviPlata"
    ];

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
                const { data } = await supabase.from('customers').select('id, full_name');
                if (data) setCustomers(data);
            };
            fetchProducts();
            fetchCustomers();
        }
    }, [isOpen]);

    const handleSale = async () => {
        if (!productId) {
            setError("Selecciona un producto");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Hardcoded Price for demo ($10 for LB, $5 for Media)
            // In production, price should come from DB or calculated logic
            const price = unit === 'libra' ? 10.00 : 5.00;

            // Handle Customer (Existing or New)
            let finalCustomerId = selectedCustomerId;

            if (isNewCustomerMode) {
                if (!newCustomerName) throw new Error("Nombre del cliente requerido");

                const { data: newCust, error: custError } = await supabase
                    .from('customers')
                    .insert([{ full_name: newCustomerName, phone: newCustomerPhone }])
                    .select()
                    .single();

                if (custError) throw custError;
                finalCustomerId = newCust.id;
            } else if (!finalCustomerId) {
                // Default to Guest if nothing selected (assuming '0000...' exists from seed)
                finalCustomerId = '00000000-0000-0000-0000-000000000000';
            }

            // Call RPC
            const { error } = await supabase.rpc('process_coffee_sale', {
                p_customer_id: finalCustomerId,
                p_items: [{
                    product_id: productId,
                    unit,
                    quantity,
                    price
                }],
                p_created_at: saleDate ? new Date(saleDate).toISOString() : undefined,
                p_payment_method: paymentMethod
            });

            if (error) throw error;

            setIsOpen(false);
            onSaleComplete();
        } catch (err: any) {
            setError(err.message || "Error processing sale");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" size="lg" className="shadow-lg shadow-primary/20">
                    <Coffee className="mr-2 h-5 w-5" /> Nueva Venta
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card glass border-white/10">
                <DialogHeader>
                    <DialogTitle>Registrar Venta de Café</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
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
                            <div className="space-y-2 p-3 bg-muted/20 rounded-md border border-dashed">
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
                                <Button variant="ghost" size="sm" onClick={() => setIsNewCustomerMode(false)} className="text-xs h-6 w-full mt-2">
                                    Cancelar / Seleccionar Existente
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Dynamic Product Selection */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Producto</label>
                        <select
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
                            <label className="text-sm font-medium">Cantidad</label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value))}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium">Unidad</label>
                            <select
                                value={unit}
                                onChange={(e) => setUnit(e.target.value as any)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="libra">Libra (500g)</option>
                                <option value="media_libra">Media Libra (250g)</option>
                            </select>
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
                        <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
                            {error}
                        </div>
                    )}
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSale} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Venta
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
