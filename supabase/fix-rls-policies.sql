-- Fix RLS Policies for Invoice Analyzer
-- Run this in your Supabase SQL Editor

-- For a business internal app, we can allow public read access to invoice data
-- In a multi-tenant app, you'd want more restrictive policies

-- Allow anon users to read products
CREATE POLICY "Allow public read access to products" ON public.products
FOR SELECT TO anon
USING (true);

-- Allow anon users to read locations 
CREATE POLICY "Allow public read access to locations" ON public.locations
FOR SELECT TO anon  
USING (true);

-- Allow anon users to read invoices
CREATE POLICY "Allow public read access to invoices" ON public.invoices
FOR SELECT TO anon
USING (true);

-- Allow anon users to read invoice items
CREATE POLICY "Allow public read access to invoice_items" ON public.invoice_items  
FOR SELECT TO anon
USING (true);

-- Verify RLS is enabled (it should be)
-- If not enabled, you can enable it with:
-- ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;