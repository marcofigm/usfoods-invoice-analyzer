import { supabase } from './supabase'
import { parseCSVContent, ParsedInvoice, categorizeProduct } from './csv-parser'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface ImportResult {
  success: boolean
  totalFiles: number
  processedFiles: number
  totalInvoices: number
  totalLineItems: number
  errors: string[]
  skippedFiles: string[]
}

export interface ImportProgress {
  currentFile: string
  processedFiles: number
  totalFiles: number
  currentInvoices: number
  totalInvoices: number
  percentage: number
}

/**
 * Import all CSV files from a directory directly into Supabase
 */
export async function importInvoicesFromDirectory(
  directoryPath: string,
  restaurantId: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    totalFiles: 0,
    processedFiles: 0,
    totalInvoices: 0,
    totalLineItems: 0,
    errors: [],
    skippedFiles: []
  }

  try {
    // Get all CSV files in directory
    const files = readdirSync(directoryPath)
      .filter(file => file.toLowerCase().endsWith('.csv'))
      .map(file => join(directoryPath, file))

    result.totalFiles = files.length

    if (files.length === 0) {
      result.errors.push('No CSV files found in directory')
      return result
    }

    console.log(`Found ${files.length} CSV files to process`)

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      const fileName = filePath.split('/').pop() || ''

      try {
        onProgress?.({
          currentFile: fileName,
          processedFiles: i,
          totalFiles: files.length,
          currentInvoices: 0,
          totalInvoices: 0,
          percentage: (i / files.length) * 100
        })

        // Check if file is empty
        const stats = statSync(filePath)
        if (stats.size === 0) {
          console.log(`Skipping empty file: ${fileName}`)
          result.skippedFiles.push(fileName)
          continue
        }

        // Read and parse CSV file
        const csvContent = readFileSync(filePath, 'utf-8')
        
        // Skip if file has only header
        const lines = csvContent.trim().split('\n')
        if (lines.length <= 1) {
          console.log(`Skipping file with only header: ${fileName}`)
          result.skippedFiles.push(fileName)
          continue
        }

        const invoices = await parseCSVContent(csvContent)
        
        if (invoices.length === 0) {
          console.log(`No invoices found in file: ${fileName}`)
          result.skippedFiles.push(fileName)
          continue
        }

        // Import invoices to database
        await importInvoicesToDatabase(invoices, restaurantId)
        
        result.processedFiles++
        result.totalInvoices += invoices.length
        result.totalLineItems += invoices.reduce((sum, inv) => sum + inv.lineItems.length, 0)

        console.log(`Processed ${fileName}: ${invoices.length} invoices`)

      } catch (error) {
        const errorMsg = `Error processing ${fileName}: ${error instanceof Error ? error.message : String(error)}`
        console.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    result.success = result.processedFiles > 0
    return result

  } catch (error) {
    const errorMsg = `Directory import failed: ${error instanceof Error ? error.message : String(error)}`
    console.error(errorMsg)
    result.errors.push(errorMsg)
    return result
  }
}

/**
 * Import parsed invoices directly to Supabase database
 */
async function importInvoicesToDatabase(invoices: ParsedInvoice[], restaurantId: string): Promise<void> {
  for (const invoice of invoices) {
    try {
      // Check if invoice already exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('document_number', invoice.documentNumber)
        .single()

      if (existingInvoice) {
        console.log(`Invoice ${invoice.documentNumber} already exists, skipping`)
        continue
      }

      // Insert invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          restaurant_id: restaurantId,
          document_number: invoice.documentNumber,
          document_type: invoice.documentType,
          document_date: invoice.documentDate,
          customer_number: invoice.customerNumber,
          order_number: invoice.orderNumber,
          net_amount_after_adjustment: invoice.netAmountAfterAdjustment,
          net_amount_before_adjustment: invoice.netAmountBeforeAdjustment,
          delivery_adjustment: invoice.deliveryAdjustment,
          payment_terms: invoice.paymentTerms,
          date_ordered: invoice.dateOrdered,
          date_shipped: invoice.dateShipped,
          usf_sales_location: invoice.usfSalesLocation,
          usf_sales_rep: invoice.usfSalesRep,
          raw_data: invoice.rawData
        })
        .select()
        .single()

      if (invoiceError) {
        throw new Error(`Failed to insert invoice ${invoice.documentNumber}: ${invoiceError.message}`)
      }

      // Insert line items
      if (invoice.lineItems.length > 0) {
        const lineItemsToInsert = invoice.lineItems.map(item => ({
          invoice_id: invoiceData.id,
          product_number: item.productNumber,
          product_description: item.productDescription,
          product_label: item.productLabel,
          packing_size: item.packingSize,
          weight: item.weight,
          qty_ordered: item.qtyOrdered,
          qty_shipped: item.qtyShipped,
          qty_adjusted: item.qtyAdjusted,
          pricing_unit: item.pricingUnit,
          unit_price: item.unitPrice,
          extended_price: item.extendedPrice
        }))

        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItemsToInsert)

        if (lineItemsError) {
          throw new Error(`Failed to insert line items for invoice ${invoice.documentNumber}: ${lineItemsError.message}`)
        }

        // Update product master and price history
        await updateProductMasterAndPriceHistory(invoice, invoiceData.id, restaurantId)
      }

    } catch (error) {
      console.error(`Error importing invoice ${invoice.documentNumber}:`, error)
      throw error
    }
  }
}

