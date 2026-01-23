import { http, HttpResponse } from 'msw'
import type {
  AdvancedMetrics,
  TimeSeriesDataPoint,
  ProductMetric,
  InventoryItem,
} from '../types'
import type { InventoryMovement } from '../types/inventory'
import type { VariantForSale } from '../types/products'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'

// Mock data generators
const mockAdvancedMetrics: AdvancedMetrics = {
  total_revenue: 15000.0,
  total_cost: 9000.0,
  total_profit: 6000.0,
  avg_profit_margin: 40.0,
  sales_count: 120,
  avg_ticket: 125.0,
  payment_breakdown: {
    cash: {
      count: 80,
      total: 10000.0,
      profit: 4000.0,
    },
    credit: {
      count: 30,
      total: 4000.0,
      profit: 1600.0,
    },
    pending: {
      count: 10,
      total: 1000.0,
      profit: 400.0,
    },
  },
  pending_credits: 1000.0,
  top_products: [
    {
      product_name: 'Café Especial',
      units_sold: 50,
      revenue: 7500.0,
      profit: 3000.0,
      profit_margin: 40.0,
    },
    {
      product_name: 'Café Premium',
      units_sold: 40,
      revenue: 6000.0,
      profit: 2400.0,
      profit_margin: 40.0,
    },
    {
      product_name: 'Café Orgánico',
      units_sold: 30,
      revenue: 1500.0,
      profit: 600.0,
      profit_margin: 40.0,
    },
  ],
  inventory_value: 25000.0,
  low_stock_items: 3,
}

const mockTimeSeriesData: TimeSeriesDataPoint[] = [
  {
    date: '2024-01-01',
    revenue: 500.0,
    profit: 200.0,
    cost: 300.0,
    sales_count: 4,
    avg_ticket: 125.0,
  },
  {
    date: '2024-01-02',
    revenue: 750.0,
    profit: 300.0,
    cost: 450.0,
    sales_count: 6,
    avg_ticket: 125.0,
  },
  {
    date: '2024-01-03',
    revenue: 625.0,
    profit: 250.0,
    cost: 375.0,
    sales_count: 5,
    avg_ticket: 125.0,
  },
]

const mockProductPerformance: ProductMetric[] = [
  {
    product_name: 'Café Especial',
    units_sold: 50,
    revenue: 7500.0,
    profit: 3000.0,
    profit_margin: 40.0,
  },
  {
    product_name: 'Café Premium',
    units_sold: 40,
    revenue: 6000.0,
    profit: 2400.0,
    profit_margin: 40.0,
  },
  {
    product_name: 'Café Orgánico',
    units_sold: 30,
    revenue: 1500.0,
    profit: 600.0,
    profit_margin: 40.0,
  },
]

const mockInventoryItems: InventoryItem[] = [
  {
    product_id: '1',
    product_name: 'Café Especial',
    total_grams_available: 5000,
    last_updated: '2024-01-15T10:00:00Z',
  },
  {
    product_id: '2',
    product_name: 'Café Premium',
    total_grams_available: 3000,
    last_updated: '2024-01-15T10:00:00Z',
  },
  {
    product_id: '3',
    product_name: 'Café Orgánico',
    total_grams_available: 2000,
    last_updated: '2024-01-15T10:00:00Z',
  },
]

const mockSales = [
  {
    id: '1',
    created_at: '2024-01-15T14:30:00Z',
    customer_name: 'Juan Pérez',
    total_amount: 150.0,
    payment_method: 'cash',
    status: 'completed',
  },
  {
    id: '2',
    created_at: '2024-01-15T13:15:00Z',
    customer_name: 'María García',
    total_amount: 200.0,
    payment_method: 'credit',
    status: 'completed',
  },
  {
    id: '3',
    created_at: '2024-01-15T12:00:00Z',
    customer_name: 'Pedro López',
    total_amount: 125.0,
    payment_method: 'pending',
    status: 'pending',
  },
]

