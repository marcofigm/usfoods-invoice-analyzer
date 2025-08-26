#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role for full access

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabase() {
  console.log('🔍 Verifying database connection and data...\n');

  try {
    // 1. Check products table
    console.log('1. Checking products table...');
    const { data: products, error: productsError, count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .limit(5);

    if (productsError) {
      console.error('❌ Error querying products:', productsError);
      return;
    }

    console.log(`✅ Products table: ${productsCount} total products`);
    console.log('First 5 products:');
    products?.forEach(product => {
      console.log(`  - ${product.product_number}: ${product.name} (${product.category})`);
    });

    // 2. Check locations table
    console.log('\n2. Checking locations table...');
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('*');

    if (locationsError) {
      console.error('❌ Error querying locations:', locationsError);
      return;
    }

    console.log(`✅ Locations table: ${locations?.length || 0} locations`);
    locations?.forEach(location => {
      console.log(`  - ${location.name}`);
    });

    // 3. Check invoices table
    console.log('\n3. Checking invoices table...');
    const { data: invoices, error: invoicesError, count: invoicesCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .limit(3);

    if (invoicesError) {
      console.error('❌ Error querying invoices:', invoicesError);
      return;
    }

    console.log(`✅ Invoices table: ${invoicesCount} total invoices`);
    console.log('First 3 invoices:');
    invoices?.forEach(invoice => {
      console.log(`  - ${invoice.document_number}: $${invoice.net_amount} (${invoice.invoice_date})`);
    });

    // 4. Check invoice_items table
    console.log('\n4. Checking invoice_items table...');
    const { data: items, error: itemsError, count: itemsCount } = await supabase
      .from('invoice_items')
      .select('*', { count: 'exact' })
      .limit(3);

    if (itemsError) {
      console.error('❌ Error querying invoice_items:', itemsError);
      return;
    }

    console.log(`✅ Invoice items table: ${itemsCount} total line items`);
    console.log('First 3 invoice items:');
    items?.forEach(item => {
      console.log(`  - ${item.product_number}: ${item.product_description} - $${item.unit_price} x ${item.qty_shipped}`);
    });

    // 5. Test the actual query we use in the app
    console.log('\n5. Testing actual app query...');
    
    // Get first product
    const { data: firstProduct } = await supabase
      .from('products')
      .select('*')
      .limit(1);

    if (firstProduct && firstProduct.length > 0) {
      const product = firstProduct[0];
      console.log(`Testing with product: ${product.product_number} - ${product.name}`);

      // Get invoice items for this product
      const { data: invoiceItems, error: itemsQueryError } = await supabase
        .from('invoice_items')
        .select(`
          qty_shipped,
          unit_price,
          extended_price,
          pack_size,
          pricing_unit,
          invoice:invoices(
            invoice_date,
            location:locations(name)
          )
        `)
        .eq('product_number', product.product_number)
        .limit(3);

      if (itemsQueryError) {
        console.error('❌ Error in app query:', itemsQueryError);
        return;
      }

      console.log(`✅ Found ${invoiceItems?.length || 0} invoice items for product ${product.product_number}`);
      invoiceItems?.forEach((item, i) => {
        console.log(`  ${i + 1}. $${item.unit_price} x ${item.qty_shipped} = $${item.extended_price} (${item.invoice?.location?.name})`);
      });
    }

    console.log('\n✅ Database verification complete!');

  } catch (error) {
    console.error('❌ Database verification failed:', error);
  }
}

// Run the verification
verifyDatabase();