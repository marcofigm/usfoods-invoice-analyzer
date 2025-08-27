'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, Package, MapPin, Calendar, DollarSign, BarChart3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import type { ProductSummary, ProductPurchaseHistory } from '@/lib/supabase/types';
import { getProductPurchaseHistory } from '@/lib/supabase/browser';

interface ProductDetailModalProps {
  product: ProductSummary;
  isOpen: boolean;
  onClose: () => void;
}

// Mock purchase history data - replace with actual API call
const _mockPurchaseHistory: ProductPurchaseHistory[] = [
  {
    invoice_date: '2024-06-25',
    location_name: 'Bee Caves',
    document_number: '20240625210637817581.csv',
    pack_size: '4/5 LBA',
    quantity: 10,
    unit_price: 9.31,
    extended_price: 1910.97,
    pricing_unit: 'LB'
  },
  {
    invoice_date: '2024-06-25',
    location_name: 'Round Rock',
    document_number: '20240625210548881317.csv',
    pack_size: '4/5 LBA',
    quantity: 4,
    unit_price: 9.17,
    extended_price: 748.64,
    pricing_unit: 'LB'
  },
  {
    invoice_date: '2024-06-25',
    location_name: 'William Cannon',
    document_number: '20240625210630816961.csv',
    pack_size: '4/5 LBA',
    quantity: 6,
    unit_price: 9.17,
    extended_price: 1121.67,
    pricing_unit: 'LB'
  },
  {
    invoice_date: '2024-06-25',
    location_name: 'New Braunfels',
    document_number: '20240625210714822461.csv',
    pack_size: '4/5 LBA',
    quantity: 7,
    unit_price: 9.17,
    extended_price: 1336.07,
    pricing_unit: 'LB'
  },
  {
    invoice_date: '2024-06-25',
    location_name: 'Kyle',
    document_number: '20240625210701820511.csv',
    pack_size: '4/5 LBA',
    quantity: 6,
    unit_price: 9.17,
    extended_price: 1129.19,
    pricing_unit: 'LB'
  }
];

