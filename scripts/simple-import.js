#!/usr/bin/env node

/**
 * Simple CSV Import Script - Direct Database Operations
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function createTables() {
  console.log('🏗️  Creating tables...')
  
  // Create restaurants table
  const { error: restaurantsError } = await supabase.rpc('exec', {
    query: `
      CREATE TABLE IF NOT EXISTS restaurants (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR NOT NULL,
        location VARCHAR NOT NULL,
        address TEXT,
        phone VARCHAR,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  })

  // Create invoices table  
  const { error: invoicesError } = await supabase.rpc('exec', {
    query: `
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        restaurant_id UUID,
        document_number VARCHAR NOT NULL,
        document_type VARCHAR DEFAULT 'INVOICE',
        document_date DATE NOT NULL,
        customer_number VARCHAR,
        order_number VARCHAR,
        net_amount_after_adjustment DECIMAL(10,2),
        net_amount_before_adjustment DECIMAL(10,2),
        delivery_adjustment DECIMAL(10,2) DEFAULT 0.00,
        payment_terms VARCHAR,
        date_ordered DATE,
        date_shipped DATE,
        usf_sales_location VARCHAR,
        usf_sales_rep VARCHAR,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  })

  // Create invoice_line_items table
  const { error: lineItemsError } = await supabase.rpc('exec', {
    query: `
      CREATE TABLE IF NOT EXISTS invoice_line_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        invoice_id UUID,
        product_number VARCHAR NOT NULL,
        product_description VARCHAR NOT NULL,
        product_label VARCHAR,
        packing_size VARCHAR,
        weight DECIMAL(10,2),
        qty_ordered INTEGER,
        qty_shipped INTEGER,
        qty_adjusted INTEGER DEFAULT 0,
        pricing_unit VARCHAR,
        unit_price DECIMAL(10,4),
        extended_price DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  })

  if (!restaurantsError && !invoicesError && !lineItemsError) {
    console.log('✅ Tables created successfully')
  }
}

async function insertRestaurant() {
  const { data, error } = await supabase
    .from('restaurants')
    .upsert({
      name: 'Los Pinos',
      location: 'Bee Caves',
      address: '11715 BEE CAVES RD, BEE CAVE, TX 78738-5011',
      phone: '5125894228'
    }, { 
      onConflict: 'name,location',
      ignoreDuplicates: false 
    })
    .select()

  if (error) {
    console.log('Creating restaurant manually...')
    const { data: newData, error: insertError } = await supabase
      .from('restaurants')
      .insert({
        name: 'Los Pinos',
        location: 'Bee Caves',
        address: '11715 BEE CAVES RD, BEE CAVE, TX 78738-5011',
        phone: '5125894228'
      })
      .select()

    if (insertError) {
      console.error('❌ Failed to create restaurant:', insertError.message)
      return null
    }
    return newData[0].id
  }

  return data[0].id
}

async function processCSVFile(filePath, restaurantId) {
  console.log(`📄 Processing: ${path.basename(filePath)}`)
  
  try {
    const csvContent = fs.readFileSync(filePath, 'utf-8')
    const lines = csvContent.trim().split('\n')
    
    if (lines.length <= 1) {
      console.log(`⚠️  Skipping empty file: ${path.basename(filePath)}`)
      return { invoices: 0, lineItems: 0 }
    }

    return new Promise((resolve) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const invoiceMap = new Map()
          
          for (const row of results.data) {
            if (!row.DocumentNumber) continue
            
            const documentNumber = row.DocumentNumber.trim()
            
            if (!invoiceMap.has(documentNumber)) {
              invoiceMap.set(documentNumber, {
                invoice: {
                  restaurant_id: restaurantId,
                  document_number: documentNumber,
                  document_type: row.DocumentType || 'INVOICE',
                  document_date: row.DocumentDate,
                  customer_number: row.CustomerNumber,
                  order_number: row.OrderNumber,
                  net_amount_after_adjustment: parseFloat(row['NetAmountAfter Adjustment']) || 0,
                  net_amount_before_adjustment: parseFloat(row['NetAmountBefore Adj']) || 0,
                  delivery_adjustment: parseFloat(row.DeliveryAdjustment) || 0,
                  payment_terms: row.PaymentTerms,
                  date_ordered: row.DateOrdered || null,
                  date_shipped: row.DateShipped || null,
                  usf_sales_location: row.USFSalesLocation,
                  usf_sales_rep: row.USFSalesRep
                },
                lineItems: []
              })
            }
            
            if (row.ProductNumber) {
              invoiceMap.get(documentNumber).lineItems.push({
                product_number: row.ProductNumber,
                product_description: row.ProductDescription,
                product_label: row['Product Label'] || '',
                packing_size: row.PackingSize,
                weight: parseFloat(row.Weight) || 0,
                qty_ordered: parseInt(row.QtyOrder) || 0,
                qty_shipped: parseInt(row.QtyShip) || 0,
                qty_adjusted: parseInt(row.QtyAdjust) || 0,
                pricing_unit: row.PricingUnit,
                unit_price: parseFloat(row.UnitPrice) || 0,
                extended_price: parseFloat(row.ExtendedPrice) || 0
              })
            }
          }
          
          let invoiceCount = 0
          let lineItemCount = 0
          
          for (const [documentNumber, data] of invoiceMap) {
            try {
              // Check if invoice already exists
              const { data: existing } = await supabase
                .from('invoices')
                .select('id')
                .eq('document_number', documentNumber)
                .single()
              
              if (existing) {
                console.log(`⚠️  Invoice ${documentNumber} already exists, skipping`)
                continue
              }
              
              // Insert invoice
              const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .insert(data.invoice)
                .select()
                .single()
              
              if (invoiceError) {
                console.error(`❌ Error inserting invoice ${documentNumber}:`, invoiceError.message)
                continue
              }
              
              invoiceCount++
              
              // Insert line items
              if (data.lineItems.length > 0) {
                const lineItemsWithInvoiceId = data.lineItems.map(item => ({
                  ...item,
                  invoice_id: invoiceData.id
                }))
                
                const { error: lineItemsError } = await supabase
                  .from('invoice_line_items')
                  .insert(lineItemsWithInvoiceId)
                
                if (!lineItemsError) {
                  lineItemCount += data.lineItems.length
                }
              }
              
            } catch (error) {
              console.error(`❌ Error processing invoice ${documentNumber}:`, error.message)
            }
          }
          
          resolve({ invoices: invoiceCount, lineItems: lineItemCount })
        }
      })
    })
  } catch (error) {
    console.error(`❌ Error processing file ${filePath}:`, error.message)
    return { invoices: 0, lineItems: 0 }
  }
}

async function main() {
  console.log('🚀 Starting US Foods Invoice Import...')
  
  try {
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('_supabase_migrations')
      .select('*')
      .limit(1)
    
    if (testError && !testError.message.includes('does not exist')) {
      console.error('❌ Supabase connection failed:', testError.message)
      process.exit(1)
    }
    
    console.log('✅ Supabase connected')
    
    // Create tables (will be ignored if they exist)
    await createTables()
    
    // Create restaurant
    console.log('📍 Setting up restaurant...')
    const restaurantId = await insertRestaurant()
    if (!restaurantId) {
      console.error('❌ Failed to setup restaurant')
      process.exit(1)
    }
    console.log(`✅ Restaurant ID: ${restaurantId}`)
    
    // Process CSV files
    const invoicesDir = '/Users/marcofigueroa/LOS PINOS - USFOODS/INVOICES/BEE CAVES/1'
    const files = fs.readdirSync(invoicesDir)
      .filter(file => file.toLowerCase().endsWith('.csv'))
      .map(file => path.join(invoicesDir, file))
    
    console.log(`📁 Found ${files.length} CSV files`)
    
    let totalInvoices = 0
    let totalLineItems = 0
    
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      console.log(`\n📊 Progress: ${i + 1}/${files.length}`)
      
      const result = await processCSVFile(filePath, restaurantId)
      totalInvoices += result.invoices
      totalLineItems += result.lineItems
    }
    
    console.log('\n🎯 Import Complete!')
    console.log(`📄 Total Invoices: ${totalInvoices}`)
    console.log(`📝 Total Line Items: ${totalLineItems}`)
    
  } catch (error) {
    console.error('❌ Import failed:', error.message)
    process.exit(1)
  }
}

main()