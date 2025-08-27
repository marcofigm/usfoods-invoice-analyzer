import { getProductsSummary } from './browser';
import type { ProductSummary } from './types';

// Simplified dashboard analytics that work with existing data structures

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

// Get dashboard metrics using existing product data
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    console.log('📊 Getting dashboard metrics from product summaries...');
    
    const products = await getProductsSummary();
    console.log('✅ Got product summaries:', products.length, 'products');
    
    if (!products || products.length === 0) {
      console.log('⚠️ No products found, returning zero metrics');
      return {
        totalProducts: 0,
        totalInvoices: 0,
        totalSpend: 0,
        totalLocations: 0,
        avgOrderValue: 0,
        avgProductsPerInvoice: 0
      };
    }

    // Calculate metrics from product summaries
    const totalProducts = products.length;
    const totalSpend = products.reduce((sum: number, product: ProductSummary) => sum + product.total_spent, 0);
    const totalInvoices = products.reduce((sum: number, product: ProductSummary) => sum + product.purchase_frequency, 0);
    
    // Get unique locations
    const allLocations = products.flatMap((p: ProductSummary) => p.locations);
    const uniqueLocations = [...new Set(allLocations)].length;
    
    const avgOrderValue = totalInvoices > 0 ? totalSpend / totalInvoices : 0;
    const avgProductsPerInvoice = totalInvoices > 0 ? totalProducts / totalInvoices : 0;

    console.log('✅ Calculated metrics:', {
      totalProducts,
      totalInvoices,
      totalSpend: totalSpend.toFixed(2),
      totalLocations: uniqueLocations,
      avgOrderValue: avgOrderValue.toFixed(2)
    });

    return {
      totalProducts,
      totalInvoices,
      totalSpend,
      totalLocations: uniqueLocations,
      avgOrderValue,
      avgProductsPerInvoice
    };
  } catch (error) {
    console.error('❌ Error calculating dashboard metrics:', error);
    throw error;
  }
}

// Get spending by category from product summaries
export async function getSpendingByCategory(): Promise<SpendingByCategory[]> {
  try {
    console.log('📈 Getting spending by category...');
    
    const products = await getProductsSummary();
    if (!products || products.length === 0) {
      return [];
    }

    // Group by category
    const categoryMap = new Map<string, { total: number; count: number }>();
    let grandTotal = 0;

    products.forEach((product: ProductSummary) => {
      const category = product.category || 'Unknown';
      const spend = product.total_spent || 0;
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { total: 0, count: 0 });
      }
      
      categoryMap.get(category)!.total += spend;
      categoryMap.get(category)!.count += 1;
      grandTotal += spend;
    });

    // Convert to result format
    const result = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      total_spend: data.total,
      product_count: data.count,
      percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0
    }));

    console.log('✅ Found categories:', result.length);
    return result.sort((a, b) => b.total_spend - a.total_spend);
  } catch (error) {
    console.error('❌ Error getting category spending:', error);
    throw error;
  }
}

// Get top spending products - using real data from getProductsSummary
export async function getTopSpendingProducts(limit: number = 10): Promise<TopSpendingProducts[]> {
  try {
    console.log('🎯 Getting top spending products...');
    
    const products = await getProductsSummary();
    if (!products || products.length === 0) {
      return [];
    }

    // Convert and sort by total spend - using actual data from RPC function
    const topProducts = products
      .map((product: ProductSummary) => ({
        product_number: product.product_number,
        name: product.name,
        category: product.category,
        total_spend: product.total_spent, // This is the REAL total spend from RPC
        purchase_frequency: product.purchase_frequency, // Real purchase frequency
        avg_price: product.avg_price || product.last_price, // Real average price
        last_purchase_date: product.last_purchase_date
      }))
      .sort((a: TopSpendingProducts, b: TopSpendingProducts) => b.total_spend - a.total_spend)
      .slice(0, limit);

    console.log('✅ Got top products with real data:', topProducts.length);
    console.log('Top product example:', topProducts[0]?.product_number, 'spend:', topProducts[0]?.total_spend);
    return topProducts;
  } catch (error) {
    console.error('❌ Error getting top products:', error);
    throw error;
  }
}

