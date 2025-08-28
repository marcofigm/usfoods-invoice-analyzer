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

async function verifyMonthlyTrends() {
  console.log('📊 Verifying Monthly Spend Trends data accuracy...\n');

  try {
    // 1. Get actual monthly spending from invoices
    console.log('1. Getting REAL monthly spending from invoices table...');
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('invoice_date, net_amount')
      .order('invoice_date');

    if (invoicesError) {
      console.error('❌ Error fetching invoices:', invoicesError);
      return;
    }

    if (!invoices || invoices.length === 0) {
      console.log('⚠️ No invoices found');
      return;
    }

    // Group by month/year
    const monthlyActual = new Map<string, { total: number, count: number }>();
    
    invoices.forEach(invoice => {
      const date = new Date(invoice.invoice_date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyActual.has(monthKey)) {
        monthlyActual.set(monthKey, { total: 0, count: 0 });
      }
      
      const month = monthlyActual.get(monthKey)!;
      month.total += invoice.net_amount || 0;
      month.count += 1;
    });

    console.log('✅ ACTUAL monthly spending from invoices:');
    const sortedActual = Array.from(monthlyActual.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12); // Last 12 months

    let actualTotal = 0;
    sortedActual.forEach(([month, data]) => {
      const date = new Date(month + '-01');
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`  ${monthName}: $${data.total.toLocaleString()} (${data.count} invoices)`);
      actualTotal += data.total;
    });
    console.log(`  📊 TOTAL ACTUAL: $${actualTotal.toLocaleString()}\n`);

    // 2. Get what the dashboard currently shows
    console.log('2. Getting DASHBOARD monthly trends (what chart shows)...');
    const { getMonthlySpendTrends } = await import('../lib/supabase/analytics-simple');
    const dashboardTrends = await getMonthlySpendTrends(12);

    console.log('✅ DASHBOARD monthly trends:');
    let dashboardTotal = 0;
    dashboardTrends.forEach(trend => {
      console.log(`  ${trend.month_name}: $${trend.total_spend.toLocaleString()} (${trend.invoice_count} invoices est.)`);
      dashboardTotal += trend.total_spend;
    });
    console.log(`  📊 TOTAL DASHBOARD: $${dashboardTotal.toLocaleString()}\n`);

    // 3. Compare accuracy
    console.log('3. ACCURACY ANALYSIS:');
    const difference = Math.abs(actualTotal - dashboardTotal);
    const percentDiff = actualTotal > 0 ? (difference / actualTotal) * 100 : 100;

    console.log(`  📈 Actual Total: $${actualTotal.toLocaleString()}`);
    console.log(`  📊 Dashboard Total: $${dashboardTotal.toLocaleString()}`);
    console.log(`  📉 Difference: $${difference.toLocaleString()} (${percentDiff.toFixed(1)}%)`);

    if (percentDiff > 10) {
      console.log(`  ❌ INACCURATE: Dashboard is off by more than 10%`);
      console.log(`  🔧 RECOMMENDATION: Dashboard is using mock/estimated data instead of real invoice data`);
    } else if (percentDiff > 1) {
      console.log(`  ⚠️ SOMEWHAT ACCURATE: Dashboard is within ${percentDiff.toFixed(1)}% of actual`);
    } else {
      console.log(`  ✅ ACCURATE: Dashboard matches actual data within 1%`);
    }

    // 4. Check specific months for pattern analysis
    console.log('\n4. MONTH-BY-MONTH COMPARISON:');
    const dashboardByMonth = new Map(dashboardTrends.map(t => [
      `${t.year}-${t.month.toString().padStart(2, '0')}`, 
      t.total_spend
    ]));

    sortedActual.slice(-6).forEach(([monthKey, actualData]) => {
      const dashboardAmount = dashboardByMonth.get(monthKey) || 0;
      const monthDiff = Math.abs(actualData.total - dashboardAmount);
      const monthPercent = actualData.total > 0 ? (monthDiff / actualData.total) * 100 : 100;
      
      const date = new Date(monthKey + '-01');
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      console.log(`  ${monthName}: Actual $${actualData.total.toLocaleString()} vs Dashboard $${dashboardAmount.toLocaleString()} (${monthPercent.toFixed(1)}% diff)`);
    });

    // 5. Date range analysis
    console.log('\n5. DATE RANGE ANALYSIS:');
    const actualDates = invoices.map(i => new Date(i.invoice_date)).sort((a, b) => a.getTime() - b.getTime());
    const earliestInvoice = actualDates[0];
    const latestInvoice = actualDates[actualDates.length - 1];
    
    console.log(`  📅 Invoice Date Range: ${earliestInvoice.toLocaleDateString()} to ${latestInvoice.toLocaleDateString()}`);
    console.log(`  📊 Dashboard Date Range: ${dashboardTrends[0]?.month_name} to ${dashboardTrends[dashboardTrends.length - 1]?.month_name}`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the verification
verifyMonthlyTrends();