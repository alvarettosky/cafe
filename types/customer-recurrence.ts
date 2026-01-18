// Types for Customer Recurrence and Sales Editing features

export interface CustomerContact {
  id: string;
  customer_id: string;
  contact_date: string;
  contact_type: 'call' | 'visit' | 'message' | 'other';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithRecurrence {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  typical_recurrence_days: number | null;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerToContact {
  customer_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  last_purchase_date: string;
  typical_recurrence_days: number | null;
  days_since_last_purchase: number;
  days_until_expected: number | null;
  urgency: 'high' | 'medium' | 'low' | 'unknown';
}

export interface SaleWithRecurrence {
  id: string;
  customer_id: string | null;
  customer_recurrence_days: number | null;
  payment_method: string;
  total_amount: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
  created_at: string;
  updated_at: string;
}

export interface EditSaleItem {
  product_id: string;
  quantity: number;
  unit: 'kg' | 'unidad';
  unit_price: number;
}

export interface EditSaleRequest {
  sale_id: string;
  customer_id: string;
  payment_method: string;
  items: EditSaleItem[];
}

export interface EditSaleResponse {
  success: boolean;
  sale_id?: string;
  total_amount?: number;
  total_profit?: number;
  error?: string;
}

export type ContactType = 'call' | 'visit' | 'message' | 'other';
export type UrgencyLevel = 'high' | 'medium' | 'low' | 'unknown';
