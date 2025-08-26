#!/usr/bin/env tsx

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

console.log('🔍 Bee Caves v2 Script starting...');

// Main execution check
console.log('🔍 Checking if should run...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

const shouldRun = process.argv[1].includes('process-bee-caves-v2');

if (!shouldRun) {
    console.log('❌ Script not being run directly, exiting');
    process.exit(0);
}

console.log('🚀 Running main process...');

// Database client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ParsedInvoice {
    document_number: string;
    invoice_date: Date;
    net_amount: number;
    file_name: string;
}

interface ParsedInvoiceItem {
    product_number: string;
    product_description: string;
    unit_price: number;
    quantity_shipped: number;
    extended_price: number;
    packing_size: string;
    pricing_unit: string;
}

class PackSizeParser {
    static parse(packSize: string): { count: number; unit: string; baseUnit: string } {
        if (!packSize) return { count: 1, unit: 'EA', baseUnit: 'EA' };

        const normalized = packSize.trim().toUpperCase();
        
        // Handle patterns like "6/16.5 OZ", "24/12 OZ", "12/1 LB"
        const slashPattern = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*([A-Z]+)/;
        const slashMatch = normalized.match(slashPattern);
        if (slashMatch) {
            const outerCount = parseFloat(slashMatch[1]);
            const innerSize = parseFloat(slashMatch[2]);
            const unit = slashMatch[3];
            return {
                count: outerCount,
                unit: `${innerSize} ${unit}`,
                baseUnit: unit
            };
        }

        // Handle patterns like "50 LB", "20 EA", "1 GL"
        const simplePattern = /(\d+(?:\.\d+)?)\s*([A-Z]+)/;
        const simpleMatch = normalized.match(simplePattern);
        if (simpleMatch) {
            return {
                count: parseFloat(simpleMatch[1]),
                unit: simpleMatch[2],
                baseUnit: simpleMatch[2]
            };
        }

        return { count: 1, unit: normalized || 'EA', baseUnit: 'EA' };
    }
}

class ProductCategorizer {
    private static categories = {
        PRODUCE: ['LETTUCE', 'TOMATO', 'ONION', 'PEPPER', 'CILANTRO', 'LIME', 'AVOCADO', 'JALAPENO'],
        PROTEIN: ['BEEF', 'CHICKEN', 'PORK', 'FISH', 'SHRIMP', 'TURKEY', 'CHORIZO', 'BACON'],
        DAIRY: ['CHEESE', 'MILK', 'CREAM', 'BUTTER', 'YOGURT', 'SOUR CREAM'],
        DRY_GOODS: ['RICE', 'BEAN', 'FLOUR', 'TORTILLA', 'SPICE', 'SEASONING', 'OIL', 'VINEGAR'],
        SUPPLIES: ['CUP', 'LID', 'CONTAINER', 'BAG', 'NAPKIN', 'FORK', 'SPOON', 'GLOVE', 'DEGREASER'],
        BEVERAGES: ['TEA', 'COFFEE', 'JUICE', 'SODA', 'WATER']
    };

    static categorize(description: string): string {
        const upperDesc = description.toUpperCase();
        
        for (const [category, keywords] of Object.entries(this.categories)) {
            if (keywords.some(keyword => upperDesc.includes(keyword))) {
                return category;
            }
        }
        
        return 'OTHER';
    }
}

class PriceAnalyzer {
    private static PRICE_THRESHOLD = 0.20; // 20% threshold
    
    static analyzePrice(currentPrice: number, previousPrice?: number): {
        percentageChange: number | null;
        isAlert: boolean;
        alertType: 'INCREASE' | 'DECREASE' | null;
    } {
        if (!previousPrice) {
            return { percentageChange: null, isAlert: false, alertType: null };
        }
        
        const percentageChange = (currentPrice - previousPrice) / previousPrice;
        const isAlert = Math.abs(percentageChange) > this.PRICE_THRESHOLD;
        const alertType = isAlert ? (percentageChange > 0 ? 'INCREASE' : 'DECREASE') : null;
        
        return { percentageChange, isAlert, alertType };
    }
}

class CSVParser {
    static parseInvoiceFile(filePath: string): Promise<{
        invoice: ParsedInvoice;
        items: ParsedInvoiceItem[];
    }> {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    reject(new Error(`Failed to read file: ${err.message}`));
                    return;
                }