const mockDashboardStats = {
  total_inventory_grams: 10000,
  sales_today: 15,
  low_stock_count: 3,
  roasted_coffee_lbs: 22.0,
}

// Mock inventory movements (Kardex)
const mockInventoryMovements: InventoryMovement[] = [
  {
    id: 'mov-1',
    product_id: '1',
    movement_type: 'sale',
    quantity_grams: -500,
    stock_before: 5500,
    stock_after: 5000,
    reference_id: 'sale-1',
    reference_type: 'sale',
    reason: 'Venta #001',
    created_at: '2024-01-15T14:30:00Z',
    performer_email: 'seller@test.com',
  },
  {
    id: 'mov-2',
    product_id: '1',
    movement_type: 'restock',
    quantity_grams: 2000,
    stock_before: 3500,
    stock_after: 5500,
    reason: 'Compra proveedor ABC',
    unit_cost: 0.02,
    batch_number: 'LOTE-2024-001',
    created_at: '2024-01-14T10:00:00Z',
    performer_email: 'admin@test.com',
  },
  {
    id: 'mov-3',
    product_id: '1',
    movement_type: 'loss',
    quantity_grams: -200,
    stock_before: 3700,
    stock_after: 3500,
    reason: 'Café vencido',
    created_at: '2024-01-13T09:00:00Z',
    performer_email: 'admin@test.com',
  },
]

// Mock variants for sale
const mockVariantsForSale: VariantForSale[] = [
  {
    variant_id: 'var-1',
    product_id: 'prod-1',
    product_name: 'Café Especial',
    variant_display_name: 'Café Especial - Libra (Grano)',
    sku: 'CAF-500G-GR',
    presentation: 'libra',
    grind_type: 'grano',
    weight_grams: 500,
    base_price: 10.00,
    stock_grams: 5000,
    has_stock: true,
  },
  {
    variant_id: 'var-2',
    product_id: 'prod-1',
    product_name: 'Café Especial',
    variant_display_name: 'Café Especial - Media Libra (Grano)',
    sku: 'CAF-250G-GR',
    presentation: 'media_libra',
    grind_type: 'grano',
    weight_grams: 250,
    base_price: 5.50,
    stock_grams: 5000,
    has_stock: true,
  },
  {
    variant_id: 'var-3',
    product_id: 'prod-1',
    product_name: 'Café Especial',
    variant_display_name: 'Café Especial - Libra (Molido Medio)',
    sku: 'CAF-500G-MM',
    presentation: 'libra',
    grind_type: 'molido_medio',
    weight_grams: 500,
    base_price: 10.00,
    stock_grams: 3000,
    has_stock: true,
  },
  {
    variant_id: 'var-4',
    product_id: 'prod-2',
    product_name: 'Café Premium',
    variant_display_name: 'Café Premium - Libra (Grano)',
    sku: 'PRE-500G-GR',
    presentation: 'libra',
    grind_type: 'grano',
    weight_grams: 500,
    base_price: 15.00,
    stock_grams: 2000,
    has_stock: true,
  },
  {
    variant_id: 'var-5',
    product_id: 'prod-2',
    product_name: 'Café Premium',
    variant_display_name: 'Café Premium - Libra (Grano)',
    sku: 'PRE-500G-GR-2',
    presentation: 'libra',
    grind_type: 'grano',
    weight_grams: 500,
    base_price: 15.00,
    stock_grams: 0,
    has_stock: false,
  },
]

// Mock customer price info
const mockCustomerPriceInfo = {
  product_id: '1',
  price_per_lb: 8.00,
  price_per_half_lb: 4.40,
  discount_applied: 20.0,
  price_list_name: 'Mayoristas',
}

