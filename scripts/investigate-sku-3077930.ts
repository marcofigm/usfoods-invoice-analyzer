#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateSKU() {
  console.log('🔍 Investigating SKU 3077930 (APRON, POLY ADLT WHT 28X46)...\n');

  try {
    // 1. Check if this product exists in products table
    console.log('1. Checking products table for SKU 3077930...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('product_number', '3077930');

    if (productsError) {
      console.error('❌ Error querying products:', productsError);
      return;
    }

    console.log(`✅ Found ${products?.length || 0} product record(s) for SKU 3077930:`);
    products?.forEach((product, index) => {
      console.log(`  ${index + 1}. ID: ${product.id}, Name: ${product.name}, Category: ${product.category}`);
    });

    // 2. Check all invoice items for this product number
    console.log('\n2. Checking all invoice items for product 3077930...');
    const { data: invoiceItems, error: itemsError } = await supabase
      .from('invoice_items')
      .select(`
        *,
        invoice:invoices(
          invoice_date,
          document_number,
          location:locations(name)
        )
      `)
      .eq('product_number', '3077930')
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('❌ Error querying invoice items:', itemsError);
      return;
    }

    console.log(`✅ Found ${invoiceItems?.length || 0} invoice line items for SKU 3077930:`);
    invoiceItems?.forEach((item, index) => {
      const invoice = item.invoice as any;
      const location = invoice?.location as any;
      console.log(`  ${index + 1}. Date: ${invoice?.invoice_date}, Location: ${location?.name}, Pack: ${item.pack_size}, Unit Price: $${item.unit_price}, Qty: ${item.qty_shipped}, Extended: $${item.extended_price}`);
    });

    // 3. Check for similar product descriptions with different SKUs
    console.log('\n3. Checking for similar APRON products with different SKUs...');
    const { data: similarProducts, error: similarError } = await supabase
      .from('products')
      .select('*')
      .ilike('name', '%APRON%')
      .ilike('name', '%POLY%');

    if (similarError) {
      console.error('❌ Error querying similar products:', similarError);
      return;
    }

    console.log(`✅ Found ${similarProducts?.length || 0} similar APRON products:`);
    similarProducts?.forEach((product, index) => {
      console.log(`  ${index + 1}. SKU: ${product.product_number}, Name: ${product.name}`);
    });

    // 4. Check raw invoice items to see pack size variations
    console.log('\n4. Checking all invoice items with APRON in description...');
    const { data: apronItems, error: apronError } = await supabase
      .from('invoice_items')
      .select(`
        product_number,
        product_description,
        pack_size,
        unit_price,
        qty_shipped,
        extended_price,
        invoice:invoices(
          invoice_date,
          location:locations(name)
        )
      `)
      .ilike('product_description', '%APRON%')
      .ilike('product_description', '%POLY%')
      .order('product_number', { ascending: true });

    if (apronError) {
      console.error('❌ Error querying apron items:', apronError);
      return;
    }

    console.log(`✅ Found ${apronItems?.length || 0} APRON line items across all SKUs:`);
    
    // Group by product number to see the issue
    const groupedBySkus = new Map();
    apronItems?.forEach((item) => {
      if (!groupedBySkus.has(item.product_number)) {
        groupedBySkus.set(item.product_number, []);
      }
      groupedBySkus.get(item.product_number).push(item);
    });

    groupedBySkus.forEach((items, sku) => {
      console.log(`\n  📦 SKU ${sku}:`);
      items.forEach((item: any, index: number) => {
        const invoice = item.invoice as any;
        const location = invoice?.location as any;
        console.log(`    ${index + 1}. ${invoice?.invoice_date} | ${location?.name} | Pack: ${item.pack_size} | Unit: $${item.unit_price} | Qty: ${item.qty_shipped} | Total: $${item.extended_price}`);
      });
    });

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Run the investigation
investigateSKU();