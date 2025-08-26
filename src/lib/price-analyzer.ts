import { ParsedInvoice, ParsedLineItem } from './csv-parser'

export interface PriceChange {
  productNumber: string
  productDescription: string
  previousPrice: number
  newPrice: number
  percentageChange: number
  changeType: 'increase' | 'decrease'
  invoiceDate: string
  previousInvoiceDate: string
}

export interface PriceAlert {
  productNumber: string
  productDescription: string
  currentPrice: number
  averagePrice: number
  deviation: number
  alertType: 'significant_increase' | 'significant_decrease' | 'unusual_pricing'
  threshold: number
}

export interface ProductPriceHistory {
  productNumber: string
  productDescription: string
  prices: Array<{
    price: number
    date: string
    invoiceNumber: string
  }>
  averagePrice: number
  minPrice: number
  maxPrice: number
  priceVolatility: number
}

/**
 * Analyzes price changes across invoices for all products
 */
export function analyzePriceChanges(
  invoices: ParsedInvoice[], 
  threshold: number = 20
): PriceChange[] {
  const priceChanges: PriceChange[] = []
  const productPrices = new Map<string, Array<{ price: number; date: string; invoiceDate: string }>>()
  
  // Sort invoices by date
  const sortedInvoices = [...invoices].sort((a, b) => 
    new Date(a.documentDate).getTime() - new Date(b.documentDate).getTime()
  )
  
  // Collect all prices by product
  for (const invoice of sortedInvoices) {
    for (const item of invoice.lineItems) {
      if (!productPrices.has(item.productNumber)) {
        productPrices.set(item.productNumber, [])
      }
      
      productPrices.get(item.productNumber)!.push({
        price: item.unitPrice,
        date: invoice.documentDate,
        invoiceDate: invoice.documentDate
      })
    }
  }
  
  // Analyze price changes for each product
  for (const [productNumber, prices] of productPrices) {
    if (prices.length < 2) continue
    
    // Sort prices by date
    prices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    for (let i = 1; i < prices.length; i++) {
      const current = prices[i]
      const previous = prices[i - 1]
      
      // Skip if same price
      if (current.price === previous.price) continue
      
      const percentageChange = ((current.price - previous.price) / previous.price) * 100
      
      // Only alert if change exceeds threshold
      if (Math.abs(percentageChange) >= threshold) {
        // Get product description from the first invoice that contains this product
        let productDescription = ''
        for (const invoice of sortedInvoices) {
          const item = invoice.lineItems.find(li => li.productNumber === productNumber)
          if (item) {
            productDescription = item.productDescription
            break
          }
        }
        
        priceChanges.push({
          productNumber,
          productDescription,
          previousPrice: previous.price,
          newPrice: current.price,
          percentageChange: Math.round(percentageChange * 100) / 100,
          changeType: percentageChange > 0 ? 'increase' : 'decrease',
          invoiceDate: current.date,
          previousInvoiceDate: previous.date
        })
      }
    }
  }
  
  return priceChanges.sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
}

/**
 * Generates price alerts for products with unusual pricing patterns
 */
export function generatePriceAlerts(invoices: ParsedInvoice[]): PriceAlert[] {
  const alerts: PriceAlert[] = []
  const productStats = calculateProductStats(invoices)
  
  for (const [productNumber, stats] of productStats) {
    const latestPrice = stats.prices[stats.prices.length - 1]?.price || 0
    
    // Alert if current price deviates significantly from average
    const deviationPercent = Math.abs(((latestPrice - stats.averagePrice) / stats.averagePrice) * 100)
    
    if (deviationPercent > 30) { // 30% deviation threshold
      let productDescription = ''
      for (const invoice of invoices) {
        const item = invoice.lineItems.find(li => li.productNumber === productNumber)
        if (item) {
          productDescription = item.productDescription
          break
        }
      }
      
      alerts.push({
        productNumber,
        productDescription,
        currentPrice: latestPrice,
        averagePrice: stats.averagePrice,
        deviation: deviationPercent,
        alertType: latestPrice > stats.averagePrice ? 'significant_increase' : 'significant_decrease',
        threshold: 30
      })
    }
    
    // Alert for high price volatility
    if (stats.priceVolatility > 25) { // High volatility threshold
      let productDescription = ''
      for (const invoice of invoices) {
        const item = invoice.lineItems.find(li => li.productNumber === productNumber)
        if (item) {
          productDescription = item.productDescription
          break
        }
      }
      
      alerts.push({
        productNumber,
        productDescription,
        currentPrice: latestPrice,
        averagePrice: stats.averagePrice,
        deviation: stats.priceVolatility,
        alertType: 'unusual_pricing',
        threshold: 25
      })
    }
  }
  
  return alerts.sort((a, b) => b.deviation - a.deviation)
}

