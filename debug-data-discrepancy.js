// Debug script to compare RPC vs direct query for product 1050972
import { supabase } from './lib/supabase/browser.js';

console.log('🔍 Debugging data discrepancy for product 1050972...');

// Method 1: RPC Function (used by dashboard)
console.log('\n1️⃣ Getting data from RPC function...');
const { data: rpcData, error: rpcError } = await supabase.rpc('get_products_summary', {
  p_category: null,
  p_location: null,
  p_date_from: null,
  p_date_to: null,
  p_search: '1050972',
  p_limit: 10,
  p_offset: 0
});

if (rpcError) {
  console.error('RPC Error:', rpcError);
} else {
  const product = rpcData?.find(p => p.product_number === '1050972');
  console.log('RPC Result:', {
    product_number: product?.product_number,
    total_spent: product?.total_spent,
    purchase_frequency: product?.purchase_frequency,
    last_price: product?.last_price,
    min_price: product?.min_price,
    max_price: product?.max_price
  });
}

// Method 2: Direct Query (used by modal)
console.log('\n2️⃣ Getting data from direct invoice_items query...');
const { data: directData, error: directError } = await supabase
  .from('invoice_items')
  .select(`
    pack_size,
    qty_shipped,
    unit_price,
    extended_price,
    pricing_unit,
    created_at,
    invoice:invoices!inner(
      id,
      document_number,
      invoice_date,
      file_name,
      location:locations(
        name
      )
    )
  `)
  .eq('product_number', '1050972')
  .limit(200);

if (directError) {
  console.error('Direct Query Error:', directError);
} else {
  const totalSpend = directData?.reduce((sum, item) => sum + (item.extended_price || 0), 0) || 0;
  const orderCount = directData?.length || 0;
  const prices = directData?.map(item => item.unit_price).filter(p => p > 0) || [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const lastPrice = directData?.[0]?.unit_price || 0;
  
  console.log('Direct Query Result:', {
    product_number: '1050972',
    total_spent: totalSpend,
    purchase_frequency: orderCount,
    last_price: lastPrice,
    min_price: minPrice,
    max_price: maxPrice,
    sample_records: directData?.slice(0, 3).map(item => ({
      date: item.invoice?.invoice_date,
      price: item.unit_price,
      extended: item.extended_price,
      location: item.invoice?.location?.name
    }))
  });
}

console.log('\n🔍 Analysis:');
if (rpcData && directData) {
  const rpcProduct = rpcData.find(p => p.product_number === '1050972');
  const directTotal = directData.reduce((sum, item) => sum + (item.extended_price || 0), 0);
  
  console.log('- RPC Total Spend:', rpcProduct?.total_spent);
  console.log('- Direct Query Total Spend:', directTotal);
  console.log('- Difference:', Math.abs((rpcProduct?.total_spent || 0) - directTotal));
  console.log('- RPC Orders:', rpcProduct?.purchase_frequency);
  console.log('- Direct Query Orders:', directData.length);
}