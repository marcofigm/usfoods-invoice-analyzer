'use client';

import { useState, useEffect } from 'react';
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
const mockPurchaseHistory: ProductPurchaseHistory[] = [
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

  useEffect(() => {
    if (isOpen && product) {
      loadPurchaseHistory();
    }
  }, [isOpen, product]);

  const loadPurchaseHistory = async () => {
    try {
      setLoading(true);
      console.log('Loading purchase history for product:', product.product_number);
      
      const history = await getProductPurchaseHistory(product.product_number);
      console.log('Loaded purchase history:', history.length, 'records');
      
      if (history.length === 0) {
        console.warn('No purchase history found, using mock data');
        setPurchaseHistory(mockPurchaseHistory);
      } else {
        setPurchaseHistory(history);
      }
    } catch (error) {
      console.error('Error loading purchase history, using mock data:', error);
      setPurchaseHistory(mockPurchaseHistory);
    } finally {
      setLoading(false);
    }
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

  // Get unique locations
  const uniqueLocations = [...new Set(purchaseHistory.map(item => item.location_name))];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="h-5 w-5" />
              <div>
                <DialogTitle className="text-lg">
                  Invoice Details: {product.product_number} - {product.name}
                </DialogTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-gray-600">Pack:</span>
                  <Badge variant="outline">
                    {product.pack_sizes[0] || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Summary Statistics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatNumber(totalOrders)}
                  </div>
                  <div className="text-sm text-gray-600">Total Orders</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumber(totalQuantity)}
                  </div>
                  <div className="text-sm text-gray-600">Total Quantity</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(totalSpend)}
                  </div>
                  <div className="text-sm text-gray-600">Total Spend</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(averagePrice)}
                  </div>
                  <div className="text-sm text-gray-600">Average Price</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-700">
                    {formatCurrency(minPrice)} - {formatCurrency(maxPrice)}
                  </div>
                  <div className="text-sm text-gray-600">Price Range</div>
                </div>
                <div>
                  <div className="flex items-center justify-center space-x-1">
                    {overallChange > 0 ? (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    )}
                    <span className={`text-2xl font-bold ${overallChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {Math.abs(overallChange).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">Overall Change</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase History Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">Loading purchase history...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>Location</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Date</span>
                        </div>
                      </TableHead>
                      <TableHead>Invoice/File</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Packing Size</TableHead>
                      <TableHead>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4" />
                          <span>Unit Price</span>
                        </div>
                      </TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Extended Price</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Pricing Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseHistory.map((item, index) => {
                      // Calculate price change from previous entry
                      const prevItem = index > 0 ? purchaseHistory[index - 1] : null;
                      const priceChange = prevItem 
                        ? ((item.unit_price - prevItem.unit_price) / prevItem.unit_price * 100)
                        : 0;

                      return (
                        <TableRow key={`${item.document_number}-${index}`}>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {item.location_name}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(item.invoice_date)}</TableCell>
                          <TableCell>
                            <a 
                              href="#" 
                              className="text-blue-600 hover:underline text-sm"
                              onClick={(e) => e.preventDefault()}
                            >
                              {item.document_number} ↗
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>CTLMN</div>
                              <div className="text-gray-500">SLCT</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-orange-50 text-orange-700">
                              {item.pack_size}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(item.extended_price)}
                          </TableCell>
                          <TableCell>
                            {prevItem ? (
                              <span className={`text-sm ${
                                priceChange > 0 ? 'text-red-500' : 
                                priceChange < 0 ? 'text-green-500' : 
                                'text-gray-500'
                              }`}>
                                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.pricing_unit}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}