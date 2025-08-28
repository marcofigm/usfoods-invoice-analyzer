#!/usr/bin/env tsx

import { getMonthlySpendTrends } from '../lib/supabase/analytics-simple';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testDashboardMonthlyData() {
  console.log('🧪 Testing dashboard monthly trends implementation...\n');

  try {
    // Test the function that dashboard actually uses
    const trends = await getMonthlySpendTrends(12);

    console.log('📊 Dashboard Monthly Trends Results:');
    console.log(`✅ Generated ${trends.length} months of data`);
    console.log(`📅 Date range: ${trends[0]?.month_name} ${trends[0]?.year} to ${trends[trends.length - 1]?.month_name} ${trends[trends.length - 1]?.year}`);

    const totalSpend = trends.reduce((sum, t) => sum + t.total_spend, 0);
    const totalInvoices = trends.reduce((sum, t) => sum + t.invoice_count, 0);

    console.log(`💰 Total spend: $${totalSpend.toLocaleString()}`);
    console.log(`📄 Total invoices: ${totalInvoices}`);
    console.log(`📈 Avg monthly spend: $${(totalSpend / trends.length).toLocaleString()}`);

    console.log('\n📅 Monthly Breakdown:');
    trends.forEach(trend => {
      console.log(`  ${trend.month_name} ${trend.year}: $${trend.total_spend.toLocaleString()} (${trend.invoice_count} invoices)`);
    });

    // Check for specific months we know should exist
    const july2025 = trends.find(t => t.month === 7 && t.year === 2025);
    const august2024 = trends.find(t => t.month === 8 && t.year === 2024);

    console.log('\n🔍 Specific Month Verification:');
    if (july2025) {
      console.log(`✅ July 2025: $${july2025.total_spend.toLocaleString()} (${july2025.invoice_count} invoices)`);
    } else {
      console.log('❌ July 2025 data missing');
    }

    if (august2024) {
      console.log(`✅ August 2024: $${august2024.total_spend.toLocaleString()} (${august2024.invoice_count} invoices)`);
    } else {
      console.log('❌ August 2024 data missing');
    }

    // Verify this matches our expected totals
    const expectedTotal = 385467.72; // From our verification script
    const difference = Math.abs(totalSpend - expectedTotal);
    const percentDiff = (difference / expectedTotal) * 100;

    console.log('\n🎯 Final Accuracy Check:');
    console.log(`Expected Total: $${expectedTotal.toLocaleString()}`);
    console.log(`Actual Total: $${totalSpend.toLocaleString()}`);
    console.log(`Difference: $${difference.toLocaleString()} (${percentDiff.toFixed(2)}%)`);

    if (percentDiff < 0.1) {
      console.log('✅ SUCCESS: Dashboard is using 100% accurate real invoice data!');
    } else {
      console.log('❌ ISSUE: Dashboard data doesn\'t match expected totals');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDashboardMonthlyData();