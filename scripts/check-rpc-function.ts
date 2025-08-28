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

async function checkRPCFunction() {
  console.log('🔍 Checking RPC function get_products_summary...\n');

  try {
    // 1. Test the RPC function with a specific product
    console.log('1. Testing RPC function with limit to see structure...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_products_summary', {
      p_category: null,
      p_location: null,
      p_date_from: null,
      p_date_to: null,
      p_search: '3077930', // Look specifically for our apron product
      p_limit: 5,
      p_offset: 0
    });

    if (rpcError) {
      console.error('❌ RPC error:', rpcError);
      return;
    }

    console.log(`✅ RPC returned ${rpcData?.length || 0} products`);
    if (rpcData && rpcData.length > 0) {
      const apronProduct = rpcData.find((p: any) => p.product_number === '3077930');
      if (apronProduct) {
        console.log('🎯 Found APRON product via RPC:');
        console.log('  Product Number:', apronProduct.product_number);
        console.log('  Name:', apronProduct.name);
        console.log('  Min Price:', apronProduct.min_price);
        console.log('  Max Price:', apronProduct.max_price);
        console.log('  Last Price:', apronProduct.last_price);
        console.log('  Pack Sizes:', apronProduct.pack_sizes);
        console.log('  Locations:', apronProduct.locations);
        console.log('  Total Spent:', apronProduct.total_spent);
        console.log('  Purchase Frequency:', apronProduct.purchase_frequency);
      }
    }

    // 2. Check the actual database structure
    console.log('\n2. Checking current database tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (!tablesError && tables) {
      console.log('✅ Current tables in database:');
      tables.forEach((table: any) => {
        console.log(`  - ${table.table_name}`);
      });
    }

    // 3. Check if we can see the RPC function definition
    console.log('\n3. Checking RPC function definition...');
    const { data: functions, error: functionsError } = await supabase
      .from('pg_proc')
      .select('proname, prosrc')
      .eq('proname', 'get_products_summary')
      .single();

    if (!functionsError && functions) {
      console.log('✅ Found RPC function definition');
      console.log('Function source (truncated):');
      const source = functions.prosrc as string;
      if (source.length > 500) {
        console.log(source.substring(0, 500) + '...\n[TRUNCATED]');
      } else {
        console.log(source);
      }
    } else {
      console.log('⚠️ Could not retrieve function definition:', functionsError);
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

// Run the check
checkRPCFunction();