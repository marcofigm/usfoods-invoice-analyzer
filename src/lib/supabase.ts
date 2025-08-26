import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          name: string
          location: string
          address: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          location: string
          address?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string
          address?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      product_master: {
        Row: {
          id: string
          product_number: string
          description: string
          brand: string | null
          category: 'Produce' | 'Protein' | 'Dairy' | 'Dry Goods' | 'Supplies' | 'Beverages'
          pack_size: string | null
          unit_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_number: string
          description: string
          brand?: string | null
          category: 'Produce' | 'Protein' | 'Dairy' | 'Dry Goods' | 'Supplies' | 'Beverages'
          pack_size?: string | null
          unit_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_number?: string
          description?: string
          brand?: string | null
          category?: 'Produce' | 'Protein' | 'Dairy' | 'Dry Goods' | 'Supplies' | 'Beverages'
          pack_size?: string | null
          unit_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          restaurant_id: string | null
          document_number: string
          document_type: string | null
          document_date: string
          customer_number: string | null
          order_number: string | null
          net_amount_after_adjustment: number | null
          net_amount_before_adjustment: number | null
          delivery_adjustment: number | null
          payment_terms: string | null
          date_ordered: string | null
          date_shipped: string | null
          usf_sales_location: string | null
          usf_sales_rep: string | null
          raw_data: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          document_number: string
          document_type?: string | null
          document_date: string
          customer_number?: string | null
          order_number?: string | null
          net_amount_after_adjustment?: number | null
          net_amount_before_adjustment?: number | null
          delivery_adjustment?: number | null
          payment_terms?: string | null
          date_ordered?: string | null
          date_shipped?: string | null
          usf_sales_location?: string | null
          usf_sales_rep?: string | null
          raw_data?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          document_number?: string
          document_type?: string | null
          document_date?: string
          customer_number?: string | null
          order_number?: string | null
          net_amount_after_adjustment?: number | null
          net_amount_before_adjustment?: number | null
          delivery_adjustment?: number | null
          payment_terms?: string | null
          date_ordered?: string | null
          date_shipped?: string | null
          usf_sales_location?: string | null
          usf_sales_rep?: string | null
          raw_data?: any | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_line_items: {
        Row: {
          id: string
          invoice_id: string
          product_number: string
          product_description: string
          product_label: string | null
          packing_size: string | null
          weight: number | null
          qty_ordered: number | null
          qty_shipped: number | null
          qty_adjusted: number | null
          pricing_unit: string | null
          unit_price: number | null
          extended_price: number | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          product_number: string
          product_description: string
          product_label?: string | null
          packing_size?: string | null
          weight?: number | null
          qty_ordered?: number | null
          qty_shipped?: number | null
          qty_adjusted?: number | null
          pricing_unit?: string | null
          unit_price?: number | null
          extended_price?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          product_number?: string
          product_description?: string
          product_label?: string | null
          packing_size?: string | null
          weight?: number | null
          qty_ordered?: number | null
          qty_shipped?: number | null
          qty_adjusted?: number | null
          pricing_unit?: string | null
          unit_price?: number | null
          extended_price?: number | null
          created_at?: string
        }
      }
      price_history: {
        Row: {
          id: string
          product_number: string
          restaurant_id: string
          price: number
          pricing_unit: string | null
          invoice_date: string
          invoice_id: string
          created_at: string
        }
        Insert: {
          id?: string
          product_number: string
          restaurant_id: string
          price: number
          pricing_unit?: string | null
          invoice_date: string
          invoice_id: string
          created_at?: string
        }
        Update: {
          id?: string
          product_number?: string
          restaurant_id?: string
          price?: number
          pricing_unit?: string | null
          invoice_date?: string
          invoice_id?: string
          created_at?: string
        }
      }
      price_alerts: {
        Row: {
          id: string
          restaurant_id: string | null
          product_number: string
          previous_price: number | null
          new_price: number | null
          percentage_change: number | null
          alert_type: 'increase' | 'decrease' | null
          invoice_date: string
          is_read: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          product_number: string
          previous_price?: number | null
          new_price?: number | null
          percentage_change?: number | null
          alert_type?: 'increase' | 'decrease' | null
          invoice_date: string
          is_read?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          product_number?: string
          previous_price?: number | null
          new_price?: number | null
          percentage_change?: number | null
          alert_type?: 'increase' | 'decrease' | null
          invoice_date?: string
          is_read?: boolean | null
          created_at?: string
        }
      }
    }
  }
}