                if (!data.trim()) {
                    reject(new Error('File is empty'));
                    return;
                }

                Papa.parse(data, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results: any) => {
                        try {
                            if (!results.data || results.data.length === 0) {
                                reject(new Error('No data rows found'));
                                return;
                            }

                            const firstRow = results.data[0];
                            if (!firstRow.DocumentNumber) {
                                reject(new Error('Invalid CSV format - missing DocumentNumber'));
                                return;
                            }

                            // Parse invoice data from first row
                            const invoice: ParsedInvoice = {
                                document_number: firstRow.DocumentNumber,
                                invoice_date: new Date(firstRow.DocumentDate),
                                net_amount: parseFloat(firstRow['NetAmountAfter Adjustment']) || 0,
                                file_name: path.basename(filePath)
                            };

                            // Parse all items
                            const items: ParsedInvoiceItem[] = results.data.map((row: any) => ({
                                product_number: row.ProductNumber || '',
                                product_description: row.ProductDescription || '',
                                unit_price: parseFloat(row.UnitPrice) || 0,
                                quantity_shipped: parseFloat(row.QtyShip) || 0,
                                extended_price: parseFloat(row.ExtendedPrice) || 0,
                                packing_size: row.PackingSize || '',
                                pricing_unit: row.PricingUnit || ''
                            })).filter(item => item.product_number); // Filter out empty rows

                            resolve({ invoice, items });
                        } catch (error: any) {
                            reject(new Error(`Failed to parse CSV: ${error.message}`));
                        }
                    },
                    error: (error: any) => {
                        reject(new Error(`CSV parsing error: ${error.message}`));
                    }
                });
            });
        });
    }
}

class DatabaseImporter {
    private locationId = '5a593bd7-5151-4816-9518-b8a93a580d6c'; // Bee Caves location ID
    private vendorId: string | null = null;

    async initialize(): Promise<void> {
        console.log('🔍 Initializing database connection for Bee Caves v2...');
        
        // Test connection
        const { error: testError } = await supabase.from('locations').select('id').limit(1);
        if (testError) {
            throw new Error(`Database connection failed: ${testError.message}`);
        }
        console.log('✅ Database connection successful');
        console.log('📍 Using Bee Caves location:', this.locationId);
        
        // Get US Foods vendor ID
        const { data: vendor, error: vendorError } = await supabase
            .from('vendors')
            .select('id')
            .eq('name', 'US Foods')
            .single();
            
        if (vendorError) {
            throw new Error(`Error finding US Foods vendor: ${vendorError.message}`);
        }
            
        if (!vendor) {
            throw new Error('US Foods vendor not found in database');
        }
        
        this.vendorId = vendor.id;
        console.log('✅ Found US Foods vendor');
    }
    
