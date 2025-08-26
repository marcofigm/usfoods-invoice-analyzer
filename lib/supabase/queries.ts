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
 * Fallback method to get products summary using basic queries
 */
async function getProductsSummaryFallback(
  filters: ProductFilters = {},
  options: QueryOptions = {}
): Promise<ProductSummary[]> {
  let query = supabase
    .from('products')
    .select(`
      id,
      product_number,
      name,
      category
    `);

  // Apply filters
  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,product_number.ilike.%${filters.search}%`);
  }

  // Apply sorting and pagination
  query = query
    .order(options.sortBy || 'name', { ascending: options.sortOrder !== 'desc' })
    .range(options.offset || 0, (options.offset || 0) + (options.limit || 100) - 1);

  const { data: products, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  if (!products) return [];

  // For each product, get additional summary data
  const productSummaries: ProductSummary[] = [];

  for (const product of products) {
    // Get latest price and purchase info
    const { data: latestPurchase } = await supabase
      .from('product_prices')
      .select(`
        unit_price,
        price_date,
        pack_size,
        location:locations(name)
      `)
      .eq('product_id', product.id)
      .order('price_date', { ascending: false })
      .limit(1);

    // Get purchase frequency (count of invoices with this product)
    const { count: purchaseCount } = await supabase
      .from('invoice_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_number', product.product_number);

    // Get total spent on this product
    const { data: spendData } = await supabase
      .from('invoice_items')
      .select('extended_price')
      .eq('product_number', product.product_number);

    const totalSpent = spendData?.reduce((sum, item) => sum + item.extended_price, 0) || 0;

    // Get unique pack sizes
    const { data: packSizeData } = await supabase
      .from('invoice_items')
      .select('pack_size')
      .eq('product_number', product.product_number);

    const packSizes = [...new Set(packSizeData?.map(item => item.pack_size) || [])];

    // Get locations where this product was purchased
    const { data: locationData } = await supabase
      .from('invoice_items')
      .select(`
        invoice:invoices(location:locations(name))
      `)
      .eq('product_number', product.product_number);

    const locations = [...new Set(
      locationData?.map(item => item.invoice?.location?.name).filter(Boolean) || []
    )];

    productSummaries.push({
      id: product.id,
      product_number: product.product_number,
      name: product.name,
      category: product.category,
      last_price: latestPurchase?.[0]?.unit_price || 0,
      last_purchase_date: latestPurchase?.[0]?.price_date || '',
      purchase_frequency: purchaseCount || 0,
      total_spent: totalSpent,
      pack_sizes: packSizes,
      locations: locations
    });
  }

  return productSummaries;
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

  return (data || []).map(item => ({
    invoice_date: item.invoice?.invoice_date || '',
    location_name: item.invoice?.location?.name || '',
    document_number: item.invoice?.document_number || '',
    pack_size: item.pack_size,
    quantity: item.qty_shipped,
    unit_price: item.unit_price,
    extended_price: item.extended_price,
    pricing_unit: item.pricing_unit
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

  return (data || []).map(item => ({
    date: item.price_date,
    price: item.unit_price,
    location: item.location?.name || '',
    quantity: item.quantity_purchased
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