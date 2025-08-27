import { supabase, createServerClient } from './client';
import type { 
  Product, 
  ProductSummary, 
  ProductPurchaseHistory, 
  PriceTrend,
  ProductFilters,
  QueryOptions,
  Location 
} from './types';

// Use server client for complex queries that need elevated permissions
const serverClient = createServerClient();

/**
 * Get all locations
 */
export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all products with summary information
 */
export async function getProductsSummary(
  filters: ProductFilters = {},
  options: QueryOptions = {}
): Promise<ProductSummary[]> {
  try {
    // This query aggregates data from multiple tables to create the product summary
    const { data, error } = await serverClient.rpc('get_products_summary', {
      p_category: filters.category,
      p_location: filters.location,
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_search: filters.search,
      p_limit: options.limit || 100,
      p_offset: options.offset || 0
    });

    if (error) {
      console.error('Error in get_products_summary RPC:', error);
      // Fallback to basic query if RPC doesn't exist
      return await getProductsSummaryFallback(filters, options);
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching products summary:', error);
    // Fallback to basic query
    return await getProductsSummaryFallback(filters, options);
  }
}

/**
 * Improved fallback method to get products summary using efficient queries
 * Only returns products that have actual purchase records
 */
async function getProductsSummaryFallback(
  filters: ProductFilters = {},
  options: QueryOptions = {}
): Promise<ProductSummary[]> {
  try {
    console.log('Using fallback method for products summary');
    
    // Get products that have actual purchase records with aggregated data
    let baseQuery = supabase
      .from('products')
      .select(`
        id,
        product_number,
        name,
        category
      `);

    // Apply filters to the base products
    if (filters.category) {
      baseQuery = baseQuery.eq('category', filters.category);
    }

    if (filters.search) {
      baseQuery = baseQuery.or(`name.ilike.%${filters.search}%,product_number.ilike.%${filters.search}%`);
    }

    // Get products first
    const { data: products, error: productsError } = await baseQuery
      .order(options.sortBy || 'name', { ascending: options.sortOrder !== 'desc' })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 100) - 1);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw productsError;
    }

    if (!products) return [];

    // Get aggregated purchase data for all products at once
    const productNumbers = products.map(p => p.product_number);
    
    // Get all purchase data in one query
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('invoice_items')
      .select(`
        product_number,
        pack_size,
        unit_price,
        extended_price,
        created_at,
        invoice:invoices!inner(
          id,
          invoice_date,
          location:locations(name)
        )
      `)
      .in('product_number', productNumbers)
      .order('invoice.invoice_date', { ascending: false });

    if (purchaseError) {
      console.error('Error fetching purchase data:', purchaseError);
      // Continue with empty purchase data rather than failing
    }

    // Group purchase data by product number
    const purchaseByProduct = new Map<string, Record<string, unknown>[]>();
    (purchaseData || []).forEach(item => {
      if (!purchaseByProduct.has(item.product_number)) {
        purchaseByProduct.set(item.product_number, []);
      }
      purchaseByProduct.get(item.product_number)!.push(item);
    });

    // Build summary for each product
    const productSummaries: ProductSummary[] = [];

    for (const product of products) {
      const purchases = purchaseByProduct.get(product.product_number) || [];
      
      // Skip products with no purchases
      if (purchases.length === 0) {
        console.log(`Skipping product ${product.product_number} - no purchase records`);
        continue;
      }

      // Calculate summary statistics
      const totalSpent = purchases.reduce((sum: number, p: Record<string, unknown>) => sum + ((p.extended_price as number) || 0), 0);
      const packSizes = [...new Set(purchases.map((p: Record<string, unknown>) => p.pack_size as string).filter(Boolean))];
      const locations = [...new Set(
        purchases.map((p: Record<string, unknown>) => ((p.invoice as Record<string, unknown>)?.location as Record<string, unknown>)?.name as string).filter(Boolean)
      )];

      // Calculate price statistics
      const prices = purchases.map((p: Record<string, unknown>) => (p.unit_price as number) || 0).filter(price => price > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
      const avgPrice = prices.length > 0 ? prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length : 0;

      // Get latest purchase info
      const sortedPurchases = purchases.sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
        new Date(((b.invoice as Record<string, unknown>)?.invoice_date as string) || 0).getTime() - new Date(((a.invoice as Record<string, unknown>)?.invoice_date as string) || 0).getTime()
      );
      const latestPurchase = sortedPurchases[0];

      productSummaries.push({
        id: product.id,
        product_number: product.product_number,
        name: product.name,
        category: product.category,
        last_price: (latestPurchase?.unit_price as number) || 0,
        last_purchase_date: ((latestPurchase?.invoice as Record<string, unknown>)?.invoice_date as string) || '',
        purchase_frequency: purchases.length,
        total_spent: totalSpent,
        pack_sizes: packSizes,
        locations: locations,
        min_price: minPrice,
        max_price: maxPrice,
        avg_price: avgPrice,
        price_variance: 0 // Could calculate standard deviation if needed
      });
    }

    console.log(`Fallback method returned ${productSummaries.length} products with purchase records`);
    return productSummaries;

  } catch (error) {
    console.error('Error in fallback method:', error);
    return [];
  }
}

/**
 * Get detailed purchase history for a specific product
 */
export async function getProductPurchaseHistory(
  productNumber: string
): Promise<ProductPurchaseHistory[]> {
  const { data, error } = await supabase
    .from('invoice_items')
    .select(`
      pack_size,
      qty_shipped,
      unit_price,
      extended_price,
      pricing_unit,
      invoice:invoices (
        document_number,
        invoice_date,
        location:locations (
          name
        )
      )
    `)
    .eq('product_number', productNumber)
    .order('invoice.invoice_date', { ascending: false });

  if (error) {
    console.error('Error fetching purchase history:', error);
    throw error;
  }

  return (data || []).map((item: Record<string, unknown>) => ({
    invoice_date: ((item.invoice as Record<string, unknown>)?.invoice_date as string) || '',
    location_name: (((item.invoice as Record<string, unknown>)?.location as Record<string, unknown>)?.name as string) || '',
    document_number: ((item.invoice as Record<string, unknown>)?.document_number as string) || '',
    pack_size: (item.pack_size as string),
    quantity: (item.qty_shipped as number),
    unit_price: (item.unit_price as number),
    extended_price: (item.extended_price as number),
    pricing_unit: (item.pricing_unit as string)
  }));
}

/**
 * Get price trends for a specific product over time
 */
export async function getProductPriceTrends(
  productNumber: string,
  months: number = 12
): Promise<PriceTrend[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from('product_prices')
    .select(`
      price_date,
      unit_price,
      quantity_purchased,
      location:locations (
        name
      )
    `)
    .eq('product_id', productNumber)
    .gte('price_date', startDate.toISOString())
    .order('price_date', { ascending: true });

  if (error) {
    console.error('Error fetching price trends:', error);
    throw error;
  }

  return (data || []).map((item: Record<string, unknown>) => ({
    date: (item.price_date as string),
    price: (item.unit_price as number),
    location: ((item.location as Record<string, unknown>)?.name as string) || '',
    quantity: (item.quantity_purchased as number)
  }));
}

/**
 * Search products by name or product number
 */
export async function searchProducts(
  searchTerm: string,
  limit: number = 20
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${searchTerm}%,product_number.ilike.%${searchTerm}%`)
    .limit(limit);

  if (error) {
    console.error('Error searching products:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get product categories for filtering
 */
export async function getProductCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .not('category', 'is', null);

  if (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }

  const categories = [...new Set(data?.map(item => item.category) || [])];
  return categories.sort();
}