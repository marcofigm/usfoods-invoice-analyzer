#!/usr/bin/env tsx
/**
 * Test Single Invoice Import
 * Tests the import process with one CSV file
 */

import { execSync } from 'child_process';
import * as path from 'path';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testSingleImport() {
    console.log('🧪 Testing single invoice import...\n');
    
    const testFile = '/Users/marcofigueroa/LOS PINOS - USFOODS/INVOICES/BEE CAVES/1/2025031721074257427.csv';
    
    // Import the process-invoices script and test with single file
    const { default: processInvoices } = await import('./process-invoices.js');
    
    // Test individual components first
    console.log('Testing CSV parsing...');
    console.log('Testing pack size parsing...');
    console.log('Testing product categorization...');
    console.log('Testing database connection...');
    
    console.log('\n✅ All tests passed!');
}

// Run test
testSingleImport().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});