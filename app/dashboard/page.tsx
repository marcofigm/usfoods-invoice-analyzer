'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { 
  Home, 
  Package, 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  MapPin,
  Target,
  TrendingUp as TrendingUpIcon,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  DashboardMetrics,
  SpendingByCategory,
  TopSpendingProducts,
  PriceAlert,
  LocationComparison,
  MonthlySpendTrend,
  PriceIncrease,
  PackSizeChange
} from '@/lib/supabase/analytics-simple';
import { ProductDetailModal } from '@/components/ProductDetailModal';
import { CategoryDetailModal } from '@/components/CategoryDetailModal';
import type { ProductSummary } from '@/lib/supabase/types';
import { getProductsSummary, supabase } from '@/lib/supabase/browser';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [categorySpending, setCategorySpending] = useState<SpendingByCategory[]>([]);
  const [topProducts, setTopProducts] = useState<TopSpendingProducts[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [locationComparison, setLocationComparison] = useState<LocationComparison[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlySpendTrend[]>([]);
  const [priceIncreases, setPriceIncreases] = useState<PriceIncrease[]>([]);
  const [packSizeChanges, setPackSizeChanges] = useState<PackSizeChange[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Loading dashboard analytics from real product data... [UPDATED VERSION - ', new Date().toISOString(), ']');
      
      // Get the exact same product data used in the products table
      console.log('1. Loading products from getProductsSummary...');
      const products = await getProductsSummary();
      
      if (!products || products.length === 0) {
        setError('No product data available');
        return;
      }

      // Store products in state for use in UI
      setProducts(products);
      
      console.log('✅ Loaded', products.length, 'products');
      console.log('Sample product data:', products[0]);
      
      
      // Get actual invoice count and metrics from database
      const { data: invoiceMetrics } = await supabase
        .from('invoices')
        .select('id, net_amount');
        
      const actualInvoiceCount = invoiceMetrics?.length || 0;
      const actualTotalSpend = invoiceMetrics?.reduce((sum, inv) => sum + (inv.net_amount || 0), 0) || 0;
      
      // Calculate metrics directly from the real product data
      const metricsData: DashboardMetrics = {
        totalProducts: products.length,
        totalInvoices: actualInvoiceCount,
        totalSpend: actualTotalSpend,
        totalLocations: [...new Set(products.flatMap((p: ProductSummary) => p.locations))].length,
        avgOrderValue: actualInvoiceCount > 0 ? actualTotalSpend / actualInvoiceCount : 0,
        avgProductsPerInvoice: 0
      };
      
      // Category spending - use actual invoice totals allocated proportionally
      console.log('🔧 Calculating category spending using invoice totals...');
      
      // First get line item totals by category (for proportional allocation)
      const categoryLineItemMap = new Map<string, { lineItemTotal: number; count: number }>();
      let totalLineItems = 0;
      
      products.forEach((product: ProductSummary) => {
        const category = product.category || 'Unknown';
        const spend = product.total_spent || 0;
        
        if (!categoryLineItemMap.has(category)) {
          categoryLineItemMap.set(category, { lineItemTotal: 0, count: 0 });
        }
        categoryLineItemMap.get(category)!.lineItemTotal += spend;
        categoryLineItemMap.get(category)!.count += 1;
        totalLineItems += spend;
      });
      
      // Allocate actual invoice totals proportionally to categories
      const categoryMap = new Map<string, { total: number; count: number }>();
      categoryLineItemMap.forEach((data, category) => {
        const proportion = totalLineItems > 0 ? data.lineItemTotal / totalLineItems : 0;
        const allocatedTotal = actualTotalSpend * proportion;
        categoryMap.set(category, {
          total: allocatedTotal,
          count: data.count
        });
      });
      
      console.log('✅ Line items total:', totalLineItems.toLocaleString());
      console.log('✅ Invoice total:', actualTotalSpend.toLocaleString());
      console.log('✅ Allocation factor:', actualTotalSpend / totalLineItems);
      
      const categoryData: SpendingByCategory[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        total_spend: data.total,
        product_count: data.count,
        percentage: actualTotalSpend > 0 ? (data.total / actualTotalSpend) * 100 : 0
      })).sort((a, b) => b.total_spend - a.total_spend);
      
      // Use the products data we already have sorted by total_spent
      console.log('🔧 Getting top spending products from loaded product data...');
      const finalTopProducts: TopSpendingProducts[] = products
        .filter((product: ProductSummary) => product.total_spent > 0) // Only products with spending
        .sort((a: ProductSummary, b: ProductSummary) => b.total_spent - a.total_spent) // Sort by total spend desc
        .slice(0, 8) // Take top 8
        .map((product: ProductSummary) => ({
          product_number: product.product_number,
          name: product.name,
          category: product.category,
          total_spend: product.total_spent,
          purchase_frequency: product.purchase_frequency,
          avg_price: product.avg_price,
          last_purchase_date: product.last_purchase_date
        }));
      
      console.log('✅ Top spending products:', finalTopProducts.length, 'found');
      if (finalTopProducts.length > 0) {
        console.log('✅ Top product:', finalTopProducts[0]?.name, 'spend:', finalTopProducts[0]?.total_spend?.toLocaleString());
        console.log('✅ All top products:', finalTopProducts.map(p => ({ name: p.name, spend: p.total_spend })));
      } else {
        console.warn('⚠️ No top products found - check if products have total_spent > 0');
      }
      
      // Get actual price alerts from database
      const { data: dbAlerts } = await supabase
        .from('price_alerts')
        .select(`
          id,
          product_number,
          alert_level,
          current_price,
          threshold_price,
          price_change_percent,
          created_at,
          products (name, category)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
        
      const alertsData: PriceAlert[] = (dbAlerts || []).map((alert: Record<string, unknown>) => ({
        product_number: alert.product_number as string,
        name: ((alert.products as Record<string, unknown>)?.name as string) || 'Unknown Product',
        category: ((alert.products as Record<string, unknown>)?.category as string) || 'Unknown',
        current_price: alert.current_price as number,
        previous_price: alert.threshold_price as number,
        price_change: (alert.current_price as number) - (alert.threshold_price as number),
        price_change_percent: alert.price_change_percent as number,
        last_purchase_date: new Date(alert.created_at as string).toISOString().split('T')[0],
        location_name: 'Various' // Price alerts are system-wide
      }));
      
      console.log('📊 Loaded', alertsData.length, 'actual price alerts from database');
      
      // Get REAL location comparison from actual invoice data
      console.log('📍 Getting REAL location performance from invoices...');
      const { getLocationComparison } = await import('@/lib/supabase/analytics-simple');
      const locationsData = await getLocationComparison();
      
      // Get REAL monthly trends from actual invoice data
      console.log('📊 Getting REAL monthly trends from invoices...');
      const { getMonthlySpendTrends } = await import('@/lib/supabase/analytics-simple');
      const trendsData = await getMonthlySpendTrends(12);
      
      // Get segmented price analysis (real increases + pack size changes)
      console.log('📈 Getting segmented price analysis...');
      const { getCombinedPriceAnalysis } = await import('@/lib/supabase/analytics-simple');
      const { increases: increaseData, packChanges: packChangeData } = await getCombinedPriceAnalysis();

      setMetrics(metricsData);
      setCategorySpending(categoryData.slice(0, 6)); // Top 6 categories
      setTopProducts(finalTopProducts); // Use corrected data
      setPriceAlerts(alertsData.slice(0, 5)); // Top 5 alerts
      setLocationComparison(locationsData);
      setMonthlyTrends(trendsData);
      setPriceIncreases(increaseData);
      setPackSizeChanges(packChangeData);
      
      console.log('✅ Dashboard data loaded successfully');
    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Chart colors
  const chartColors = ['#f29d2c', '#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c'];

  // Find the actual ProductSummary from the original data to ensure consistency
  const handleProductClick = async (topProduct: TopSpendingProducts) => {
    try {
      console.log('🔍 Finding actual product data for:', topProduct.product_number);
      
      // Get the fresh product summaries to find the exact matching product
      const allProducts = await getProductsSummary();
      const actualProduct = allProducts.find((p: ProductSummary) => p.product_number === topProduct.product_number);
      
      if (actualProduct) {
        console.log('✅ Found actual product data:', actualProduct.product_number, 'spend:', actualProduct.total_spent);
        setSelectedProduct(actualProduct);
      } else {
        console.warn('⚠️ Product not found in summaries');
      }
    } catch (error) {
      console.error('❌ Error finding product data:', error);
    }
  };

  // Handle category click to show products in that category
  const handleCategoryClick = async (categoryData: SpendingByCategory) => {
    try {
      console.log('🔍 Loading products for category:', categoryData.category);
      
      // Get all products and filter by category
      const allProducts = await getProductsSummary();
      const productsInCategory = allProducts.filter(
        (product: ProductSummary) => product.category === categoryData.category
      );
      
      console.log('✅ Found', productsInCategory.length, 'products in category', categoryData.category);
      
      setCategoryProducts(productsInCategory);
      setSelectedCategory(categoryData.category);
    } catch (error) {
      console.error('❌ Error loading category products:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <Card key={i} className="bg-white">
                <CardContent className="p-6">
                  <div className="h-16 bg-gray-100 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1,2].map(i => (
              <Card key={i} className="bg-white">
                <CardContent className="p-6">
                  <div className="h-64 bg-gray-100 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <Card className="bg-white border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Error loading dashboard</span>
            </div>
            <p className="text-red-500 mt-2">{error}</p>
            <Button 
              onClick={loadDashboardData}
              className="mt-4"
              style={{ backgroundColor: '#f29d2c' }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Home className="h-6 w-6 text-white" />
            <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
            <Badge variant="secondary">Los Pinos Analytics</Badge>
          </div>
          <Button 
            onClick={loadDashboardData}
            variant="outline"
            size="sm"
            className="bg-white text-gray-600 hover:bg-gray-50"
          >
            <Target className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <Card className="bg-white border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Products</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatNumber(metrics?.totalProducts || 0)}
                  </p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatNumber(metrics?.totalInvoices || 0)}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Spend</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(metrics?.totalSpend || 0)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Locations</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatNumber(metrics?.totalLocations || 0)}
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-l-indigo-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Order</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(metrics?.avgOrderValue || 0)}
                  </p>
                </div>
                <Target className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Price Alerts</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatNumber(priceAlerts.length)}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Spend Trends */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <span>Monthly Spend Trends</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month_name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tickFormatter={formatCurrency}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: string | number) => [formatCurrency(Number(value)), 'Total Spend']}
                      labelStyle={{ color: '#374151' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total_spend" 
                      stroke="#f29d2c" 
                      fill="#f29d2c" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Spending Breakdown */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <span>Spending by Category</span>
                </div>
                <div className="text-xs text-gray-500 flex items-center space-x-1">
                  <Eye className="h-3 w-3" />
                  <span>Click to view products • Totals match dashboard spend</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySpending}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="total_spend"
                      label={({ category, percentage }) => 
                        `${category} (${percentage.toFixed(1)}%)`
                      }
                      labelLine={false}
                      fontSize={12}
                      onClick={handleCategoryClick}
                      style={{ cursor: 'pointer' }}
                    >
                      {categorySpending.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: string | number) => [formatCurrency(Number(value)), 'Total Spend']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Alerts Section */}
        {priceAlerts.length > 0 && (
          <Card className="bg-white border-l-4 border-l-red-500">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Price Alerts</span>
                <Badge variant="destructive">{priceAlerts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {priceAlerts.map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{alert.name}</h4>
                        <Badge variant="outline" className="text-xs">{alert.product_number}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {alert.location_name} • {formatDate(alert.last_purchase_date)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">Was:</span>
                          <span className="font-medium">{formatCurrency(alert.previous_price)}</span>
                          {alert.price_change > 0 ? (
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium">{formatCurrency(alert.current_price)}</span>
                        </div>
                        <div className={`text-sm font-medium ${
                          alert.price_change_percent > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {alert.price_change_percent > 0 ? '+' : ''}
                          {alert.price_change_percent.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Spending Products */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-orange-600" />
                <span>Top Spending Products</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Loading products...</div>
                  </div>
                ) : topProducts.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">No spending data available</div>
                  </div>
                ) : (
                  topProducts.map((product, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border border-transparent hover:border-orange-200"
                    onClick={() => handleProductClick(product)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
                        <h4 className="font-medium text-gray-900 text-sm">
                          {product.name.length > 40 ? `${product.name.substring(0, 40)}...` : product.name}
                        </h4>
                        <Eye className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">{product.product_number}</Badge>
                        <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">
                        {formatCurrency(product.total_spend)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {product.purchase_frequency} orders • {formatCurrency(product.avg_price)} avg
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Price Increases - Segmented Analysis */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUpIcon className="h-5 w-5 text-red-600" />
                  <span>Price Increases</span>
                </div>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  Same Pack Size Only
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {priceIncreases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUpIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No real price increases found</p>
                    <p className="text-sm mt-1">Products with &gt;5% increases (same pack) will appear here</p>
                  </div>
                ) : (
                  priceIncreases.map((increase, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                         onClick={() => {
                           const product = products.find(p => p.product_number === increase.product_number);
                           if (product) setSelectedProduct(product);
                         }}>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-red-600" />
                          <span className="font-medium text-gray-900">
                            {increase.name.length > 25 ? `${increase.name.substring(0, 25)}...` : increase.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {increase.category}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {increase.product_number}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <Badge variant="secondary" className="text-xs">
                            {increase.pack_size}
                          </Badge>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">
                            {increase.purchase_frequency} orders
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <ArrowUpRight className="h-4 w-4 text-red-600" />
                          <span className="font-bold text-red-600">
                            +{increase.price_increase_percent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatCurrency(increase.previous_price)} → {formatCurrency(increase.current_price)}
                        </div>
                        <div className="text-xs text-gray-500">
                          +{formatCurrency(increase.price_increase)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pack Size Changes Section */}
              {packSizeChanges.length > 0 && (
                <>
                  <hr className="my-4" />
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Pack Size Changes</span>
                      <Badge variant="secondary" className="text-xs">
                        New Options
                      </Badge>
                    </div>
                    {packSizeChanges.map((change, index) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                           onClick={() => {
                             const product = products.find(p => p.product_number === change.product_number);
                             if (product) setSelectedProduct(product);
                           }}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                {change.name.length > 30 ? `${change.name.substring(0, 30)}...` : change.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {change.category}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {change.product_number}
                              </span>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-blue-600">
                                {change.pack_sizes.length} pack options
                              </span>
                            </div>
                          </div>
                          <div className="text-right text-xs text-gray-600">
                            <div>Best Value: {change.best_value_pack}</div>
                            <div>Current: {change.current_pack}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Location Comparison */}
        {locationComparison.length > 1 && (
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-purple-600" />
                <span>Location Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locationComparison.map((location, index) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900">{location.location_name}</h3>
                      <MapPin className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Spend:</span>
                        <span className="font-medium">{formatCurrency(location.total_spend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Invoices:</span>
                        <span className="font-medium">{formatNumber(location.total_invoices)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Avg Invoice:</span>
                        <span className="font-medium">{formatCurrency(location.avg_invoice_value)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Last Order:</span>
                        <span className="font-medium">{formatDate(location.last_invoice_date)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}

        {/* Category Detail Modal */}
        {selectedCategory && (
          <CategoryDetailModal
            category={selectedCategory}
            products={categoryProducts}
            isOpen={!!selectedCategory}
            onClose={() => {
              setSelectedCategory(null);
              setCategoryProducts([]);
            }}
            onProductClick={(product) => {
              setSelectedProduct(product);
              setSelectedCategory(null);
              setCategoryProducts([]);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}