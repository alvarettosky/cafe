import { LucideIcon } from "lucide-react";

export * from './analytics';

export interface DashboardMetric {
    label: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: LucideIcon;
}

export interface InventoryItem {
    id: string;
    product_name: string;
    total_grams_available: number;
    last_updated: string;
}

export interface SaleItem {
    id: string;
    product_id: string;
    quantity: number;
    unit: 'libra' | 'media_libra';
    price: number;
}

export interface DashboardStats {
    total_inventory_grams: number;
    sales_today: number;
    low_stock_count: number;
    roasted_coffee_lbs: number;
}
