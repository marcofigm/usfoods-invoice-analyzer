#!/usr/bin/env tsx

import { getCombinedPriceAnalysis } from '../lib/supabase/analytics-simple';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testSegmentedAnalysis() {
  console.log('🧪 Testing segmented price analysis...\n');

  try {
    const { increases, packChanges } = await getCombinedPriceAnalysis();

    console.log('📈 REAL PRICE INCREASES (same pack size):');
    console.log(`✅ Found ${increases.length} real price increases`);
    increases.forEach((increase, index) => {
      console.log(`  ${index + 1}. ${increase.product_number} - ${increase.name.substring(0, 40)}...`);
      console.log(`     📦 Pack: ${increase.pack_size}`);
      console.log(`     📈 Increase: +${increase.price_increase_percent.toFixed(1)}% ($${increase.previous_price} → $${increase.current_price})`);
      console.log(`     🏢 Location: ${increase.location_name} | Orders: ${increase.purchase_frequency}`);
      console.log('');
    });

    console.log('\n📦 PACK SIZE CHANGES:');
    console.log(`✅ Found ${packChanges.length} products with pack size changes`);
    packChanges.forEach((change, index) => {
      console.log(`  ${index + 1}. ${change.product_number} - ${change.name.substring(0, 40)}...`);
      console.log(`     📦 Pack Options: ${change.pack_sizes.join(', ')}`);
      console.log(`     💰 Best Value: ${change.best_value_pack}`);
      console.log(`     📊 Current: ${change.current_pack} @ $${change.current_price}`);
      console.log('');
    });

    // Check for the apron that was causing issues
    const apronIncrease = increases.find(i => i.product_number === '3077930');
    const apronPackChange = packChanges.find(p => p.product_number === '3077930');

    console.log('🎯 APRON ANALYSIS (SKU 3077930):');
    if (apronIncrease) {
      console.log(`   ❌ ERROR: Apron still showing as price increase!`);
      console.log(`   Details: ${apronIncrease.pack_size} - ${apronIncrease.price_increase_percent.toFixed(1)}%`);
    } else if (apronPackChange) {
      console.log(`   ✅ SUCCESS: Apron correctly identified as pack size change`);
      console.log(`   Pack Options: ${apronPackChange.pack_sizes.join(', ')}`);
      console.log(`   Best Value: ${apronPackChange.best_value_pack}`);
    } else {
      console.log(`   ℹ️ Apron not in either category - expected if no significant price changes`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSegmentedAnalysis();