import { supabase } from './browser';

// Dashboard Analytics Types
export interface DashboardMetrics {
  totalProducts: number;
  totalInvoices: number;
  totalSpend: number;
  totalLocations: number;
  avgOrderValue: number;
  avgProductsPerInvoice: number;
}

export interface SpendingByCategory {
  category: string;
  total_spend: number;
  product_count: number;
  percentage: number;
}

export interface TopSpendingProducts {
  product_number: string;
  name: string;
  category: string;
  total_spend: number;
  purchase_frequency: number;
  avg_price: number;
  last_purchase_date: string;
}

export interface PriceAlert {
  product_number: string;
  name: string;
  category: string;
  current_price: number;
  previous_price: number;
  price_change: number;
  price_change_percent: number;
  last_purchase_date: string;
  location_name: string;
}

export interface LocationComparison {
  location_name: string;
  total_spend: number;
  total_invoices: number;
  avg_invoice_value: number;
  unique_products: number;
  last_invoice_date: string;
}

export interface MonthlySpendTrend {
  year: number;
  month: number;
  month_name: string;
  total_spend: number;
  invoice_count: number;
  avg_invoice_value: number;
  unique_products: number;
}

export interface RecentActivity {
  invoice_date: string;
  location_name: string;
  document_number: string;
  net_amount: number;
  total_items: number;
  unique_products: number;
  processing_status: string;
}

// Get comprehensive dashboard metrics
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    // Get basic counts and totals
    const [productsResult, invoicesResult, spendResult] = await Promise.all([
      // Total unique products that have been purchased
      supabase
        .from('invoice_items')
        .select('product_number', { count: 'exact' })
        .not('product_number', 'is', null),
      
      // Total invoices
      supabase
        .from('invoices')
        .select('id', { count: 'exact' }),
      
      // Total spend and invoice details
      supabase
        .from('invoices')
        .select('net_amount, total_items, unique_products')
    ]);

    // Get location count
    const { count: locationCount } = await supabase
      .from('locations')
      .select('id', { count: 'exact' });

    // Calculate metrics
    const totalProducts = new Set(productsResult.data?.map(p => p.product_number) || []).size;
    const totalInvoices = invoicesResult.count || 0;
    const totalSpend = spendResult.data?.reduce((sum, inv) => sum + (inv.net_amount || 0), 0) || 0;
    const avgOrderValue = totalInvoices > 0 ? totalSpend / totalInvoices : 0;
    const avgProductsPerInvoice = totalInvoices > 0 ? 
      (spendResult.data?.reduce((sum, inv) => sum + (inv.unique_products || 0), 0) || 0) / totalInvoices : 0;

    return {
      totalProducts,
      totalInvoices,
      totalSpend,
      totalLocations: locationCount || 0,
      avgOrderValue,
      avgProductsPerInvoice
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    throw error;
  }
}

// Get spending breakdown by category
export async function getSpendingByCategory(): Promise<SpendingByCategory[]> {
  try {
    const { data, error } = await supabase
      .from('invoice_items')
      .select(`
        product_category,
        extended_price
      `)
      .not('product_category', 'is', null)
      .not('extended_price', 'is', null);

    if (error) throw error;

    // Group by category and calculate totals
    const categoryMap = new Map<string, { total: number; count: number }>();
    let grandTotal = 0;

    data?.forEach(item => {
      const category = item.product_category || 'Unknown';
      const amount = item.extended_price || 0;
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { total: 0, count: 0 });
      }
      
      categoryMap.get(category)!.total += amount;
      categoryMap.get(category)!.count += 1;
      grandTotal += amount;
    });

    // Convert to array and calculate percentages
    const result = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      total_spend: data.total,
      product_count: data.count,
      percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0
    }));

    // Sort by total spend descending
    return result.sort((a, b) => b.total_spend - a.total_spend);
  } catch (error) {
    console.error('Error fetching spending by category:', error);
    throw error;
  }
}

// Get top spending products
export async function getTopSpendingProducts(limit: number = 10): Promise<TopSpendingProducts[]> {
  try {
    const { data, error } = await supabase
      .from('invoice_items')
      .select(`
        product_number,
        product_description,
        product_category,
        extended_price,
        unit_price,
        invoice:invoices!inner(invoice_date)
      `)
      .not('product_number', 'is', null)
      .order('invoice.invoice_date', { ascending: false });

    if (error) throw error;

    // Group by product and calculate totals
    const productMap = new Map<string, {
      name: string;
      category: string;
      total_spend: number;
      purchase_frequency: number;
      prices: number[];
      latest_date: string;
    }>();

    data?.forEach(item => {
      const key = item.product_number;
      if (!productMap.has(key)) {
        productMap.set(key, {
          name: item.product_description,
          category: item.product_category || 'Unknown',
          total_spend: 0,
          purchase_frequency: 0,
          prices: [],
          latest_date: ''
        });
      }

      const product = productMap.get(key)!;
      product.total_spend += item.extended_price || 0;
      product.purchase_frequency += 1;
      if (item.unit_price > 0) {
        product.prices.push(item.unit_price);
      }
      
      // Track latest purchase date
      const invoiceDate = (item.invoice as unknown as Record<string, unknown>)?.invoice_date as string || '';
      if (invoiceDate > product.latest_date) {
        product.latest_date = invoiceDate;
      }
    });

    // Convert to array and calculate averages
    const result = Array.from(productMap.entries()).map(([product_number, data]) => ({
      product_number,
      name: data.name,
      category: data.category,
      total_spend: data.total_spend,
      purchase_frequency: data.purchase_frequency,
      avg_price: data.prices.length > 0 ? 
        data.prices.reduce((sum, price) => sum + price, 0) / data.prices.length : 0,
      last_purchase_date: data.latest_date
    }));

    // Sort by total spend and return top N
    return result
      .sort((a, b) => b.total_spend - a.total_spend)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching top spending products:', error);
    throw error;
  }
}

// Get recent price alerts (products with significant price changes)
export async function getPriceAlerts(threshold: number = 10): Promise<PriceAlert[]> {
  try {
    // Get recent invoice items with price data
    const { data, error } = await supabase
      .from('invoice_items')
      .select(`
        product_number,
        product_description,
        product_category,
        unit_price,
        invoice:invoices!inner(
          invoice_date,
          location:locations(name)
        )
      `)
      .not('unit_price', 'is', null)
      .gt('unit_price', 0)
      .order('invoice.invoice_date', { ascending: false })
      .limit(1000); // Get recent items

    if (error) throw error;

    // Group by product and track price changes
    const productPrices = new Map<string, {
      name: string;
      category: string;
      prices: Array<{
        price: number;
        date: string;
        location: string;
      }>;
    }>();

    data?.forEach(item => {
      const key = item.product_number;
      if (!productPrices.has(key)) {
        productPrices.set(key, {
          name: item.product_description,
          category: item.product_category || 'Unknown',
          prices: []
        });
      }

      productPrices.get(key)!.prices.push({
        price: item.unit_price,
        date: (item.invoice as unknown as Record<string, unknown>)?.invoice_date as string || '',
        location: (item.invoice as unknown as Record<string, unknown>)?.location as string || 'Unknown'
      });
    });

    const alerts: PriceAlert[] = [];

    // Analyze price changes for each product
    productPrices.forEach((data, product_number) => {
      // Sort prices by date (most recent first)
      data.prices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (data.prices.length >= 2) {
        const current = data.prices[0];
        const previous = data.prices[1];
        
        const priceChange = current.price - previous.price;
        const priceChangePercent = (priceChange / previous.price) * 100;
        
        // Only include significant changes above threshold
        if (Math.abs(priceChangePercent) >= threshold) {
          alerts.push({
            product_number,
            name: data.name,
            category: data.category,
            current_price: current.price,
            previous_price: previous.price,
            price_change: priceChange,
            price_change_percent: priceChangePercent,
            last_purchase_date: current.date,
            location_name: current.location
          });
        }
      }
    });

    // Sort by price change percentage (largest changes first)
    return alerts.sort((a, b) => Math.abs(b.price_change_percent) - Math.abs(a.price_change_percent));
  } catch (error) {
    console.error('Error fetching price alerts:', error);
    throw error;
  }
}

// Get location comparison data
export async function getLocationComparison(): Promise<LocationComparison[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        net_amount,
        total_items,
        unique_products,
        invoice_date,
        location:locations!inner(name)
      `);

    if (error) throw error;

    // Group by location
    const locationMap = new Map<string, {
      total_spend: number;
      invoice_count: number;
      unique_products: Set<number>;
      latest_date: string;
    }>();

    data?.forEach(invoice => {
      const locationName = (invoice.location as unknown as Record<string, unknown>)?.name as string || 'Unknown';
      if (!locationMap.has(locationName)) {
        locationMap.set(locationName, {
          total_spend: 0,
          invoice_count: 0,
          unique_products: new Set(),
          latest_date: ''
        });
      }

      const location = locationMap.get(locationName)!;
      location.total_spend += invoice.net_amount || 0;
      location.invoice_count += 1;
      location.unique_products.add(invoice.unique_products || 0);
      
      if (invoice.invoice_date > location.latest_date) {
        location.latest_date = invoice.invoice_date;
      }
    });

    // Convert to result format
    return Array.from(locationMap.entries()).map(([location_name, data]) => ({
      location_name,
      total_spend: data.total_spend,
      total_invoices: data.invoice_count,
      avg_invoice_value: data.invoice_count > 0 ? data.total_spend / data.invoice_count : 0,
      unique_products: Array.from(data.unique_products).reduce((sum, count) => sum + count, 0),
      last_invoice_date: data.latest_date
    }));
  } catch (error) {
    console.error('Error fetching location comparison:', error);
    throw error;
  }
}

// Get monthly spending trends
export async function getMonthlySpendTrends(months: number = 12): Promise<MonthlySpendTrend[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        invoice_date,
        net_amount,
        unique_products
      `)
      .order('invoice_date', { ascending: true });

    if (error) throw error;

    // Group by month
    const monthlyMap = new Map<string, {
      total_spend: number;
      invoice_count: number;
      unique_products: number;
    }>();

    data?.forEach(invoice => {
      const date = new Date(invoice.invoice_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          total_spend: 0,
          invoice_count: 0,
          unique_products: 0
        });
      }

      const month = monthlyMap.get(monthKey)!;
      month.total_spend += invoice.net_amount || 0;
      month.invoice_count += 1;
      month.unique_products += invoice.unique_products || 0;
    });

    // Convert to result format
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return Array.from(monthlyMap.entries())
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-').map(Number);
        return {
          year,
          month,
          month_name: monthNames[month - 1],
          total_spend: data.total_spend,
          invoice_count: data.invoice_count,
          avg_invoice_value: data.invoice_count > 0 ? data.total_spend / data.invoice_count : 0,
          unique_products: data.unique_products
        };
      })
      .sort((a, b) => new Date(`${a.year}-${a.month}-01`).getTime() - new Date(`${b.year}-${b.month}-01`).getTime())
      .slice(-months); // Last N months
  } catch (error) {
    console.error('Error fetching monthly spend trends:', error);
    throw error;
  }
}

// Get recent activity feed
export async function getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        invoice_date,
        document_number,
        net_amount,
        total_items,
        unique_products,
        processing_status,
        location:locations!inner(name)
      `)
      .order('invoice_date', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(invoice => ({
      invoice_date: invoice.invoice_date,
      location_name: (invoice.location as unknown as Record<string, unknown>)?.name as string || 'Unknown',
      document_number: invoice.document_number,
      net_amount: invoice.net_amount || 0,
      total_items: invoice.total_items || 0,
      unique_products: invoice.unique_products || 0,
      processing_status: invoice.processing_status || 'processed'
    }));
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    throw error;
  }
}