import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables, using fallback client');
}

// SAFE: Only using anon key in browser (never expose service role key!)
export const supabase = createClient(
  supabaseUrl || 'https://hrikfmxucmdzuedgvoow.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaWtmbXh1Y21kenVlZGd2b293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzYyMTQsImV4cCI6MjA3MTgxMjIxNH0.uXMU6BnnwRQoHVYmpK8arRNK5R1BfVWcRRpARK7RFTs'
);

// Optimized query functions using the RPC function
export async function getProductsSummary() {
  try {
    console.log('🔍 Loading products using optimized RPC function...');
    
    // Use the new RPC function for optimal performance
    const { data, error } = await supabase.rpc('get_products_summary', {
      p_category: null,
      p_location: null,
      p_date_from: null,
      p_date_to: null,
      p_search: null,
      p_limit: 1000,
      p_offset: 0
    });

    if (error) {
      console.error('❌ RPC function error, falling back to manual approach:', error);
      // Fallback to manual implementation in case of RPC issues
      return await getProductsSummaryFallback();
    }

    console.log('✅ RPC function returned', data?.length || 0, 'products');
    
    if (!data) {
      return [];
    }

    // Transform RPC results to match expected format
    const transformedProducts = data.map((product: Record<string, unknown>) => ({
      id: product.id as string,
      product_number: product.product_number as string,
      name: product.name as string,
      category: product.category as string,
      last_price: (product.last_price as number) || 0,
      last_purchase_date: (product.last_purchase_date as string) || '',
      purchase_frequency: Number(product.purchase_frequency) || 0,
      total_spent: (product.total_spent as number) || 0,
      pack_sizes: (product.pack_sizes as string[])?.length > 0 ? (product.pack_sizes as string[]) : ['N/A'],
      locations: (product.locations as string[])?.length > 0 ? (product.locations as string[]) : ['Unknown'],
      min_price: (product.min_price as number) || 0,
      max_price: (product.max_price as number) || 0,
      avg_price: (product.avg_price as number) || 0,
      price_variance: (product.price_variance as number) || 0
    }));

    console.log('✅ Successfully processed', transformedProducts.length, 'products via RPC');
    return transformedProducts;

  } catch (error) {
    console.error('❌ Error in getProductsSummary:', error);
    console.log('Falling back to manual implementation...');
    return await getProductsSummaryFallback();
  }
}

// Fallback manual implementation (simplified version)
async function getProductsSummaryFallback() {
  try {
    console.log('🔄 Using fallback manual implementation...');
    
    // Get products that actually have purchases
    const { data: productsWithPurchases, error } = await supabase
      .from('invoice_items')
      .select(`
        product_number,
        product_description,
        unit_price,
        extended_price,
        pack_size,
        qty_shipped,
        invoice:invoices!inner(
          invoice_date,
          location:locations(name)
        )
      `)
      .limit(1000);

    if (error) {
      console.error('❌ Error in fallback method:', error);
      return [];
    }

    if (!productsWithPurchases) {
      return [];
    }

    // Group by product number
    const productMap = new Map();
    productsWithPurchases.forEach(item => {
      const key = item.product_number;
      if (!productMap.has(key)) {
        productMap.set(key, {
          product_number: key,
          name: item.product_description,
          items: []
        });
      }
      productMap.get(key).items.push(item);
    });

    // Create summaries
    const summaries = Array.from(productMap.values()).map(group => {
      const items = group.items;
      const totalSpent = items.reduce((sum: number, item: Record<string, unknown>) => sum + ((item.extended_price as number) || 0), 0);
      const packSizes = [...new Set(items.map((item: Record<string, unknown>) => item.pack_size as string).filter(Boolean))];
      const locations = [...new Set(items.map((item: Record<string, unknown>) => ((item.invoice as Record<string, unknown>)?.location as Record<string, unknown>)?.name as string).filter(Boolean))];
      
      // Sort by date to get latest
      const sortedItems = items.sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
        new Date((b.invoice as Record<string, unknown>)?.invoice_date as string || 0).getTime() - new Date((a.invoice as Record<string, unknown>)?.invoice_date as string || 0).getTime()
      );

      return {
        id: group.product_number, // Use product number as ID for fallback
        product_number: group.product_number,
        name: group.name,
        category: 'Unknown', // Would need product table join for category
        last_price: sortedItems[0]?.unit_price || 0,
        last_purchase_date: sortedItems[0]?.invoice?.invoice_date || '',
        purchase_frequency: items.length,
        total_spent: totalSpent,
        pack_sizes: packSizes.length > 0 ? packSizes : ['N/A'],
        locations: locations.length > 0 ? locations : ['Unknown']
      };
    });

    console.log('✅ Fallback method processed', summaries.length, 'products');
    return summaries;

  } catch (error) {
    console.error('❌ Error in fallback method:', error);
    return [];
  }
}

export async function getProductPurchaseHistory(productNumber: string) {
  try {
    console.log('🔍 Loading REAL purchase history for:', productNumber);
    
    // Get actual purchase history with proper joins to invoices and locations
    const { data, error } = await supabase
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
      .eq('product_number', productNumber)
      .limit(500); // Increased from 100 to 500 to show complete history

    if (error) {
      console.error('❌ Error fetching purchase history for', productNumber + ':', error);
      console.error('❌ Full error details:', JSON.stringify(error, null, 2));
      return [];
    }

    console.log('✅ Found', data?.length, 'REAL purchase records for', productNumber);

    if (!data || data.length === 0) {
      return [];
    }

    // Transform to the expected format with real data
    const purchaseHistory = data.map((item: Record<string, unknown>) => ({
      invoice_date: ((item.invoice as Record<string, unknown>)?.invoice_date as string) || '',
      location_name: (((item.invoice as Record<string, unknown>)?.location as Record<string, unknown>)?.name as string) || 'Unknown',
      document_number: ((item.invoice as Record<string, unknown>)?.file_name as string) || ((item.invoice as Record<string, unknown>)?.document_number as string) || 'Unknown',
      pack_size: (item.pack_size as string) || 'N/A',
      quantity: (item.qty_shipped as number) || 0,
      unit_price: (item.unit_price as number) || 0,
      extended_price: (item.extended_price as number) || 0,
      pricing_unit: (item.pricing_unit as string) || 'EA'
    }));

    // Sort chronologically (oldest to newest) for proper price change calculations
    const sortedHistory = purchaseHistory.sort((a, b) => 
      new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );

    console.log('✅ Returning', sortedHistory.length, 'chronologically sorted purchase records');
    console.log('📅 Date range:', 
      sortedHistory[0]?.invoice_date, 
      'to', 
      sortedHistory[sortedHistory.length - 1]?.invoice_date
    );

    return sortedHistory;

  } catch (error) {
    console.error('❌ Error in getProductPurchaseHistory:', error);
    return [];
  }
}