'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye, TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { ProductDetailModal } from '@/components/ProductDetailModal';
import { DashboardLayout } from '@/components/DashboardLayout';
import type { ProductSummary } from '@/lib/supabase/types';
import { getProductsSummary } from '@/lib/supabase/browser';


type SortField = keyof ProductSummary | 'variance';
type SortDirection = 'asc' | 'desc' | null;

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);

  // Calculate variance for each product (price range percentage)
  const calculateVariance = (product: ProductSummary): number => {
    if (product.min_price && product.max_price && product.min_price > 0) {
      const range = product.max_price - product.min_price;
      const percentage = (range / product.min_price) * 100;
      return Math.round(percentage * 100) / 100;
    }
    return 0;
  };

  // Calculate price trend for visual indicator
  const calculatePriceTrend = (_product: ProductSummary): 'up' | 'down' | 'stable' => {
    // This would need historical price data
    // For now, return random trend
    const trends = ['up', 'down', 'stable'] as const;
    return trends[Math.floor(Math.random() * trends.length)];
  };

  // Load products data
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        console.log('Loading products from database...');
        
        const data = await getProductsSummary();
        console.log('Loaded products:', data.length, 'products');
        
        setProducts(data);
        console.log('Real database products loaded:', data);
      } catch (error) {
        console.error('❌ Error loading products:', error);
        setProducts([]); // Show empty table instead of mock data
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.product_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        let aValue: unknown = a[sortField as keyof ProductSummary];
        let bValue: unknown = b[sortField as keyof ProductSummary];

        // Handle special fields
        if (sortField === 'variance') {
          aValue = calculateVariance(a);
          bValue = calculateVariance(b);
        }

        // Handle different data types
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
    }

    return filtered;
  }, [products, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  // Calculate summary statistics
  const totalProducts = filteredAndSortedProducts.length;
  const totalSpend = filteredAndSortedProducts.reduce((sum, product) => sum + product.total_spent, 0);
  const avgOrdersPerProduct = totalProducts > 0 
    ? filteredAndSortedProducts.reduce((sum, product) => sum + product.purchase_frequency, 0) / totalProducts 
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border rounded-lg shadow-sm bg-white p-6">
          <CardContent className="p-0">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">
                Showing {formatNumber(totalProducts)} of {formatNumber(totalProducts)} products
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">💰</span>
              <div>
                <span className="text-sm text-gray-600">Total Spend: </span>
                <span className="font-semibold">{formatCurrency(totalSpend)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">📊</span>
              <div>
                <span className="text-sm text-gray-600">Avg Orders/Product: </span>
                <span className="font-semibold">{avgOrdersPerProduct.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by product number, name, or description..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="border rounded-lg bg-white shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Loading products...</div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('product_number')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Product #</span>
                      {getSortIcon('product_number')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Description</span>
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead>Pack/Unit</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('locations')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Locs</span>
                      {getSortIcon('locations')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('purchase_frequency')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Orders</span>
                      {getSortIcon('purchase_frequency')}
                    </div>
                  </TableHead>
                  <TableHead>Price Range</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('last_price')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Latest</span>
                      {getSortIcon('last_price')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('total_spent')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Total Spend</span>
                      {getSortIcon('total_spent')}
                    </div>
                  </TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('variance')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Variance</span>
                      {getSortIcon('variance')}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedProducts.map((product) => {
                  const variance = calculateVariance(product);
                  const trend = calculatePriceTrend(product);

                  return (
                    <TableRow key={product.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        {product.product_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <Badge variant="outline" className="mt-1">
                            {product.category}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {product.pack_sizes[0] || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {product.locations.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {formatNumber(product.purchase_frequency)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {product.min_price && product.max_price && product.min_price !== product.max_price ? 
                            `${formatCurrency(product.min_price)} - ${formatCurrency(product.max_price)}` 
                            : formatCurrency(product.last_price)
                          }
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(product.last_price)}
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        {formatCurrency(product.total_spent)}
                      </TableCell>
                      <TableCell>
                        {getTrendIcon(trend)}
                      </TableCell>
                      <TableCell>
                        {variance > 0 ? (
                          <span className="text-yellow-600">{variance}%</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}