// Get price alerts (products with high variance)
export async function getPriceAlerts(threshold: number = 15): Promise<PriceAlert[]> {
  try {
    console.log('🚨 Getting price alerts...');
    
    const products = await getProductsSummary();
    if (!products || products.length === 0) {
      return [];
    }

    const alerts: PriceAlert[] = [];
    
    products.forEach((product: ProductSummary) => {
      if (product.min_price && product.max_price && product.min_price > 0) {
        const priceChange = product.max_price - product.min_price;
        const priceChangePercent = (priceChange / product.min_price) * 100;
        
        if (priceChangePercent >= threshold) {
          alerts.push({
            product_number: product.product_number,
            name: product.name,
            category: product.category,
            current_price: product.last_price,
            previous_price: product.min_price,
            price_change: priceChange,
            price_change_percent: priceChangePercent,
            last_purchase_date: product.last_purchase_date,
            location_name: product.locations[0] || 'Unknown'
          });
        }
      }
    });

    console.log('✅ Found price alerts:', alerts.length);
    return alerts.sort((a, b) => b.price_change_percent - a.price_change_percent);
  } catch (error) {
    console.error('❌ Error getting price alerts:', error);
    throw error;
  }
}

// Mock data for features that need more complex queries
export async function getLocationComparison(): Promise<LocationComparison[]> {
  try {
    console.log('🏪 Getting location comparison...');
    
    const products = await getProductsSummary();
    if (!products || products.length === 0) {
      return [];
    }

    // Group by locations
    const locationMap = new Map<string, {
      total_spend: number;
      product_count: number;
      latest_date: string;
    }>();

    products.forEach((product: ProductSummary) => {
      product.locations.forEach(location => {
        if (!locationMap.has(location)) {
          locationMap.set(location, {
            total_spend: 0,
            product_count: 0,
            latest_date: ''
          });
        }

        const loc = locationMap.get(location)!;
        loc.total_spend += product.total_spent;
        loc.product_count += 1;
        
        if (product.last_purchase_date > loc.latest_date) {
          loc.latest_date = product.last_purchase_date;
        }
      });
    });

    const result = Array.from(locationMap.entries()).map(([location_name, data]) => ({
      location_name,
      total_spend: data.total_spend,
      total_invoices: Math.round(data.product_count * 2.5), // Estimate
      avg_invoice_value: data.total_spend / Math.max(1, Math.round(data.product_count * 2.5)),
      unique_products: data.product_count,
      last_invoice_date: data.latest_date
    }));

    console.log('✅ Got location comparison:', result.length);
    return result;
  } catch (error) {
    console.error('❌ Error getting location comparison:', error);
    throw error;
  }
}

// Generate mock monthly trends based on available data
export async function getMonthlySpendTrends(months: number = 12): Promise<MonthlySpendTrend[]> {
  try {
    console.log('📅 Getting monthly trends...');
    
    const products = await getProductsSummary();
    if (!products || products.length === 0) {
      return [];
    }

    // Generate mock monthly data based on total spend
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const totalSpend = products.reduce((sum: number, p: ProductSummary) => sum + p.total_spent, 0);
    const currentDate = new Date();
    const trends: MonthlySpendTrend[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setMonth(date.getMonth() - i);
      
      // Generate realistic variation in spending
      const variation = 0.7 + (Math.random() * 0.6); // 70% to 130% variation
      const monthlySpend = (totalSpend / 14) * variation; // Assume 14 months of data
      
      trends.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        month_name: monthNames[date.getMonth()],
        total_spend: monthlySpend,
        invoice_count: Math.round(20 + Math.random() * 15), // 20-35 invoices per month
        avg_invoice_value: monthlySpend / Math.max(1, Math.round(20 + Math.random() * 15)),
        unique_products: Math.round(products.length * (0.6 + Math.random() * 0.3)) // 60-90% of products per month
      });
    }

    console.log('✅ Generated monthly trends:', trends.length);
    return trends;
  } catch (error) {
    console.error('❌ Error getting monthly trends:', error);
    throw error;
  }
}

// Generate recent activity from product data
export async function getRecentActivity(limit: number = 6): Promise<RecentActivity[]> {
  try {
    console.log('📋 Getting recent activity...');
    
    const products = await getProductsSummary();
    if (!products || products.length === 0) {
      return [];
    }

    // Get most recent purchases and create activity feed
    const recentProducts = products
      .filter((p: ProductSummary) => p.last_purchase_date)
      .sort((a: ProductSummary, b: ProductSummary) => new Date(b.last_purchase_date).getTime() - new Date(a.last_purchase_date).getTime())
      .slice(0, limit);

    const activities = recentProducts.map((product: ProductSummary, index: number) => ({
      invoice_date: product.last_purchase_date,
      location_name: product.locations[0] || 'Unknown',
      document_number: `INV${Date.now() + index}`, // Mock document number
      net_amount: Math.round(product.total_spent * 0.1), // Estimate 10% of total spend per invoice
      total_items: Math.round(5 + Math.random() * 15), // 5-20 items
      unique_products: Math.round(3 + Math.random() * 8), // 3-11 unique products
      processing_status: 'processed'
    }));

    console.log('✅ Generated recent activities:', activities.length);
    return activities;
  } catch (error) {
    console.error('❌ Error getting recent activity:', error);
    throw error;
  }
}