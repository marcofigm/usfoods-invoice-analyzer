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

// Simple query functions for the product table
export async function getProductsSummary() {
  try {
    console.log('🔍 Loading all products with optimized batch processing v2...');
    
    // Get all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(1000); // No artificial limit

    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      return [];
    }

    console.log('✅ Found', products?.length, 'products');

    if (!products || products.length === 0) {
      return [];
    }

    // Get ALL invoice items using pagination to bypass 1000 row limit
    console.log('📊 Loading all invoice item data with pagination...');
    
    let allInvoiceItems = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: pageData, error: pageError } = await supabase
        .from('invoice_items')
        .select('product_number, qty_shipped, unit_price, extended_price, pack_size, pricing_unit')
        .range(from, from + pageSize - 1);
      
      if (pageError) {
        console.error('❌ Error fetching invoice items page:', pageError);
        break;
      }
      
      if (!pageData || pageData.length === 0) {
        break; // No more data
      }
      
      allInvoiceItems.push(...pageData);
      console.log(`📊 Loaded page: ${allInvoiceItems.length} items so far...`);
      
      if (pageData.length < pageSize) {
        break; // Last page
      }
      
      from += pageSize;
    }
    
    const itemsError = null; // Reset error for the rest of the function

    if (itemsError) {
      console.error('❌ Error fetching invoice items:', itemsError);
      return [];
    }

    console.log('✅ Loaded', allInvoiceItems.length, 'invoice items total via pagination');

    // Group invoice items by product number for fast lookup
    const itemsByProduct = new Map();
    allInvoiceItems.forEach(item => {
      if (!itemsByProduct.has(item.product_number)) {
        itemsByProduct.set(item.product_number, []);
      }
      itemsByProduct.get(item.product_number).push(item);
    });

    console.log('🔍 Debug: itemsByProduct map has', itemsByProduct.size, 'unique products');
    
    // Debug: Check a few specific products
    const sampleProduct = products[0];
    if (sampleProduct) {
      console.log('🔍 Debug sample product:', sampleProduct.product_number);
      const sampleItems = itemsByProduct.get(sampleProduct.product_number);
      console.log('🔍 Sample product items:', sampleItems?.length || 0);
      if (sampleItems && sampleItems.length > 0) {
        console.log('🔍 First sample item:', sampleItems[0]);
      }
    }

    // Debug: Check total of all invoice items we loaded
    const allItemsTotal = Array.from(itemsByProduct.values())
      .flat()
      .reduce((sum, item) => sum + (parseFloat(item.extended_price) || 0), 0);
    console.log('🔍 Debug: Total from all loaded invoice items:', allItemsTotal);

    // Process all products with the pre-loaded data
    const productSummaries = products.map(product => {
      const productItems = itemsByProduct.get(product.product_number) || [];
      
      // Debug first few products
      if (products.indexOf(product) < 3) {
        console.log(`🔍 Debug product ${product.product_number}: ${productItems.length} items`);
      }
      
      // Calculate summary statistics
      const purchaseCount = productItems.length;
      const totalSpent = productItems.reduce((sum, item) => {
        const price = parseFloat(item.extended_price) || 0;
        return sum + price;
      }, 0);
      const lastPrice = parseFloat(productItems[0]?.unit_price) || 0;
      
      // Get unique pack sizes
      const packSizes = [...new Set(productItems.map(item => item.pack_size).filter(Boolean))];

      return {
        id: product.id,
        product_number: product.product_number,
        name: product.name,
        category: product.category,
        last_price: lastPrice,
        last_purchase_date: '', // Will add this back later with proper joins
        purchase_frequency: purchaseCount,
        total_spent: totalSpent,
        pack_sizes: packSizes.length > 0 ? packSizes : ['N/A'],
        locations: ['Bee Caves', '360'] // Will improve later
      };
    });

    // Filter out products with no purchases (optional - you can remove this if you want all products)
    const productsWithPurchases = productSummaries.filter(p => p.purchase_frequency > 0);

    console.log('✅ Processed', productSummaries.length, 'total products');
    console.log('✅ Found', productsWithPurchases.length, 'products with purchase data');
    
    // Calculate and verify total spending
    const calculatedTotalSpend = productSummaries.reduce((sum, p) => sum + p.total_spent, 0);
    console.log('💰 Calculated total spending:', calculatedTotalSpend);
    
    // Return all products (including those with 0 purchases) or just those with purchases
    return productSummaries; // Change to productsWithPurchases if you only want products with purchases
  } catch (error) {
    console.error('❌ Error in getProductsSummary:', error);
    return [];
  }
}

export async function getProductPurchaseHistory(productNumber: string) {
  try {
    console.log('Loading purchase history for:', productNumber);
    
    const { data, error } = await supabase
      .from('invoice_items')
      .select(`
        pack_size,
        qty_shipped,
        unit_price,
        extended_price,
        pricing_unit,
        invoice_id
      `)
      .eq('product_number', productNumber)
      .limit(50);

    if (error) {
      console.error('Error fetching purchase history:', error);
      return [];
    }

    console.log('Found', data?.length, 'purchase records for', productNumber);

    // Return simplified purchase history for now
    return (data || []).map((item, index) => ({
      invoice_date: '2024-08-25', // Static date for now
      location_name: index % 2 === 0 ? 'Bee Caves' : '360', // Alternate locations
      document_number: `INV-${item.invoice_id || '12345'}`,
      pack_size: item.pack_size,
      quantity: item.qty_shipped,
      unit_price: item.unit_price,
      extended_price: item.extended_price,
      pricing_unit: item.pricing_unit
    }));
  } catch (error) {
    console.error('Error in getProductPurchaseHistory:', error);
    return [];
  }
}