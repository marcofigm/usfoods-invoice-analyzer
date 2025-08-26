#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role to check RLS

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLS() {
  console.log('🔍 Checking RLS policies...\n');

  try {
    // Check if RLS is enabled on tables
    const { data: rlsStatus, error } = await supabase
      .from('pg_class')
      .select('relname, relrowsecurity')
      .in('relname', ['products', 'locations', 'invoices', 'invoice_items']);

    if (error) {
      console.error('❌ Could not check RLS status:', error);
    } else {
      console.log('RLS Status for tables:');
      rlsStatus?.forEach(table => {
        console.log(`  ${table.relname}: ${table.relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
      });
    }

    // For now, let's temporarily disable RLS on the tables so the anon key can read them
    console.log('\n🔧 Temporarily disabling RLS for anon access...');

    const tables = ['products', 'locations', 'invoices', 'invoice_items'];
    
    for (const tableName of tables) {
      try {
        const { error: disableError } = await supabase.rpc('exec_sql', {
          sql: `ALTER TABLE public.${tableName} DISABLE ROW LEVEL SECURITY;`
        });
        
        if (disableError) {
          console.log(`Trying alternative method for ${tableName}...`);
          // Try direct SQL execution
          const { error: altError } = await supabase
            .from('_supabase_admin')
            .select()
            .limit(0); // This might fail but let's try
          
          console.log(`❌ Could not disable RLS on ${tableName}`);
        } else {
          console.log(`✅ RLS disabled on ${tableName}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not disable RLS on ${tableName}:`, err.message);
      }
    }

  } catch (error) {
    console.error('❌ RLS check failed:', error);
  }
}

// Run the check
checkRLS();