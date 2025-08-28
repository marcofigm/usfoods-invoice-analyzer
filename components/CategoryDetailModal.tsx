'use client';

import React from 'react';
import { X, Package, DollarSign, TrendingUp, Eye } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import type { ProductSummary } from '@/lib/supabase/types';

interface CategoryDetailModalProps {
  category: string;
  products: ProductSummary[];
  isOpen: boolean;
  onClose: () => void;
  onProductClick: (product: ProductSummary) => void;
}

export function CategoryDetailModal({ 
  category, 
  products, 
  isOpen, 
  onClose,
  onProductClick 
}: CategoryDetailModalProps) {
  if (!isOpen) return null;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate category totals
  const categoryTotal = products.reduce((sum, product) => sum + product.total_spent, 0);
  const totalTransactions = products.reduce((sum, product) => sum + product.purchase_frequency, 0);
  const avgProductSpend = products.length > 0 ? categoryTotal / products.length : 0;

  // Sort products by total spend (highest first)
  const sortedProducts = [...products].sort((a, b) => b.total_spent - a.total_spent);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="h-6 w-6" />
              <div>
                <h2 className="text-2xl font-bold">{category} Products</h2>
                <p className="text-blue-100">
                  {products.length} products • {formatCurrency(categoryTotal)} total spend
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-blue-800"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Category Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm font-medium">Total Spend</span>
              </div>
              <div className="text-2xl font-bold mt-1">{formatCurrency(categoryTotal)}</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium">Total Orders</span>
              </div>
              <div className="text-2xl font-bold mt-1">{totalTransactions.toLocaleString()}</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span className="text-sm font-medium">Avg per Product</span>
              </div>
              <div className="text-2xl font-bold mt-1">{formatCurrency(avgProductSpend)}</div>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="p-6 overflow-y-auto max-h-96">
          <h3 className="text-lg font-semibold mb-4">Products in {category}</h3>
          
          {sortedProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No products found in this category
            </div>
          ) : (
            <div className="space-y-3">
              {sortedProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors border border-transparent hover:border-blue-200"
                  onClick={() => onProductClick(product)}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {product.name.length > 50 ? `${product.name.substring(0, 50)}...` : product.name}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {product.product_number}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {product.purchase_frequency} orders
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">
                            Last: {formatDate(product.last_purchase_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center space-x-3">
                    <div>
                      <div className="font-bold text-gray-900">
                        {formatCurrency(product.total_spent)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(product.avg_price || 0)} avg
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Click on any product to view detailed purchase history
            </span>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}