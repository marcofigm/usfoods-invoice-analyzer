#!/usr/bin/env tsx
/**
 * US Foods Invoice Processing Script - 360 Location
 * Processes 170 CSV invoices from Los Pinos 360 location (Aug 2024 - Aug 2025)
 * Based on Plan2.md specifications for 51-field US Foods format
 */

console.log('🔍 360 Location Script starting...');

import { createClient } from '@supabase/supabase-js';
import * as Papa from 'papaparse';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Types based on our database schema
interface USFoodsCSVRow {
    DocumentNumber: string;
    DocumentType: string;
    DocumentDate: string;
    CustomerNumber: string;
    CustomerName: string;
    NetAmountAfter: string;
    NetAmountBefore: string;
    ProductNumber: string;
    ProductDescription: string;
    'Product Label': string;
    PackingSize: string;
    Weight: string;
    QtyOrder: string;
    QtyShip: string;
    PricingUnit: string;
    UnitPrice: string;
    ExtendedPrice: string;
    [key: string]: string;
}

interface ParsedInvoice {
    document_number: string;
    invoice_date: Date;
    net_amount: number;
    customer_name: string;
    file_name: string;
}

interface ParsedInvoiceItem {
    product_number: string;
    product_description: string;
    supplier_label: string;
    pack_size: string;
    qty_shipped: number;
    pricing_unit: string;
    unit_price: number;
    extended_price: number;
    product_category?: string;
}

/**
 * Advanced Pack Size Parser - handles complex formats from Plan2.md
 * Examples: "6/16.5 OZ", "24/12 OZ", "8/500 EA", "25 LB"
 */
class PackSizeParser {
    static parse(packSize: string): { count: number; unit: string; baseUnit: string } {
        if (!packSize) return { count: 1, unit: 'EA', baseUnit: 'EA' };
        
        const cleanSize = packSize.trim().toUpperCase();
        
        // Handle triple format: "6/16.5 OZ" = 6 × 16.5 = 99 OZ
        const tripleMatch = cleanSize.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\s*(\w+)$/);
        if (tripleMatch) {
            const [, count, size, unit] = tripleMatch;
            return {
                count: parseFloat(count) * parseFloat(size),
                unit: unit,
                baseUnit: unit
            };
        }
        
        // Handle double format: "24/12 OZ" = 24 × 12 = 288 OZ
        const doubleMatch = cleanSize.match(/^(\d+)\/(\d+)\s*(\w+)$/);
        if (doubleMatch) {
            const [, count, size, unit] = doubleMatch;
            return {
                count: parseInt(count) * parseInt(size),
                unit: unit,
                baseUnit: unit
            };
        }
        
        // Handle simple format: "25 LB" = 25 LB
        const simpleMatch = cleanSize.match(/^(\d+(?:\.\d+)?)\s*(\w+)$/);
        if (simpleMatch) {
            const [, count, unit] = simpleMatch;
            return {
                count: parseFloat(count),
                unit: unit,
                baseUnit: unit
            };
        }
        
        // Handle count/unit format: "384/1.5 OZ" = 384 × 1.5 = 576 OZ
        const countUnitMatch = cleanSize.match(/^(\d+)\/(\d+(?:\.\d+)?)\s*(\w+)$/);
        if (countUnitMatch) {
            const [, count, size, unit] = countUnitMatch;
            return {
                count: parseInt(count) * parseFloat(size),
                unit: unit,
                baseUnit: unit
            };
        }
        
        // Default fallback
        return { count: 1, unit: 'EA', baseUnit: 'EA' };
    }
}

/**
 * Product Categorization Engine - based on Plan2.md product analysis
 */
class ProductCategorizer {
    private static readonly CATEGORY_KEYWORDS = {
        'Produce': ['TOMATO', 'LETTUCE', 'AVOCADO', 'ONION', 'PEPPER', 'LIME', 'CILANTRO', 
                   'POTATO', 'JALAPENO', 'BELL', 'FRESH', 'BULK'],
        'Protein': ['BEEF', 'CHICKEN', 'BACON', 'SAUSAGE', 'MEAT', 'CHORIZO', 'HOG',
                   'SKIRT', 'GROUND', 'BREAST', 'DICED'],
        'Dairy': ['CHEESE', 'AMERICAN', 'CHEDDAR', 'MONTEREY', 'SOUR', 'CREAM', 'EGG',
                 'MILK', 'DAIRY'],
        'Dry_Goods': ['RICE', 'FLOUR', 'CORN', 'BEAN', 'PINTO', 'SALT', 'OIL', 'CANOLA',
                     'SHORTENING', 'MAYONNAISE', 'TEA', 'SPICE'],
        'Supplies': ['NAPKIN', 'BEVERAGE', 'DINNER', 'CONTAINER', 'FOIL', 'DOUGH',
                    'TORTILLA', 'SUPPLY'],
        'Beverages': ['SYRUP', 'COLA', 'WATER', 'MINERAL', 'DRINK', 'SODA', 'TEA',
                     'BEVERAGE', 'COKE', 'TOPO', 'CHICO']
    };
    
