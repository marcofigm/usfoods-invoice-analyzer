// TypeScript interfaces for our Los Pinos invoice data

export interface Location {
  id: string;
  restaurant_id: string;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  created_at: string;
}

export interface Product {
  id: string;
  product_number: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  base_unit: string;
  standard_pack_sizes?: string[];
  brand?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  location_id: string;
  vendor_id: string;
  document_number: string;
  invoice_date: string;
  net_amount: number;
  file_name: string;
  processing_status: string;
  total_items: number;
  unique_products: number;
  created_at: string;
  updated_at: string;
  // Relations
  location?: Location;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_number: string;
  product_description: string;
  pack_size: string;
  pricing_unit: string;
  qty_ordered: number;
  qty_shipped: number;
  unit_price: number;
  extended_price: number;
  product_category: string;
  created_at: string;
  updated_at: string;
  // Relations
  invoice?: Invoice;
  product?: Product;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  location_id: string;
  vendor_id: string;
  unit_price: number;
  pack_size: string;
  pricing_unit: string;
  price_date: string;
  extended_amount: number;
  quantity_purchased: number;
  created_at: string;
  updated_at: string;
  // Relations
  product?: Product;
  location?: Location;
}

// Derived interfaces for UI
export interface ProductSummary {
  id: string;
  product_number: string;
  name: string;
  category: string;
  last_price: number;
  last_purchase_date: string;
  purchase_frequency: number;
  total_spent: number;
  pack_sizes: string[];
  locations: string[];
}

export interface ProductPurchaseHistory {
  invoice_date: string;
  location_name: string;
  document_number: string;
  pack_size: string;
  quantity: number;
  unit_price: number;
  extended_price: number;
  pricing_unit: string;
}

export interface PriceTrend {
  date: string;
  price: number;
  location: string;
  quantity: number;
}

// Filter and search interfaces
export interface ProductFilters {
  category?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}