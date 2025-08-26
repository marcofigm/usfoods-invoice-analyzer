#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Using anon key like the browser

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugAnonPermissions() {
  console.log('🔍 Testing anon key permissions...\n');

  try {
    // Test products table with anon key
    console.log('1. Testing products table with anon key...');
    const { data: products, error: productsError, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .limit(5);

    if (productsError) {
      console.error('❌ Products table error:', productsError);
    } else {
      console.log(`✅ Products query successful: ${count} total products`);
      console.log('Sample products:', products);
    }

    // Test other tables
    console.log('\n2. Testing other tables with anon key...');
    
    const tables = ['locations', 'invoices', 'invoice_items'];
    
    for (const tableName of tables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(2);

        if (error) {
          console.error(`❌ ${tableName} error:`, error);
        } else {
          console.log(`✅ ${tableName}: ${count} rows`);
        }
      } catch (err) {
        console.error(`❌ ${tableName} exception:`, err);
      }
    }

    // Test specific schema access
    console.log('\n3. Testing public schema access...');
    const { data: schemaTest, error: schemaError } = await supabase
      .rpc('pg_get_tabledef', { tabname: 'products' })
      .select();

    if (schemaError) {
      console.log('Schema test error (expected):', schemaError.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugAnonPermissions();