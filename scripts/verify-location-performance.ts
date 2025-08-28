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

async function verifyLocationPerformance() {
  console.log('📍 Verifying Location Performance data accuracy...\n');

  try {
    // 1. Get ACTUAL location performance from invoices
    console.log('1. Getting REAL location performance from invoices table...');
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select(`
        net_amount,
        invoice_date,
        location:locations(name)
      `)
      .order('invoice_date');

    if (invoicesError) {
      console.error('❌ Error fetching invoices:', invoicesError);
      return;
    }

    if (!invoices || invoices.length === 0) {
      console.log('⚠️ No invoices found');
      return;
    }

    // Group by location
    const locationStats = new Map<string, {
      total_spend: number;
      invoice_count: number;
      last_invoice_date: string;
    }>();

    invoices.forEach(invoice => {
      const location = invoice.location as any;
      const locationName = location?.name || 'Unknown';
      
      if (!locationStats.has(locationName)) {
        locationStats.set(locationName, {
          total_spend: 0,
          invoice_count: 0,
          last_invoice_date: ''
        });
      }
      
      const stats = locationStats.get(locationName)!;
      stats.total_spend += invoice.net_amount || 0;
      stats.invoice_count += 1;
      
      // Track latest date
      if (invoice.invoice_date > stats.last_invoice_date) {
        stats.last_invoice_date = invoice.invoice_date;
      }
    });

    console.log('✅ ACTUAL location performance from invoices:');
    let actualTotal = 0;
    locationStats.forEach((stats, locationName) => {
      const avgInvoice = stats.total_spend / stats.invoice_count;
      const lastOrder = new Date(stats.last_invoice_date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      console.log(`  ${locationName}:`);
      console.log(`    Total Spend: $${stats.total_spend.toLocaleString()}`);
      console.log(`    Invoices: ${stats.invoice_count}`);
      console.log(`    Avg Invoice: $${avgInvoice.toLocaleString()}`);
      console.log(`    Last Order: ${lastOrder}`);
      console.log('');
      
      actualTotal += stats.total_spend;
    });
    console.log(`📊 TOTAL ACTUAL SPEND: $${actualTotal.toLocaleString()}\n`);

    // 2. Get what the dashboard currently shows
    console.log('2. Getting DASHBOARD location performance...');
    const { getLocationComparison } = await import('../lib/supabase/analytics-simple');
    const dashboardLocations = await getLocationComparison();

    console.log('✅ DASHBOARD location performance:');
    let dashboardTotal = 0;
    dashboardLocations.forEach(location => {
      console.log(`  ${location.location_name}:`);
      console.log(`    Total Spend: $${location.total_spend.toLocaleString()}`);
      console.log(`    Invoices: ${location.total_invoices}`);
      console.log(`    Avg Invoice: $${location.avg_invoice_value.toLocaleString()}`);
      console.log(`    Last Order: ${new Date(location.last_invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      console.log('');
      
      dashboardTotal += location.total_spend;
    });
    console.log(`📊 TOTAL DASHBOARD SPEND: $${dashboardTotal.toLocaleString()}\n`);

    // 3. Compare accuracy
    console.log('3. ACCURACY ANALYSIS:');
    const difference = Math.abs(actualTotal - dashboardTotal);
    const percentDiff = actualTotal > 0 ? (difference / actualTotal) * 100 : 100;

    console.log(`  📈 Actual Total: $${actualTotal.toLocaleString()}`);
    console.log(`  📊 Dashboard Total: $${dashboardTotal.toLocaleString()}`);
    console.log(`  📉 Difference: $${difference.toLocaleString()} (${percentDiff.toFixed(1)}%)`);

    // 4. Location-by-location comparison
    console.log('\n4. LOCATION-BY-LOCATION COMPARISON:');
    locationStats.forEach((actualStats, locationName) => {
      const dashboardLocation = dashboardLocations.find(l => l.location_name === locationName);
      
      if (dashboardLocation) {
        const spendDiff = Math.abs(actualStats.total_spend - dashboardLocation.total_spend);
        const spendPercent = actualStats.total_spend > 0 ? (spendDiff / actualStats.total_spend) * 100 : 100;
        const invoiceDiff = Math.abs(actualStats.invoice_count - dashboardLocation.total_invoices);
        
        console.log(`  ${locationName}:`);
        console.log(`    Spend: Actual $${actualStats.total_spend.toLocaleString()} vs Dashboard $${dashboardLocation.total_spend.toLocaleString()} (${spendPercent.toFixed(1)}% diff)`);
        console.log(`    Invoices: Actual ${actualStats.invoice_count} vs Dashboard ${dashboardLocation.total_invoices} (${invoiceDiff} diff)`);
      } else {
        console.log(`  ${locationName}: Missing from dashboard`);
      }
    });

    // 5. Overall assessment
    console.log('\n5. OVERALL ASSESSMENT:');
    if (percentDiff < 1) {
      console.log('✅ ACCURATE: Location Performance data is accurate within 1%');
    } else if (percentDiff < 10) {
      console.log(`⚠️ SOMEWHAT ACCURATE: Location Performance is within ${percentDiff.toFixed(1)}%`);
    } else {
      console.log('❌ INACCURATE: Location Performance data has significant discrepancies');
      console.log('🔧 RECOMMENDATION: Review location comparison calculation logic');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the verification
verifyLocationPerformance();