    static categorize(description: string): string {
        if (!description) return 'Other';
        
        const upperDesc = description.toUpperCase();
        
        for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
            if (keywords.some(keyword => upperDesc.includes(keyword))) {
                return category;
            }
        }
        
        return 'Other';
    }
}

/**
 * Price Analysis Engine - implements 20% threshold detection from Plan2.md
 */
class PriceAnalyzer {
    static calculatePriceChange(currentPrice: number, previousPrice: number): {
        changeAmount: number;
        changePercent: number;
        isSignificant: boolean;
    } {
        if (!previousPrice || previousPrice === 0) {
            return { changeAmount: 0, changePercent: 0, isSignificant: false };
        }
        
        const changeAmount = currentPrice - previousPrice;
        const changePercent = (changeAmount / previousPrice) * 100;
        const isSignificant = Math.abs(changePercent) >= 20.0; // 20% threshold from Plan2.md
        
        return {
            changeAmount: parseFloat(changeAmount.toFixed(4)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            isSignificant
        };
    }
}

/**
 * CSV Parser - handles 51-field US Foods format
 */
class CSVParser {
    static parseDate(dateStr: string): Date {
        // Handle MM/DD/YYYY format from US Foods
        const [month, day, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
    }
    
    static parseNumber(numStr: string): number {
        if (!numStr || numStr.trim() === '') return 0;
        return parseFloat(numStr.replace(/,/g, ''));
    }
    
    static async parseCSVFile(filePath: string): Promise<{
        invoice: ParsedInvoice;
        items: ParsedInvoiceItem[];
    }> {
        const content = await fs.readFile(filePath, 'utf-8');
        
        return new Promise((resolve, reject) => {
            Papa.parse<USFoodsCSVRow>(content, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        if (results.errors.length > 0) {
                            console.warn(`⚠️  Parse warnings for ${filePath}:`, results.errors);
                        }
                        
                        const rows = results.data;
                        if (rows.length === 0) {
                            throw new Error('No data rows found');
                        }
                        
                        // Parse invoice header from first row
                        const firstRow = rows[0];
                        const invoice: ParsedInvoice = {
                            document_number: firstRow.DocumentNumber,
                            invoice_date: this.parseDate(firstRow.DocumentDate),
                            net_amount: this.parseNumber(firstRow['NetAmountAfter Adjustment'] || firstRow.NetAmountAfter),
                            customer_name: firstRow.CustomerName,
                            file_name: path.basename(filePath)
                        };
                        
                        // Parse all invoice items
                        const items: ParsedInvoiceItem[] = rows.map(row => {
                            const packInfo = PackSizeParser.parse(row.PackingSize);
                            const category = ProductCategorizer.categorize(row.ProductDescription);
                            
                            return {
                                product_number: row.ProductNumber,
                                product_description: row.ProductDescription,
                                supplier_label: row['Product Label'] || '',
                                pack_size: row.PackingSize || '',
                                qty_shipped: this.parseNumber(row.QtyShip),
                                pricing_unit: row.PricingUnit || 'EA',
                                unit_price: this.parseNumber(row.UnitPrice),
                                extended_price: this.parseNumber(row.ExtendedPrice),
                                product_category: category
                            };
                        });
                        
                        resolve({ invoice, items });
                    } catch (error) {
                        reject(new Error(`Failed to parse ${filePath}: ${error.message}`));
                    }
                },
                error: (error) => {
                    reject(new Error(`Papa Parse error for ${filePath}: ${error.message}`));
                }
            });
        });
    }
}

/**
 * Database Import Functions - Modified for 360 Location
 */
class DatabaseImporter {
    private locationId = '00d1700c-bc59-40cd-af98-a91143164bfb'; // 360 location ID
    private vendorId: string | null = null;
    