/**
 * Update product master table and price history
 */
async function updateProductMasterAndPriceHistory(
  invoice: ParsedInvoice, 
  invoiceId: string, 
  restaurantId: string
): Promise<void> {
  for (const item of invoice.lineItems) {
    try {
      // Check if product exists in master
      const { data: existingProduct } = await supabase
        .from('product_master')
        .select('id')
        .eq('product_number', item.productNumber)
        .single()

      if (!existingProduct) {
        // Insert new product
        const category = categorizeProduct(item.productDescription)
        
        const { error: productError } = await supabase
          .from('product_master')
          .insert({
            product_number: item.productNumber,
            description: item.productDescription,
            brand: item.productLabel || null,
            category: category as any,
            pack_size: item.packingSize,
            unit_type: item.pricingUnit
          })

        if (productError) {
          console.error(`Failed to insert product ${item.productNumber}:`, productError.message)
        }
      }

      // Insert price history
      const { error: priceHistoryError } = await supabase
        .from('price_history')
        .insert({
          product_number: item.productNumber,
          restaurant_id: restaurantId,
          price: item.unitPrice,
          pricing_unit: item.pricingUnit,
          invoice_date: invoice.documentDate,
          invoice_id: invoiceId
        })

      if (priceHistoryError) {
        console.error(`Failed to insert price history for ${item.productNumber}:`, priceHistoryError.message)
      }

      // Check for price alerts (20% threshold)
      await checkAndCreatePriceAlert(item.productNumber, item.unitPrice, invoice.documentDate, restaurantId)

    } catch (error) {
      console.error(`Error updating product ${item.productNumber}:`, error)
    }
  }
}

/**
 * Check for significant price changes and create alerts
 */
async function checkAndCreatePriceAlert(
  productNumber: string,
  currentPrice: number,
  invoiceDate: string,
  restaurantId: string
): Promise<void> {
  try {
    // Get the previous price for this product
    const { data: priceHistory } = await supabase
      .from('price_history')
      .select('price, invoice_date')
      .eq('product_number', productNumber)
      .eq('restaurant_id', restaurantId)
      .lt('invoice_date', invoiceDate)
      .order('invoice_date', { ascending: false })
      .limit(1)

    if (priceHistory && priceHistory.length > 0) {
      const previousPrice = priceHistory[0].price
      const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100

      // Create alert if change is >= 20%
      if (Math.abs(percentageChange) >= 20) {
        const { error: alertError } = await supabase
          .from('price_alerts')
          .insert({
            restaurant_id: restaurantId,
            product_number: productNumber,
            previous_price: previousPrice,
            new_price: currentPrice,
            percentage_change: Math.round(percentageChange * 100) / 100,
            alert_type: percentageChange > 0 ? 'increase' : 'decrease',
            invoice_date: invoiceDate,
            is_read: false
          })

        if (alertError) {
          console.error(`Failed to create price alert for ${productNumber}:`, alertError.message)
        } else {
          console.log(`Price alert created: ${productNumber} changed ${percentageChange.toFixed(1)}%`)
        }
      }
    }
  } catch (error) {
    console.error(`Error checking price alert for ${productNumber}:`, error)
  }
}

/**
 * Get restaurant ID by location, create if doesn't exist
 */
export async function getOrCreateRestaurantId(name: string, location: string): Promise<string> {
  // First try to find existing restaurant
  const { data: existingRestaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('name', name)
    .eq('location', location)
    .single()

  if (existingRestaurant) {
    return existingRestaurant.id
  }

  // Create new restaurant
  const { data: newRestaurant, error } = await supabase
    .from('restaurants')
    .insert({
      name,
      location,
      address: location === 'Bee Caves' ? '11715 BEE CAVES RD, BEE CAVE, TX 78738-5011' : null,
      phone: '5125894228'
    })
    .select()
    .single()

  if (error || !newRestaurant) {
    throw new Error(`Failed to create restaurant: ${error?.message}`)
  }

  return newRestaurant.id
}