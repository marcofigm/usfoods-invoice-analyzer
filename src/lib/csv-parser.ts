import Papa from 'papaparse'

export interface USFoodsInvoiceRow {
  DocumentNumber: string
  DocumentType: string
  DocumentDate: string
  CustomerNumber: string
  CustomerName: string
  AccountNumber: string
  PurchaseOrder: string
  USFSalesLocation: string
  USFSalesRep: string
  DateOrdered: string
  OrderNumber: string
  PaymentTerms: string
  DateShipped: string
  DeliveryAdjustment: string
  'NetAmountAfter Adjustment': string
  'NetAmountBefore Adj': string
  CreditMemoNumber: string
  CreditMemoDate: string
  BillToName: string
  BillToStreet: string
  'BillToStreet.1': string
  BillToCity: string
  BillToState: string
  BillToZip: string
  BillToPhone: string
  BillToAttn: string
  ShipToName: string
  ShipToStreet: string
  'ShipToStreet.1': string
  ShipToCity: string
  ShipToState: string
  ShipToZip: string
  ShipToPhone: string
  ShipToDept: string
  ShipToDeptName: string
  RemitToName: string
  RemitToStreet1: string
  RemitToStreet2: string
  RemitToCity: string
  RemitToState: string
  RemitToZip: string
  RemitToPhone: string
  ShipFromStreet1: string
  ShipFromStreet2: string
  ShipFromCity: string
  ShipFromState: string
  ProductNumber: string
  ProductDescription: string
  'Product Label': string
  PackingSize: string
  Weight: string
  QtyOrder: string
  QtyShip: string
  QtyAdjust: string
  PricingUnit: string
  UnitPrice: string
  ExtendedPrice: string
}

export interface ParsedInvoice {
  documentNumber: string
  documentType: string
  documentDate: string
  customerNumber: string
  customerName: string
  orderNumber: string
  netAmountAfterAdjustment: number
  netAmountBeforeAdjustment: number
  deliveryAdjustment: number
  paymentTerms: string
  dateOrdered: string
  dateShipped: string
  usfSalesLocation: string
  usfSalesRep: string
  lineItems: ParsedLineItem[]
  rawData: USFoodsInvoiceRow[]
}

export interface ParsedLineItem {
  productNumber: string
  productDescription: string
  productLabel: string
  packingSize: string
  weight: number
  qtyOrdered: number
  qtyShipped: number
  qtyAdjusted: number
  pricingUnit: string
  unitPrice: number
  extendedPrice: number
}

export interface PackSizeInfo {
  units: number
  size: string
  unitType: string
  totalUnits: number
}

/**
 * Parses complex pack size formats from US Foods invoices
 * Examples: "6/16.5 OZ" -> {units: 6, size: "16.5", unitType: "OZ", totalUnits: 99}
 */
export function parsePackSize(packSize: string): PackSizeInfo {
  if (!packSize || packSize.trim() === '') {
    return { units: 1, size: '', unitType: '', totalUnits: 1 }
  }

  const normalized = packSize.trim().toLowerCase()
  
  // Pattern 1: "6/16.5 OZ" or "24/24 OZ"
  const slashPattern = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*([a-z]+)$/i
  const slashMatch = normalized.match(slashPattern)
  if (slashMatch) {
    const units = parseFloat(slashMatch[1])
    const size = parseFloat(slashMatch[2])
    const unitType = slashMatch[3].toUpperCase()
    return {
      units,
      size: slashMatch[2],
      unitType,
      totalUnits: units * size
    }
  }

  // Pattern 2: "35 LB" or "25 LB"
  const simplePattern = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i
  const simpleMatch = normalized.match(simplePattern)
  if (simpleMatch) {
    const size = parseFloat(simpleMatch[1])
    const unitType = simpleMatch[2].toUpperCase()
    return {
      units: 1,
      size: simpleMatch[1],
      unitType,
      totalUnits: size
    }
  }

  // Pattern 3: "2000 EA" or "88 EA"
  const countPattern = /^(\d+)\s*(ea|each)$/i
  const countMatch = normalized.match(countPattern)
  if (countMatch) {
    const count = parseInt(countMatch[1])
    return {
      units: 1,
      size: count.toString(),
      unitType: 'EA',
      totalUnits: count
    }
  }

  // Pattern 4: "6/#10 CN" (cans)
  const canPattern = /^(\d+)\s*\/\s*#(\d+)\s*(cn|can)$/i
  const canMatch = normalized.match(canPattern)
  if (canMatch) {
    const units = parseInt(canMatch[1])
    const size = canMatch[2]
    return {
      units,
      size: `#${size}`,
      unitType: 'CN',
      totalUnits: units
    }
  }

  // Pattern 5: "1.1 BU" (bushel)
  const decimalPattern = /^(\d+\.\d+)\s*([a-z]+)$/i
  const decimalMatch = normalized.match(decimalPattern)
  if (decimalMatch) {
    const size = parseFloat(decimalMatch[1])
    const unitType = decimalMatch[2].toUpperCase()
    return {
      units: 1,
      size: decimalMatch[1],
      unitType,
      totalUnits: size
    }
  }

  // Fallback: return original string as size
  return {
    units: 1,
    size: packSize,
    unitType: '',
    totalUnits: 1
  }
}

