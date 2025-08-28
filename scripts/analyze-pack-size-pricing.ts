#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PricePoint {
  date: string;
  location: string;
  pack_size: string;
  unit_price: number;
  document_number: string;
}

interface PackSizeAnalysis {
  product_number: string;
  product_name: string;
  pack_sizes: {
    [pack_size: string]: {
      price_history: PricePoint[];
      min_price: number;
      max_price: number;
      latest_price: number;
      price_trend: number; // percentage change from first to last
      has_real_increase: boolean;
    }
  };
  has_pack_size_changes: boolean;
  recommended_alert_type: 'price_increase' | 'pack_size_change' | 'both' | 'none';
}

async function analyzePackSizePricing() {
  console.log('🔍 Analyzing pack size pricing patterns...\n');

  try {
    // Get all invoice items grouped by product and pack size
    const { data: invoiceItems, error } = await supabase
      .from('invoice_items')
      .select(`
        product_number,
        product_description,
        pack_size,
        unit_price,
        invoice:invoices!inner(
          invoice_date,
          document_number,
          location:locations(name)
        )
      `)
      .order('product_number');

    if (error) {
      console.error('❌ Error fetching invoice items:', error);
      return;
    }

    if (!invoiceItems) {
      console.log('⚠️ No invoice items found');
      return;
    }

    // Group by product number
    const productMap = new Map<string, PricePoint[]>();
    
    invoiceItems.forEach((item) => {
      const invoice = item.invoice as any;
      const location = invoice?.location as any;
      
      const pricePoint: PricePoint = {
        date: invoice?.invoice_date || '',
        location: location?.name || 'Unknown',
        pack_size: item.pack_size || 'N/A',
        unit_price: item.unit_price || 0,
        document_number: invoice?.document_number || ''
      };

      if (!productMap.has(item.product_number)) {
        productMap.set(item.product_number, []);
      }
      productMap.get(item.product_number)!.push(pricePoint);
    });

    console.log(`📊 Analyzing ${productMap.size} products...\n`);

    const analyses: PackSizeAnalysis[] = [];
    let productsWithPackSizeIssues = 0;
    let productsWithRealPriceIncreases = 0;

    productMap.forEach((pricePoints, productNumber) => {
      const firstItem = invoiceItems.find(i => i.product_number === productNumber);
      const productName = firstItem?.product_description || 'Unknown';

      // Group by pack size
      const packSizeMap = new Map<string, PricePoint[]>();
      pricePoints.forEach(point => {
        if (!packSizeMap.has(point.pack_size)) {
          packSizeMap.set(point.pack_size, []);
        }
        packSizeMap.get(point.pack_size)!.push(point);
      });

      const analysis: PackSizeAnalysis = {
        product_number: productNumber,
        product_name: productName,
        pack_sizes: {},
        has_pack_size_changes: packSizeMap.size > 1,
        recommended_alert_type: 'none'
      };

      // Analyze each pack size
      packSizeMap.forEach((points, packSize) => {
        // Sort by date
        const sortedPoints = points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const prices = sortedPoints.map(p => p.unit_price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const latestPrice = sortedPoints[sortedPoints.length - 1]?.unit_price || 0;
        
        // Calculate price trend (first to last)
        const firstPrice = sortedPoints[0]?.unit_price || 0;
        const priceTrend = firstPrice > 0 ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0;
        const hasRealIncrease = priceTrend > 5; // >5% increase within same pack size

        analysis.pack_sizes[packSize] = {
          price_history: sortedPoints,
          min_price: minPrice,
          max_price: maxPrice,
          latest_price: latestPrice,
          price_trend: priceTrend,
          has_real_increase: hasRealIncrease
        };
      });

      // Determine recommendation
      const hasRealIncreases = Object.values(analysis.pack_sizes).some(ps => ps.has_real_increase);
      
      if (hasRealIncreases && analysis.has_pack_size_changes) {
        analysis.recommended_alert_type = 'both';
      } else if (hasRealIncreases) {
        analysis.recommended_alert_type = 'price_increase';
        productsWithRealPriceIncreases++;
      } else if (analysis.has_pack_size_changes) {
        analysis.recommended_alert_type = 'pack_size_change';
        productsWithPackSizeIssues++;
      }

      analyses.push(analysis);
    });

    // Report findings
    console.log('📈 ANALYSIS RESULTS:');
    console.log(`✅ Total products analyzed: ${analyses.length}`);
    console.log(`🔀 Products with multiple pack sizes: ${productsWithPackSizeIssues + analyses.filter(a => a.recommended_alert_type === 'both').length}`);
    console.log(`📈 Products with real price increases (>5%): ${productsWithRealPriceIncreases + analyses.filter(a => a.recommended_alert_type === 'both').length}`);

    console.log('\n🎯 TOP ISSUES TO SHOW IN DASHBOARD:\n');

    // Show products with both issues
    const bothIssues = analyses.filter(a => a.recommended_alert_type === 'both');
    if (bothIssues.length > 0) {
      console.log('⚠️ BOTH PRICE INCREASES & PACK CHANGES:');
      bothIssues.slice(0, 3).forEach((analysis, index) => {
        console.log(`  ${index + 1}. ${analysis.product_number} - ${analysis.product_name.substring(0, 40)}...`);
        Object.entries(analysis.pack_sizes).forEach(([packSize, data]) => {
          if (data.has_real_increase) {
            console.log(`     📈 ${packSize}: +${data.price_trend.toFixed(1)}% ($${data.min_price} → $${data.latest_price})`);
          } else {
            console.log(`     📦 ${packSize}: $${data.latest_price} (stable)`);
          }
        });
      });
      console.log();
    }

    // Show products with only price increases  
    const priceOnly = analyses.filter(a => a.recommended_alert_type === 'price_increase')
      .sort((a, b) => {
        const aMaxTrend = Math.max(...Object.values(a.pack_sizes).map(ps => ps.price_trend));
        const bMaxTrend = Math.max(...Object.values(b.pack_sizes).map(ps => ps.price_trend));
        return bMaxTrend - aMaxTrend;
      });

    if (priceOnly.length > 0) {
      console.log('📈 REAL PRICE INCREASES (same pack size):');
      priceOnly.slice(0, 5).forEach((analysis, index) => {
        const bestTrend = Object.entries(analysis.pack_sizes).reduce((best, [packSize, data]) => 
          data.price_trend > best.trend ? { packSize, trend: data.price_trend, data } : best, 
          { packSize: '', trend: -999, data: null as any }
        );
        console.log(`  ${index + 1}. ${analysis.product_number} - ${analysis.product_name.substring(0, 40)}...`);
        console.log(`     📈 ${bestTrend.packSize}: +${bestTrend.trend.toFixed(1)}% ($${bestTrend.data.min_price} → $${bestTrend.data.latest_price})`);
      });
      console.log();
    }

    // Show the problematic case (3077930)
    const apronAnalysis = analyses.find(a => a.product_number === '3077930');
    if (apronAnalysis) {
      console.log('🎯 CASE STUDY - SKU 3077930 (APRON):');
      console.log(`   Product: ${apronAnalysis.product_name}`);
      console.log(`   Pack Size Changes: ${apronAnalysis.has_pack_size_changes ? 'YES' : 'NO'}`);
      console.log(`   Recommendation: ${apronAnalysis.recommended_alert_type.toUpperCase()}`);
      Object.entries(apronAnalysis.pack_sizes).forEach(([packSize, data]) => {
        console.log(`   ${packSize}:`);
        console.log(`     Price Range: $${data.min_price} - $${data.max_price}`);
        console.log(`     Trend: ${data.price_trend > 0 ? '+' : ''}${data.price_trend.toFixed(1)}%`);
        console.log(`     Real Increase: ${data.has_real_increase ? 'YES' : 'NO'}`);
        console.log(`     Per Unit: $${data.latest_price / getUnitsInPack(packSize)}`);
      });
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

function getUnitsInPack(packSize: string): number {
  // Simple parser for common pack formats
  if (packSize.includes('/')) {
    const match = packSize.match(/(\d+)\/(\d+)/);
    if (match) {
      return parseInt(match[1]) * parseInt(match[2]);
    }
  }
  const match = packSize.match(/(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

// Run the analysis
analyzePackSizePricing();