    async initialize(): Promise<void> {
        console.log('🔍 Initializing database connection for 360 location...');
        
        // Test connection first
        const { data: testData, error: testError } = await supabase
            .from('vendors')
            .select('id, name')
            .limit(1);
            
        if (testError) {
            throw new Error(`Database connection failed: ${testError.message}`);
        }
        
        console.log('✅ Database connection successful');
        console.log('📍 Using 360 location:', this.locationId);
        
        // Get US Foods vendor
        const { data: vendor, error: vendorError } = await supabase
            .from('vendors')
            .select('id')
            .eq('vendor_code', 'USFOODS')
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
        
        // Insert or update products in master database
        for (const item of items) {
            await this.upsertProduct(item);
        }
        
        // Insert invoice items
        const invoiceItems = items.map(item => ({
            invoice_id: savedInvoice.id,
            product_number: item.product_number,
            product_description: item.product_description,
            supplier_label: item.supplier_label,
            pack_size: item.pack_size,
            qty_shipped: item.qty_shipped,
            pricing_unit: item.pricing_unit,
            unit_price: item.unit_price,
            extended_price: item.extended_price,
            product_category: item.product_category
        }));
        
        const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(invoiceItems);
            
        if (itemsError) {
            throw new Error(`Failed to insert invoice items: ${itemsError.message}`);
        }
        
        // Create price history records
        await this.createPriceHistory(savedInvoice.id, items);
        
        console.log(`✅ Imported invoice ${invoice.document_number} with ${items.length} items`);
    }
    
    private async upsertProduct(item: ParsedInvoiceItem): Promise<void> {
        const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('product_number', item.product_number)
            .single();
            
        if (!existing) {
            const { error } = await supabase
                .from('products')
                .insert([{
                    product_number: item.product_number,
                    name: item.product_description,
                    category: item.product_category || 'Other',
                    brand: item.supplier_label,
                    supplier_labels: [item.supplier_label],
                    base_unit: item.pricing_unit,
                    standard_pack_sizes: [item.pack_size]
                }]);
                
            if (error && !error.message.includes('duplicate')) {
                console.warn(`⚠️  Failed to insert product ${item.product_number}:`, error.message);
            }
        }
    }
    
    private async createPriceHistory(invoiceId: string, items: ParsedInvoiceItem[]): Promise<void> {
        const priceRecords = [];
        
        for (const item of items) {
            // Get product ID
            const { data: product } = await supabase
                .from('products')
                .select('id')
                .eq('product_number', item.product_number)
                .single();
                
            if (!product) continue;
            
            // Get previous price for comparison
            const { data: previousPrice } = await supabase
                .from('product_prices')
                .select('unit_price, price_date')
                .eq('product_id', product.id)
                .eq('location_id', this.locationId)
                .order('price_date', { ascending: false })
                .limit(1)
                .single();
                
            // Calculate price change
            let priceChange = { changeAmount: 0, changePercent: 0, isSignificant: false };
            if (previousPrice) {
                priceChange = PriceAnalyzer.calculatePriceChange(item.unit_price, previousPrice.unit_price);
            }
            
            priceRecords.push({
                product_id: product.id,
                location_id: this.locationId,
                invoice_item_id: null, // Will be set after invoice_items insertion
                unit_price: item.unit_price,
                pack_size: item.pack_size,
                pricing_unit: item.pricing_unit,
                price_date: new Date().toISOString().split('T')[0],
                supplier_label: item.supplier_label,
                vendor_id: this.vendorId,
                price_change_percent: priceChange.changePercent,
                price_change_amount: priceChange.changeAmount,
                previous_price: previousPrice?.unit_price || null,
                previous_price_date: previousPrice?.price_date || null,
                is_significant_change: priceChange.isSignificant,
                quantity_purchased: item.qty_shipped,
                extended_amount: item.extended_price
            });
            
            // Create price alert if significant change
            if (priceChange.isSignificant) {
                await this.createPriceAlert(product.id, item, priceChange);
            }
        }
        
        if (priceRecords.length > 0) {
            const { error } = await supabase
                .from('product_prices')
                .insert(priceRecords);
                
            if (error) {
                console.warn(`⚠️  Failed to insert price records:`, error.message);
            }
        }
    }
    
