/**
 * Test script to verify data providers are working correctly
 */

import { createFMPClient, createPolygonClient } from '@arc/retriever';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testFMP() {
  console.log('\n=== Testing FMP API ===');
  const fmp = createFMPClient();
  
  // Test 1: Get company profile
  console.log('\n1. Testing getProfile(AAPL)...');
  const profileResult = await fmp.getProfile('AAPL');
  if (profileResult.success) {
    console.log('✅ Profile retrieved:', {
      ticker: profileResult.data?.ticker,
      companyName: profileResult.data?.companyName,
      sector: profileResult.data?.sector,
      marketCap: profileResult.data?.marketCap,
    });
  } else {
    console.log('❌ Profile failed:', profileResult.error);
  }

  // Test 2: Get key metrics
  console.log('\n2. Testing getKeyMetrics(AAPL)...');
  const metricsResult = await fmp.getKeyMetrics('AAPL');
  if (metricsResult.success) {
    console.log('✅ Metrics retrieved:', {
      pe: metricsResult.data?.pe,
      evToEbitda: metricsResult.data?.evToEbitda,
      roic: metricsResult.data?.roic,
    });
  } else {
    console.log('❌ Metrics failed:', metricsResult.error);
  }

  // Test 3: Screen stocks
  console.log('\n3. Testing screenStocks (mid-cap US)...');
  const screenResult = await fmp.screenStocks({
    marketCapMoreThan: 1_000_000_000,
    marketCapLowerThan: 10_000_000_000,
    country: 'US',
    exchange: 'NYSE,NASDAQ',
    limit: 10,
  });
  if (screenResult.success && screenResult.data) {
    console.log(`✅ Screen returned ${screenResult.data.length} stocks:`, 
      screenResult.data.slice(0, 5).map((s: string) => s));
  } else {
    console.log('❌ Screen failed:', screenResult.error);
  }

  return profileResult.success && metricsResult.success;
}

async function testPolygon() {
  console.log('\n=== Testing Polygon API ===');
  const polygon = createPolygonClient();
  
  // Test 1: Get latest price
  console.log('\n1. Testing getLatestPrice(AAPL)...');
  const priceResult = await polygon.getLatestPrice('AAPL');
  if (priceResult.success) {
    console.log('✅ Price retrieved:', {
      close: priceResult.data?.close,
      volume: priceResult.data?.volume,
      timestamp: priceResult.data?.timestamp,
    });
  } else {
    console.log('❌ Price failed:', priceResult.error);
  }

  // Test 2: Get news
  console.log('\n2. Testing getNews(AAPL)...');
  const newsResult = await polygon.getNews('AAPL', 3);
  if (newsResult.success && newsResult.data) {
    console.log(`✅ News retrieved: ${newsResult.data.length} articles`);
    newsResult.data.slice(0, 2).forEach((n: any) => {
      console.log(`   - ${n.title?.slice(0, 60)}...`);
    });
  } else {
    console.log('❌ News failed:', newsResult.error);
  }

  return priceResult.success;
}

async function main() {
  console.log('========================================');
  console.log('ARC Investment Factory - Data Provider Test');
  console.log('========================================');
  
  console.log('\nEnvironment check:');
  console.log(`  FMP_API_KEY: ${process.env.FMP_API_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`  POLYGON_API_KEY: ${process.env.POLYGON_API_KEY ? 'SET' : 'NOT SET'}`);
  
  const fmpOk = await testFMP();
  const polygonOk = await testPolygon();
  
  console.log('\n========================================');
  console.log('Summary:');
  console.log(`  FMP: ${fmpOk ? '✅ Working' : '❌ Failed'}`);
  console.log(`  Polygon: ${polygonOk ? '✅ Working' : '❌ Failed'}`);
  console.log('========================================');
  
  if (!fmpOk || !polygonOk) {
    process.exit(1);
  }
}

main().catch(console.error);