/**
 * Categorizes products based on description keywords
 */
export function categorizeProduct(description: string): string {
  const desc = description.toLowerCase()
  
  // Produce
  if (desc.includes('tomato') || desc.includes('lettuce') || desc.includes('onion') || 
      desc.includes('pepper') || desc.includes('orange') || desc.includes('tomatillo') ||
      desc.includes('fresh') || desc.includes('produce')) {
    return 'Produce'
  }
  
  // Protein
  if (desc.includes('beef') || desc.includes('chicken') || desc.includes('fish') ||
      desc.includes('tilapia') || desc.includes('protein') || desc.includes('meat')) {
    return 'Protein'
  }
  
  // Dairy
  if (desc.includes('cheese') || desc.includes('sour cream') || desc.includes('milk') ||
      desc.includes('dairy') || desc.includes('cream')) {
    return 'Dairy'
  }
  
  // Supplies
  if (desc.includes('bag') || desc.includes('container') || desc.includes('wrap') ||
      desc.includes('cup') || desc.includes('supplies')) {
    return 'Supplies'
  }
  
  // Beverages
  if (desc.includes('juice') || desc.includes('soda') || desc.includes('water') ||
      desc.includes('beverage') || desc.includes('drink')) {
    return 'Beverages'
  }
  
  // Dry Goods (default for everything else)
  return 'Dry Goods'
}

/**
 * Parses CSV content and extracts invoice data
 */
export function parseCSVContent(csvContent: string): Promise<ParsedInvoice[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<USFoodsInvoiceRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Handle duplicate column names in US Foods CSV format
        if (header === 'BillToStreet' && csvContent.split(header).length > 2) {
          return 'BillToStreet.1'
        }
        if (header === 'ShipToStreet' && csvContent.split(header).length > 2) {
          return 'ShipToStreet.1'
        }
        return header
      },
      complete: (results) => {
        try {
          const invoices = processInvoiceData(results.data)
          resolve(invoices)
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      }
    })
  })
}

/**
 * Processes parsed CSV data into structured invoice objects
 */
function processInvoiceData(rows: USFoodsInvoiceRow[]): ParsedInvoice[] {
  const invoiceMap = new Map<string, ParsedInvoice>()
  
  for (const row of rows) {
    if (!row.DocumentNumber) continue
    
    const documentNumber = row.DocumentNumber.trim()
    
    if (!invoiceMap.has(documentNumber)) {
      // Create new invoice
      const invoice: ParsedInvoice = {
        documentNumber,
        documentType: row.DocumentType || 'INVOICE',
        documentDate: row.DocumentDate,
        customerNumber: row.CustomerNumber,
        customerName: row.CustomerName,
        orderNumber: row.OrderNumber,
        netAmountAfterAdjustment: parseFloat(row['NetAmountAfter Adjustment']) || 0,
        netAmountBeforeAdjustment: parseFloat(row['NetAmountBefore Adj']) || 0,
        deliveryAdjustment: parseFloat(row.DeliveryAdjustment) || 0,
        paymentTerms: row.PaymentTerms,
        dateOrdered: row.DateOrdered,
        dateShipped: row.DateShipped,
        usfSalesLocation: row.USFSalesLocation,
        usfSalesRep: row.USFSalesRep,
        lineItems: [],
        rawData: []
      }
      invoiceMap.set(documentNumber, invoice)
    }
    
    const invoice = invoiceMap.get(documentNumber)!
    
    // Add line item if product data exists
    if (row.ProductNumber) {
      const lineItem: ParsedLineItem = {
        productNumber: row.ProductNumber,
        productDescription: row.ProductDescription,
        productLabel: row['Product Label'] || '',
        packingSize: row.PackingSize,
        weight: parseFloat(row.Weight) || 0,
        qtyOrdered: parseInt(row.QtyOrder) || 0,
        qtyShipped: parseInt(row.QtyShip) || 0,
        qtyAdjusted: parseInt(row.QtyAdjust) || 0,
        pricingUnit: row.PricingUnit,
        unitPrice: parseFloat(row.UnitPrice) || 0,
        extendedPrice: parseFloat(row.ExtendedPrice) || 0
      }
      invoice.lineItems.push(lineItem)
    }
    
    // Store raw data
    invoice.rawData.push(row)
  }
  
  return Array.from(invoiceMap.values())
}

/**
 * Validates that a CSV file matches the expected US Foods format
 */
export function validateUSFoodsFormat(csvContent: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  const requiredHeaders = [
    'DocumentNumber',
    'DocumentType', 
    'DocumentDate',
    'CustomerName',
    'ProductNumber',
    'ProductDescription',
    'UnitPrice',
    'ExtendedPrice'
  ]
  
  const lines = csvContent.split('\n')
  if (lines.length < 2) {
    errors.push('File must contain at least a header row and one data row')
    return { isValid: false, errors }
  }
  
  const headerLine = lines[0]
  const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''))
  
  for (const required of requiredHeaders) {
    if (!headers.some(h => h === required)) {
      errors.push(`Missing required header: ${required}`)
    }
  }
  
  // Check if we have the expected number of columns (51)
  if (headers.length < 50) {
    errors.push(`Expected ~51 columns, found ${headers.length}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}