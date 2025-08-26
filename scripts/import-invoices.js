#!/usr/bin/env node

/**
 * Direct CSV Import Script for US Foods Invoice Analyzer
 * Usage: node scripts/import-invoices.js
 */

const { importInvoicesFromDirectory, getOrCreateRestaurantId } = require('../src/lib/data-importer')

async function main() {
  console.log('🚀 Starting US Foods Invoice Import...')
  
  try {
    // Get restaurant ID for Los Pinos Bee Caves
    console.log('📍 Setting up restaurant...')
    const restaurantId = await getOrCreateRestaurantId('Los Pinos', 'Bee Caves')
    console.log(`✅ Restaurant ID: ${restaurantId}`)
    
    // Import invoices from the directory
    const directoryPath = '/Users/marcofigueroa/LOS PINOS - USFOODS/INVOICES/BEE CAVES/1'
    console.log(`📁 Importing from: ${directoryPath}`)
    
    const result = await importInvoicesFromDirectory(
      directoryPath,
      restaurantId,
      (progress) => {
        const percent = progress.percentage.toFixed(1)
        console.log(`📊 Progress: ${percent}% - Processing ${progress.currentFile} (${progress.processedFiles}/${progress.totalFiles})`)
      }
    )
    
    // Display results
    console.log('\n🎯 Import Results:')
    console.log(`✅ Success: ${result.success}`)
    console.log(`📂 Total Files: ${result.totalFiles}`)
    console.log(`✅ Processed Files: ${result.processedFiles}`)
    console.log(`📄 Total Invoices: ${result.totalInvoices}`)
    console.log(`📝 Total Line Items: ${result.totalLineItems}`)
    
    if (result.skippedFiles.length > 0) {
      console.log(`\n⚠️  Skipped Files (${result.skippedFiles.length}):`)
      result.skippedFiles.forEach(file => console.log(`   - ${file}`))
    }
    
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`)
      result.errors.forEach(error => console.log(`   - ${error}`))
    }
    
    console.log('\n🎉 Import completed!')
    
  } catch (error) {
    console.error('❌ Import failed:', error.message)
    process.exit(1)
  }
}

// Run the import
main()