/**
 * Calculates comprehensive statistics for all products
 */
function calculateProductStats(invoices: ParsedInvoice[]): Map<string, ProductPriceHistory> {
  const productStats = new Map<string, ProductPriceHistory>()
  
  // Collect all price data
  for (const invoice of invoices) {
    for (const item of invoice.lineItems) {
      if (!productStats.has(item.productNumber)) {
        productStats.set(item.productNumber, {
          productNumber: item.productNumber,
          productDescription: item.productDescription,
          prices: [],
          averagePrice: 0,
          minPrice: Infinity,
          maxPrice: -Infinity,
          priceVolatility: 0
        })
      }
      
      const stats = productStats.get(item.productNumber)!
      stats.prices.push({
        price: item.unitPrice,
        date: invoice.documentDate,
        invoiceNumber: invoice.documentNumber
      })
    }
  }
  
  // Calculate statistics
  for (const [productNumber, stats] of productStats) {
    if (stats.prices.length === 0) continue
    
    // Sort prices by date
    stats.prices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    // Calculate basic stats
    const prices = stats.prices.map(p => p.price)
    stats.averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
    stats.minPrice = Math.min(...prices)
    stats.maxPrice = Math.max(...prices)
    
    // Calculate price volatility (coefficient of variation)
    if (stats.averagePrice > 0) {
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - stats.averagePrice, 2), 0) / prices.length
      const standardDeviation = Math.sqrt(variance)
      stats.priceVolatility = (standardDeviation / stats.averagePrice) * 100
    }
  }
  
  return productStats
}

/**
 * Finds products with the most volatile pricing
 */
export function findVolatileProducts(invoices: ParsedInvoice[], limit: number = 10): ProductPriceHistory[] {
  const productStats = calculateProductStats(invoices)
  
  return Array.from(productStats.values())
    .filter(stats => stats.prices.length >= 3) // Need at least 3 data points
    .sort((a, b) => b.priceVolatility - a.priceVolatility)
    .slice(0, limit)
}

/**
 * Calculates monthly spending trends
 */
export interface MonthlySpending {
  month: string
  year: number
  totalSpent: number
  invoiceCount: number
  averageInvoiceAmount: number
  topCategories: Array<{
    category: string
    amount: number
    percentage: number
  }>
}

export function calculateMonthlySpending(invoices: ParsedInvoice[]): MonthlySpending[] {
  const monthlyData = new Map<string, {
    totalSpent: number
    invoiceCount: number
    categorySpending: Map<string, number>
  }>()
  
  for (const invoice of invoices) {
    const date = new Date(invoice.documentDate)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        totalSpent: 0,
        invoiceCount: 0,
        categorySpending: new Map()
      })
    }
    
    const monthData = monthlyData.get(monthKey)!
    monthData.totalSpent += invoice.netAmountAfterAdjustment
    monthData.invoiceCount++
    
    // Category spending (simplified categorization)
    for (const item of invoice.lineItems) {
      const category = categorizeProductSimple(item.productDescription)
      const currentAmount = monthData.categorySpending.get(category) || 0
      monthData.categorySpending.set(category, currentAmount + item.extendedPrice)
    }
  }
  
  const results: MonthlySpending[] = []
  
  for (const [monthKey, data] of monthlyData) {
    const [year, month] = monthKey.split('-')
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long' })
    
    // Get top categories
    const topCategories = Array.from(data.categorySpending.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / data.totalSpent) * 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
    
    results.push({
      month: monthName,
      year: parseInt(year),
      totalSpent: data.totalSpent,
      invoiceCount: data.invoiceCount,
      averageInvoiceAmount: data.totalSpent / data.invoiceCount,
      topCategories
    })
  }
  
  return results.sort((a, b) => a.year - b.year || a.month.localeCompare(b.month))
}

/**
 * Simplified product categorization for spending analysis
 */
function categorizeProductSimple(description: string): string {
  const desc = description.toLowerCase()
  
  if (desc.includes('beef') || desc.includes('chicken') || desc.includes('fish') || desc.includes('protein')) {
    return 'Protein'
  }
  if (desc.includes('cheese') || desc.includes('dairy') || desc.includes('milk') || desc.includes('cream')) {
    return 'Dairy'
  }
  if (desc.includes('fresh') || desc.includes('tomato') || desc.includes('lettuce') || desc.includes('pepper')) {
    return 'Fresh Produce'
  }
  if (desc.includes('oil') || desc.includes('salt') || desc.includes('syrup') || desc.includes('sauce')) {
    return 'Dry Goods'
  }
  if (desc.includes('bag') || desc.includes('container') || desc.includes('supplies')) {
    return 'Supplies'
  }
  
  return 'Other'
}