// MSW Handlers
export const handlers = [
  // Mock get_advanced_metrics RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_advanced_metrics`, () => {
    return HttpResponse.json(mockAdvancedMetrics)
  }),

  // Mock get_sales_time_series RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_sales_time_series`, () => {
    return HttpResponse.json(mockTimeSeriesData)
  }),

  // Mock get_product_performance RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_product_performance`, () => {
    return HttpResponse.json(mockProductPerformance)
  }),

  // Mock get_dashboard_stats RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_dashboard_stats`, () => {
    return HttpResponse.json(mockDashboardStats)
  }),

  // Mock process_coffee_sale RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/process_coffee_sale`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Mock inventory GET (select all)
  http.get(`${SUPABASE_URL}/rest/v1/inventory`, ({ request }) => {
    const url = new URL(request.url)
    const head = url.searchParams.get('head')

    // HEAD request for count
    if (head === 'true') {
      return new HttpResponse(null, {
        status: 200,
        headers: {
          'Content-Range': `0-0/${mockInventoryItems.length}`,
        },
      })
    }

    return HttpResponse.json(mockInventoryItems)
  }),

  // Mock inventory POST (insert)
  http.post(`${SUPABASE_URL}/rest/v1/inventory`, async ({ request }) => {
    const body = await request.json()
    const newItem = Array.isArray(body) ? body[0] : body
    return HttpResponse.json([
      {
        ...newItem,
        product_id: Math.random().toString(36).substring(7),
        last_updated: new Date().toISOString(),
      },
    ])
  }),

  // Mock inventory PATCH (update)
  http.patch(`${SUPABASE_URL}/rest/v1/inventory`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json([body])
  }),

  // Mock inventory DELETE
  http.delete(`${SUPABASE_URL}/rest/v1/inventory`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Mock sales GET (select all)
  http.get(`${SUPABASE_URL}/rest/v1/sales`, () => {
    return HttpResponse.json(mockSales)
  }),

  // Mock sales POST (insert)
  http.post(`${SUPABASE_URL}/rest/v1/sales`, async ({ request }) => {
    const body = await request.json()
    const newSale = Array.isArray(body) ? body[0] : body
    return HttpResponse.json([
      {
        ...newSale,
        id: Math.random().toString(36).substring(7),
        created_at: new Date().toISOString(),
      },
    ])
  }),

  // Mock get_inventory_movements RPC (Kardex)
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_inventory_movements`, () => {
    return HttpResponse.json(mockInventoryMovements)
  }),

  // Mock restock_inventory RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/restock_inventory`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Mock register_inventory_loss RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/register_inventory_loss`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Mock register_inventory_movement RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/register_inventory_movement`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Mock get_variants_for_sale RPC (Product Variants)
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_variants_for_sale`, () => {
    return HttpResponse.json(mockVariantsForSale)
  }),

  // Mock get_product_price_for_customer RPC (Dynamic Pricing)
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_product_price_for_customer`, () => {
    return HttpResponse.json(mockCustomerPriceInfo)
  }),

  // Mock customers GET
  http.get(`${SUPABASE_URL}/rest/v1/customers`, () => {
    return HttpResponse.json([
      {
        id: 'customer-1',
        name: 'Juan Mayorista',
        phone: '3001234567',
        customer_type: 'mayorista_pequeno',
        email: 'juan@test.com',
      },
      {
        id: 'customer-2',
        name: 'María Retail',
        phone: '3007654321',
        customer_type: 'retail',
        email: 'maria@test.com',
      },
    ])
  }),

  // Mock price_lists GET
  http.get(`${SUPABASE_URL}/rest/v1/price_lists`, () => {
    return HttpResponse.json([
      {
        id: 'pl-1',
        name: 'Mayoristas',
        customer_type: 'mayorista_pequeno',
        discount_percentage: 20.0,
        is_active: true,
      },
      {
        id: 'pl-2',
        name: 'Cafeterías',
        customer_type: 'cafeteria',
        discount_percentage: 15.0,
        is_active: true,
      },
    ])
  }),

  // Mock profiles GET (for auth)
  http.get(`${SUPABASE_URL}/rest/v1/profiles`, () => {
    return HttpResponse.json([
      {
        id: 'user-1',
        role: 'admin',
        approved: true,
        email: 'admin@test.com',
      },
    ])
  }),
]
