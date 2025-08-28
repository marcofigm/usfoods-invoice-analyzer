#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function quickCheck() {
  const { data, error } = await supabase
    .from('invoice_items')
    .select(`
      product_number,
      product_description,
      pack_size,
      unit_price,
      invoice:invoices!inner(
        invoice_date,
        location:locations(name)
      )
    `)
    .eq('product_number', '3077930')
;

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('APRON data:', JSON.stringify(data, null, 2));
}

quickCheck();