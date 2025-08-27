'use client';

import { useState, useEffect, useCallback } from 'react';
// Temporarily disabled - causing Supabase connection errors
// import { 
//   getProductsSummary, 
//   getProductPurchaseHistory,
//   getProductCategories,
//   getLocations
// } from '../../../lib/supabase/queries';
import type { 
  ProductSummary, 
  ProductPurchaseHistory,
  Location 
} from '../../../lib/supabase/types';

export default function ProductsPrototypePage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<ProductPurchaseHistory[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      // Mock products data temporarily
      const mockProducts: ProductSummary[] = [
        {
          id: '1',
          product_number: '8534723',
          name: 'BEEF, PLATE INS SKIRT CHO 121D',
          category: 'Protein',
          last_price: 7.74,
          last_purchase_date: '2024-08-25',
          purchase_frequency: 831,
          total_spent: 1143212.47,
          pack_sizes: ['4/5 LBA'],
          locations: ['Bee Caves', '360']
        },
        {
          id: '2',
          product_number: '4064044',
          name: 'CHEESE, AMER LOAF PROCD YLW EX',
          category: 'Dairy',
          last_price: 82.09,
          last_purchase_date: '2024-08-20',
          purchase_frequency: 911,
          total_spent: 506749.16,
          pack_sizes: ['6/5 LB'],
          locations: ['Bee Caves', '360']
        }
      ];

      setProducts(mockProducts);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Failed to load products');
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Mock data temporarily
      const categoriesData = ['Protein', 'Dairy', 'Produce', 'Dry Goods'];
      const locationsData = [
        { id: '1', name: 'Bee Caves', restaurant_id: '1', address_line1: '', city: '', state: '', postal_code: '', phone: '', created_at: '' },
        { id: '2', name: '360', restaurant_id: '1', address_line1: '', city: '', state: '', postal_code: '', phone: '', created_at: '' }
      ];

      setCategories(categoriesData);
      setLocations(locationsData);
      
      await loadProducts();
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  }, [loadProducts]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load products when filters change
  useEffect(() => {
    loadProducts();
  }, [searchTerm, selectedCategory, selectedLocation, loadProducts]);

  const handleProductClick = async (product: ProductSummary) => {
    try {
      setSelectedProduct(product);
      setHistoryLoading(true);
      
      // Mock purchase history temporarily
      const mockHistory: ProductPurchaseHistory[] = [
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
          invoice_date: '2024-06-20',
          location_name: '360',
          document_number: '20240620210548881317.csv',
          pack_size: '4/5 LBA',
          quantity: 4,
          unit_price: 9.17,
          extended_price: 748.64,
          pricing_unit: 'LB'
        }
      ];
      
      setPurchaseHistory(mockHistory);
    } catch (err) {
      console.error('Error loading purchase history:', err);
      setError('Failed to load purchase history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Los Pinos Products Prototype</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading products...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Los Pinos Products Prototype</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Los Pinos Products Analysis</h1>
      
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">{products.length}</div>
          <div className="text-blue-600">Total Products</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-700">{categories.length}</div>
          <div className="text-green-600">Categories</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">{locations.length}</div>
          <div className="text-purple-600">Locations</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-orange-700">
            {formatCurrency(products.reduce((sum, p) => sum + p.total_spent, 0))}
          </div>
          <div className="text-orange-600">Total Spent</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search Products</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or product number..."
              className="w-full p-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="">All Locations</option>
              {locations.map(location => (
                <option key={location.id} value={location.name}>{location.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Products ({products.length})</h2>
          <p className="text-gray-600">Click on any product to see detailed purchase history</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Purchase</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locations</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr 
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.product_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(product.last_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(product.last_purchase_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.purchase_frequency} orders
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(product.total_spent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.locations.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedProduct.name}</h2>
                <p className="text-gray-600">{selectedProduct.product_number}</p>
                <div className="flex gap-2 mt-2">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {selectedProduct.category}
                  </span>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {selectedProduct.purchase_frequency} orders
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-lg font-bold text-blue-700">{formatCurrency(selectedProduct.last_price)}</div>
                <div className="text-blue-600 text-sm">Last Price</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-lg font-bold text-green-700">{formatCurrency(selectedProduct.total_spent)}</div>
                <div className="text-green-600 text-sm">Total Spent</div>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <div className="text-lg font-bold text-purple-700">{selectedProduct.pack_sizes.length}</div>
                <div className="text-purple-600 text-sm">Pack Sizes</div>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <div className="text-lg font-bold text-orange-700">{selectedProduct.locations.length}</div>
                <div className="text-orange-600 text-sm">Locations</div>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-3">Complete Purchase History</h3>
            
            {historyLoading ? (
              <div className="text-center py-8">Loading purchase history...</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pack Size</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {purchaseHistory.map((purchase, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{formatDate(purchase.invoice_date)}</td>
                        <td className="px-4 py-2 text-sm">{purchase.location_name}</td>
                        <td className="px-4 py-2 text-sm">{purchase.pack_size}</td>
                        <td className="px-4 py-2 text-sm">{purchase.quantity}</td>
                        <td className="px-4 py-2 text-sm">{formatCurrency(purchase.unit_price)}</td>
                        <td className="px-4 py-2 text-sm font-medium">{formatCurrency(purchase.extended_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {purchaseHistory.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No purchase history found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}