    private async createPriceAlert(
        productId: string, 
        item: ParsedInvoiceItem, 
        priceChange: { changeAmount: number; changePercent: number; isSignificant: boolean }
    ): Promise<void> {
        const alertLevel = Math.abs(priceChange.changePercent) >= 30 ? 'CRITICAL' :
                          Math.abs(priceChange.changePercent) >= 20 ? 'HIGH' : 'MEDIUM';
                          
        const alertType = priceChange.changePercent > 0 ? 'PRICE_INCREASE' : 'PRICE_DECREASE';
        
        const { error } = await supabase
            .from('price_alerts')
            .insert([{
                product_id: productId,
                location_id: this.locationId,
                alert_type: alertType,
                alert_level: alertLevel,
                current_price: item.unit_price,
                previous_price: item.unit_price - priceChange.changeAmount,
                price_change_amount: priceChange.changeAmount,
                price_change_percent: priceChange.changePercent,
                pack_size: item.pack_size,
                pricing_unit: item.pricing_unit,
                supplier_label: item.supplier_label,
                alert_date: new Date().toISOString().split('T')[0],
                change_reasons: ['PRICE_ANALYSIS'],
                status: 'ACTIVE'
            }]);
            
        if (error) {
            console.warn(`⚠️  Failed to create price alert:`, error.message);
        }
    }
}

/**
 * Main Processing Function
 */
async function process360Invoices() {
    console.log('🚀 Starting US Foods 360 Location Invoice Processing...\n');
    console.log('📊 Process arguments:', process.argv);
    
    const importer = new DatabaseImporter();
    console.log('🔧 Initializing database importer...');
    await importer.initialize();
    console.log('✅ Database importer initialized');
    
    // Test with single file first, then expand to all directories
    const testMode = process.argv.includes('--test');
    const invoicesDirs = [
        '/Users/marcofigueroa/LOS PINOS - USFOODS/INVOICES/360/1',
        '/Users/marcofigueroa/LOS PINOS - USFOODS/INVOICES/360/2'
    ];
    
    let totalProcessed = 0;
    let totalErrors = 0;
    
    for (const dir of invoicesDirs) {
        console.log(`\n📁 Processing directory: ${dir}`);
        
        try {
            const files = await fs.readdir(dir);
            const csvFiles = files.filter(file => file.endsWith('.csv'));
            
            console.log(`Found ${csvFiles.length} CSV files`);
            
            const filesToProcess = testMode ? csvFiles.slice(0, 1) : csvFiles;
            
            for (const file of filesToProcess) {
                const filePath = path.join(dir, file);
                
                try {
                    console.log(`📄 Processing: ${file}`);
                    
                    const { invoice, items } = await CSVParser.parseCSVFile(filePath);
                    await importer.importInvoice(invoice, items);
                    
                    totalProcessed++;
                    
                    if (testMode) {
                        console.log(`🧪 Test mode: stopping after 1 file`);
                        break;
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing ${file}:`, error.message);
                    totalErrors++;
                }
            }
        } catch (error) {
            console.error(`❌ Error reading directory ${dir}:`, error.message);
        }
    }
    
    console.log('\n🎉 Processing Complete!');
    console.log(`✅ Successfully processed: ${totalProcessed} invoices`);
    console.log(`❌ Errors encountered: ${totalErrors} invoices`);
    
    // Generate summary statistics
    await generateSummaryStats();
}

/**
 * Generate Summary Statistics
 */
async function generateSummaryStats() {
    console.log('\n📊 Generating 360 Location Summary Statistics...');
    
    // Invoice summary for 360 location only
    const { data: invoiceStats } = await supabase
        .from('invoices')
        .select('count(*), sum(net_amount)')
        .eq('location_id', '00d1700c-bc59-40cd-af98-a91143164bfb')
        .eq('processing_status', 'COMPLETED');
        
    // Product summary using our existing functions
    const { data: productStats } = await supabase
        .rpc('get_products_by_category');
        
    // Alert summary
    const { data: alertStats } = await supabase
        .rpc('get_active_alerts_by_level');
    
    console.log('\n📈 360 Location Summary Statistics:');
    if (invoiceStats?.[0]) {
        console.log(`💰 Total 360 Invoices: ${invoiceStats[0].count}`);
        console.log(`💵 Total 360 Amount: $${invoiceStats[0].sum?.toLocaleString() || 0}`);
    }
    
    if (productStats) {
        console.log('\n🏷️  Products by Category (All Locations):');
        productStats.forEach(stat => {
            console.log(`   ${stat.category}: ${stat.count} products`);
        });
    }
    
    if (alertStats) {
        console.log('\n⚠️  Active Price Alerts (All Locations):');
        alertStats.forEach(stat => {
            console.log(`   ${stat.alert_level}: ${stat.count} alerts`);
        });
    }
}

// Run the script
console.log('🔍 Checking if should run...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

// Simplified check for main execution
if (process.argv[1].includes('process-360-invoices')) {
    console.log('🚀 Running main process...');
    process360Invoices().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
} else {
    console.log('📋 Script loaded as module');
}