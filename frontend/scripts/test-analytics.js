#!/usr/bin/env node
/**
 * Test Script for Analytics RPC Functions
 * Tests all 3 analytics RPC functions created in migrations 017-019
 *
 * Functions tested:
 * 1. get_advanced_metrics - Comprehensive dashboard metrics
 * 2. get_sales_time_series - Time-based revenue/profit trends
 * 3. get_product_performance - Product-level analytics
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Track test results
let passed = 0;
let failed = 0;

function logTest(name, success, details = '') {
  if (success) {
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failed++;
  }
}

async function testAdvancedMetrics() {
  console.log('\n📊 Testing get_advanced_metrics...');

  try {
    // Test 1: Call with default parameters (today)
    const { data, error } = await supabase.rpc('get_advanced_metrics');

    if (error) {
      logTest('get_advanced_metrics (default)', false, `Error: ${error.message}`);
      return;
    }

    logTest('get_advanced_metrics (default)', true);

    // Validate response structure
    const requiredFields = [
      'total_revenue', 'total_cost', 'total_profit', 'avg_profit_margin',
      'sales_count', 'avg_ticket', 'payment_breakdown', 'pending_credits',
      'top_products', 'inventory_value', 'low_stock_items'
    ];

    const missingFields = requiredFields.filter(field => !(field in data));

    if (missingFields.length === 0) {
      logTest('Response structure validation', true, `All ${requiredFields.length} fields present`);
      console.log(`   Revenue: $${data.total_revenue}, Profit: $${data.total_profit}, Margin: ${data.avg_profit_margin?.toFixed(2)}%`);
      console.log(`   Sales: ${data.sales_count}, Low Stock Items: ${data.low_stock_items}`);
    } else {
      logTest('Response structure validation', false, `Missing: ${missingFields.join(', ')}`);
    }

    // Test 2: Call with date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    const { data: weekData, error: weekError } = await supabase.rpc('get_advanced_metrics', {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString()
    });

    if (weekError) {
      logTest('get_advanced_metrics (date range)', false, `Error: ${weekError.message}`);
    } else {
      logTest('get_advanced_metrics (date range)', true, `Last 7 days: ${weekData.sales_count} sales`);
    }

  } catch (err) {
    logTest('get_advanced_metrics', false, `Exception: ${err.message}`);
  }
}

async function testSalesTimeSeries() {
  console.log('\n📈 Testing get_sales_time_series...');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Last 30 days

  // Test with different periods
  const periods = ['daily', 'weekly', 'monthly'];

  for (const period of periods) {
    try {
      const { data, error } = await supabase.rpc('get_sales_time_series', {
        p_start_date: startDate.toISOString(),
        p_end_date: new Date().toISOString(),
        p_interval: period
      });

      if (error) {
        logTest(`get_sales_time_series (${period})`, false, `Error: ${error.message}`);
        continue;
      }

      // Validate response is an array
      if (!Array.isArray(data)) {
        logTest(`get_sales_time_series (${period})`, false, 'Response is not an array');
        continue;
      }

      logTest(`get_sales_time_series (${period})`, true, `${data.length} periods returned`);

      // Validate structure of first record if exists
      if (data.length > 0) {
        const requiredFields = ['period_start', 'period_label', 'revenue', 'cost', 'profit', 'profit_margin', 'sales_count', 'avg_ticket'];
        const firstRecord = data[0];
        const missingFields = requiredFields.filter(field => !(field in firstRecord));

        if (missingFields.length === 0) {
          logTest(`Time series structure (${period})`, true, `Sample: ${firstRecord.period_label}, Revenue: $${firstRecord.revenue}`);
        } else {
          logTest(`Time series structure (${period})`, false, `Missing: ${missingFields.join(', ')}`);
        }
      }

    } catch (err) {
      logTest(`get_sales_time_series (${period})`, false, `Exception: ${err.message}`);
    }
  }

  // Test invalid interval
  try {
    const { data, error } = await supabase.rpc('get_sales_time_series', {
      p_interval: 'invalid'
    });

    if (error) {
      logTest('Invalid interval handling', true, 'Correctly rejected invalid interval');
    } else {
      logTest('Invalid interval handling', false, 'Should have rejected invalid interval');
    }
  } catch (err) {
    logTest('Invalid interval handling', true, 'Exception caught for invalid interval');
  }
}

async function testProductPerformance() {
  console.log('\n🏆 Testing get_product_performance...');

  try {
    // Test 1: Default parameters (last 30 days)
    const { data, error } = await supabase.rpc('get_product_performance');

    if (error) {
      logTest('get_product_performance (default)', false, `Error: ${error.message}`);
      return;
    }

    // Validate response is an array
    if (!Array.isArray(data)) {
      logTest('get_product_performance (default)', false, 'Response is not an array');
      return;
    }

    logTest('get_product_performance (default)', true, `${data.length} products returned`);

    // Validate structure
    if (data.length > 0) {
      const requiredFields = ['product_id', 'product_name', 'units_sold', 'revenue', 'cost', 'profit', 'profit_margin', 'avg_price_per_unit'];
      const firstProduct = data[0];
      const missingFields = requiredFields.filter(field => !(field in firstProduct));

      if (missingFields.length === 0) {
        logTest('Product data structure', true, `All ${requiredFields.length} fields present`);
        console.log(`   Top Product: ${firstProduct.product_name}`);
        console.log(`   Units Sold: ${firstProduct.units_sold}, Revenue: $${firstProduct.revenue}, Profit: $${firstProduct.profit}`);
      } else {
        logTest('Product data structure', false, `Missing: ${missingFields.join(', ')}`);
      }
    }

    // Test 2: With limit parameter
    const { data: limitedData, error: limitError } = await supabase.rpc('get_product_performance', {
      p_limit: 5
    });

    if (limitError) {
      logTest('get_product_performance (limit=5)', false, `Error: ${limitError.message}`);
    } else {
      const isCorrectSize = limitedData.length <= 5;
      logTest('get_product_performance (limit=5)', isCorrectSize, `Returned ${limitedData.length} products`);
    }

    // Test 3: With date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    const { data: weekData, error: weekError } = await supabase.rpc('get_product_performance', {
      p_start_date: startDate.toISOString(),
      p_end_date: new Date().toISOString()
    });

    if (weekError) {
      logTest('get_product_performance (date range)', false, `Error: ${weekError.message}`);
    } else {
      logTest('get_product_performance (date range)', true, `Last 7 days: ${weekData.length} products`);
    }

  } catch (err) {
    logTest('get_product_performance', false, `Exception: ${err.message}`);
  }
}

async function runTests() {
  console.log('🧪 Analytics RPC Functions Test Suite');
  console.log('=====================================');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Testing at: ${new Date().toISOString()}\n`);

  await testAdvancedMetrics();
  await testSalesTimeSeries();
  await testProductPerformance();

  // Summary
  console.log('\n=====================================');
  console.log('📋 Test Summary');
  console.log('=====================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All analytics RPC functions are working correctly!');
    console.log('✅ Migrations 015-019 verified successfully');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run the tests
runTests();