export function ProductDetailModal({ product, isOpen, onClose }: ProductDetailModalProps) {
  const [purchaseHistory, setPurchaseHistory] = useState<ProductPurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPurchaseHistory = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Loading purchase history for product:', product.product_number);
      
      const history = await getProductPurchaseHistory(product.product_number);
      console.log('Loaded purchase history:', history.length, 'records');
      
      if (history.length === 0) {
        console.warn('No purchase history found for product:', product.product_number);
        setPurchaseHistory([]);
      } else {
        console.log('✅ Successfully loaded', history.length, 'purchase records');
        setPurchaseHistory(history);
      }
    } catch (error) {
      console.error('❌ Error loading purchase history:', error);
      setPurchaseHistory([]);
    } finally {
      setLoading(false);
    }
  }, [product.product_number]);

  useEffect(() => {
    if (isOpen && product) {
      loadPurchaseHistory();
    }
  }, [isOpen, product, loadPurchaseHistory]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate summary statistics from purchase history
  const totalOrders = purchaseHistory.length;
  const totalQuantity = purchaseHistory.reduce((sum, item) => sum + item.quantity, 0);
  const totalSpend = purchaseHistory.reduce((sum, item) => sum + item.extended_price, 0);
  const averagePrice = totalQuantity > 0 
    ? purchaseHistory.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) / totalQuantity 
    : 0;

  // Calculate price range
  const prices = purchaseHistory.map(item => item.unit_price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const overallChange = prices.length > 0 && minPrice > 0 
    ? ((maxPrice - minPrice) / minPrice * 100) 
    : 0;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-[95vw] max-w-none h-[95vh] overflow-hidden p-0 bg-white shadow-2xl border border-gray-200 rounded-xl !max-w-none"
        showCloseButton={false}
      >
        {/* Header Section */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-100 border-b px-6 py-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold text-gray-900">
                    Invoice Details: {product.product_number}
                  </DialogTitle>
                  <p className="text-sm text-gray-600 mt-1 font-medium">{product.name}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-sm text-gray-500">Pack Size:</span>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                      {product.pack_sizes[0] || 'N/A'}
                    </Badge>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-gray-200 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </DialogHeader>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Summary Statistics */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg border-b">
              <CardTitle className="flex items-center space-x-2 text-gray-800">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span>Summary Statistics</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-3xl font-bold text-blue-600">
                    {formatNumber(totalOrders)}
                  </div>
                  <div className="text-sm text-blue-700 font-medium mt-1">Total Orders</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-3xl font-bold text-green-600">
                    {formatNumber(totalQuantity)}
                  </div>
                  <div className="text-sm text-green-700 font-medium mt-1">Total Quantity</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="text-3xl font-bold text-purple-600">
                    {formatCurrency(totalSpend)}
                  </div>
                  <div className="text-sm text-purple-700 font-medium mt-1">Total Spend</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="text-3xl font-bold text-orange-600">
                    {formatCurrency(averagePrice)}
                  </div>
                  <div className="text-sm text-orange-700 font-medium mt-1">Average Price</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-lg font-bold text-gray-700">
                    {formatCurrency(minPrice)}
                  </div>
                  <div className="text-sm text-gray-400">to</div>
                  <div className="text-lg font-bold text-gray-700">
                    {formatCurrency(maxPrice)}
                  </div>
                  <div className="text-sm text-gray-600 font-medium mt-1">Price Range</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-center space-x-1">
                    {overallChange > 0 ? (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    )}
                    <span className={`text-2xl font-bold ${overallChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {Math.abs(overallChange).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 font-medium mt-1">Overall Change</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase History Table */}
          <Card className="border-0 shadow-md">
            <div className="bg-gradient-to-r from-slate-50 to-gray-100 px-6 py-4 rounded-t-lg border-b">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <span>Purchase History</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center space-x-2 text-gray-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span>Loading purchase history...</span>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead className="font-semibold text-gray-700">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>Location</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Date</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">Invoice/File</TableHead>
                      <TableHead className="font-semibold text-gray-700">Pack Size</TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4" />
                          <span>Unit Price</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700 text-center">Quantity</TableHead>
                      <TableHead className="font-semibold text-gray-700">Extended Price</TableHead>
                      <TableHead className="font-semibold text-gray-700 text-center">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseHistory.map((item, index) => {
                      // Calculate price change properly - since data is chronologically sorted,
                      // we want to compare with the previous chronological purchase (index - 1)
                      const prevItem = index > 0 ? purchaseHistory[index - 1] : null;
                      
                      // Fix price change calculation to handle edge cases
                      let priceChange: number | null = 0;
                      if (prevItem && prevItem.unit_price > 0 && item.unit_price >= 0) {
                        priceChange = ((item.unit_price - prevItem.unit_price) / prevItem.unit_price * 100);
                      } else if (prevItem && prevItem.unit_price === 0 && item.unit_price > 0) {
                        // New price after zero price - show as "New Price" instead of infinity
                        priceChange = null; // Will display as "New"
                      } else if (prevItem && prevItem.unit_price > 0 && item.unit_price === 0) {
                        priceChange = -100; // Price dropped to zero
                      }

                      return (
                        <TableRow key={`${item.document_number}-${index}`} className="hover:bg-slate-50">
                          <TableCell>
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">
                              {item.location_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-gray-700">
                            {formatDate(item.invoice_date)}
                          </TableCell>
                          <TableCell>
                            <a 
                              href="#" 
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium transition-colors"
                              onClick={(e) => e.preventDefault()}
                            >
                              {item.document_number.split('.')[0]} ↗
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-medium">
                              {item.pack_size}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-gray-900">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-gray-700">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="font-bold text-gray-900">
                            {formatCurrency(item.extended_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            {prevItem ? (
                              priceChange === null ? (
                                // Handle "New Price" case (after zero price)
                                <div className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                                  <Package className="h-3 w-3" />
                                  <span>New</span>
                                </div>
                              ) : (
                                // Handle normal price changes
                                <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                  priceChange > 0 ? 'bg-red-50 text-red-700' : 
                                  priceChange < 0 ? 'bg-green-50 text-green-700' : 
                                  'bg-gray-50 text-gray-600'
                                }`}>
                                  {priceChange > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : priceChange < 0 ? (
                                    <TrendingDown className="h-3 w-3" />
                                  ) : null}
                                  <span>
                                    {priceChange > 0 ? '+' : ''}{Math.abs(priceChange) < 0.1 ? '0.0' : priceChange.toFixed(1)}%
                                  </span>
                                </div>
                              )
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}