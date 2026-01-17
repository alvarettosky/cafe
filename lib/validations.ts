import { z } from 'zod';

export const CustomerSchema = z.object({
    full_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    phone: z.string().optional(),
    email: z.string().email("Email inválido").optional().or(z.literal('')),
});

export const SaleItemSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive("La cantidad debe ser positiva"),
    unit: z.string(),
    price_per_unit: z.number().nonnegative(),
});

export const SaleSchema = z.object({
    customer_id: z.string().uuid(),
    items: z.array(SaleItemSchema).min(1, "La venta debe tener al menos un producto"),
});