    async importInvoice(invoice: ParsedInvoice, items: ParsedInvoiceItem[]): Promise<void> {
        if (!this.locationId || !this.vendorId) {
            throw new Error('Database not initialized');
        }
        
        // Check for existing invoice
        const { data: existing } = await supabase
            .from('invoices')
            .select('id')
            .eq('document_number', invoice.document_number)
            .eq('location_id', this.locationId)
            .single();
            
        if (existing) {
            console.log(`⏭️  Invoice ${invoice.document_number} already exists, skipping`);
            return;
        }
        
        // Insert invoice
        const { data: savedInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert([{
                location_id: this.locationId,
                vendor_id: this.vendorId,
                document_number: invoice.document_number,
                invoice_date: invoice.invoice_date.toISOString().split('T')[0],
                net_amount: invoice.net_amount,
                file_name: invoice.file_name,
                processing_status: 'COMPLETED',
                total_items: items.length,
                unique_products: new Set(items.map(i => i.product_number)).size
            }])
            .select('id')
            .single();
            
        if (invoiceError) {
            throw new Error(`Failed to insert invoice: ${invoiceError.message}`);
        }
        
        if (!savedInvoice) {
            throw new Error('No invoice data returned from insert');
        }
        
        // Process and insert items
        const processedItems = [];
        const productIds = new Map<string, string>();
        
        for (const item of items) {
            // Get or create product
            let productId = productIds.get(item.product_number);
            
            if (!productId) {
                const { data: existingProduct } = await supabase
                    .from('products')
                    .select('id')
                    .eq('product_number', item.product_number)
                    .single();
                
                if (existingProduct) {
                    productId = existingProduct.id;
                } else {
                    // Create new product
                    const packInfo = PackSizeParser.parse(item.packing_size);
                    const category = ProductCategorizer.categorize(item.product_description);
                    
                    const { data: newProduct, error: productError } = await supabase
                        .from('products')
                        .insert([{
                            product_number: item.product_number,
                            name: item.product_description,
                            description: item.product_description,
                            category: category,
                            base_unit: packInfo.baseUnit,
                            standard_pack_sizes: [item.packing_size]
                        }])
                        .select('id')
                        .single();
                    
                    if (productError || !newProduct) {
                        console.error(`Failed to create product ${item.product_number}:`, productError);
                        continue;
                    }
                    
                    productId = newProduct.id;
                }
                
                productIds.set(item.product_number, productId);
            }
            
            // Add to processed items
            processedItems.push({
                invoice_id: savedInvoice.id,
                product_number: item.product_number,
                product_description: item.product_description,
                pack_size: item.packing_size,
                pricing_unit: item.pricing_unit,
                qty_ordered: item.quantity_shipped,
                qty_shipped: item.quantity_shipped,
                unit_price: item.unit_price,
                extended_price: item.extended_price,
                product_category: ProductCategorizer.categorize(item.product_description)
            });
        }
        
        // Insert invoice items
        if (processedItems.length > 0) {
            const { error: itemsError } = await supabase
                .from('invoice_items')
                .insert(processedItems);
            
            if (itemsError) {
                console.error('Failed to insert invoice items:', itemsError.message);
            }
        }
        
        // Insert price records
        const priceRecords = [];
        for (const item of items) {
            const productId = productIds.get(item.product_number);
            if (productId && item.unit_price > 0) {
                priceRecords.push({
                    product_id: productId,
                    location_id: this.locationId,
                    vendor_id: this.vendorId,
                    price_date: invoice.invoice_date.toISOString().split('T')[0],
                    unit_price: item.unit_price,
                    pack_size: item.packing_size,
                    pricing_unit: item.pricing_unit,
                    extended_amount: item.extended_price,
                    quantity_purchased: item.quantity_shipped
                });
            }
        }
        
        if (priceRecords.length > 0) {
            const { error: priceError } = await supabase
                .from('product_prices')
                .insert(priceRecords);
            
            if (priceError) {
                console.warn('⚠️  Failed to insert price records:', priceError.message);
            }
        }
        
        console.log(`✅ Imported invoice ${invoice.document_number} with ${items.length} items`);
    }
}

async function processDirectory(dirPath: string, importer: DatabaseImporter): Promise<void> {
    console.log(`📁 Processing directory: ${dirPath}`);
    
    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.csv')).sort();
    console.log(`Found ${files.length} CSV files`);
    
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        console.log(`📄 Processing: ${file}`);
        
        try {
            const { invoice, items } = await CSVParser.parseInvoiceFile(filePath);
            await importer.importInvoice(invoice, items);
        } catch (error: any) {
            console.error(`❌ Error processing ${file}: ${error.message}`);
        }
    }
}

async function main(): Promise<void> {
    console.log('🚀 Starting US Foods Bee Caves v2 Invoice Processing...');
    console.log('\n📊 Process arguments:', process.argv);
    
    try {
        console.log('🔧 Initializing database importer...');
        const importer = new DatabaseImporter();
        await importer.initialize();
        console.log('✅ Database importer initialized\n');
        
        const baseDir = '/Users/marcofigueroa/LOS PINOS - USFOODS/INVOICES/BEE CAVES/v2';
        
        // Process both subdirectories
        await processDirectory(path.join(baseDir, '1'), importer);
        await processDirectory(path.join(baseDir, '2'), importer);
        
        console.log('\n🎉 Bee Caves v2 import completed successfully!');
        
        // Print summary
        console.log('\n📊 Import Summary:');
        const { data: invoiceCount } = await supabase
            .from('invoices')
            .select('id')
            .eq('location_id', '5a593bd7-5151-4816-9518-b8a93a580d6c');
            
        console.log(`Total Bee Caves invoices in database: ${invoiceCount?.length || 0}`);
        
    } catch (error: any) {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);