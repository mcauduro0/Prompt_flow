#!/usr/bin/env node
/**
 * CLI Script to recalculate Score v4.0 and Turnaround Score for all existing IC Memos
 * 
 * Usage: node packages/worker/dist/cli-recalculate-v4-turnaround.js
 */
import 'dotenv/config';
import { icMemosRepository } from '@arc/database';
import { calculateConvictionScoreV4, getV4Quintile, getV4Recommendation } from './scoring/conviction-score-v4.js';
import { calculateTurnaroundScore, getTurnaroundQuintile, getTurnaroundRecommendation } from './scoring/turnaround-score.js';

interface RecalculationResult {
  memoId: string;
  ticker: string;
  scoreV4: number | null;
  scoreV4Quintile: string | null;
  turnaroundScore: number | null;
  turnaroundQuintile: number | null;
  success: boolean;
  error?: string;
}

async function recalculateAllScores() {
  console.log('='.repeat(60));
  console.log('RECALCULATING SCORE v4.0 AND TURNAROUND SCORE FOR ALL IC MEMOS');
  console.log('='.repeat(60));
  
  // Get all IC Memos
  const allMemos = await icMemosRepository.getAll(1000);
  console.log(`\nFound ${allMemos.length} IC Memos to process\n`);
  
  const results: RecalculationResult[] = [];
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  for (const memo of allMemos) {
    processed++;
    const ticker = memo.ticker;
    
    try {
      console.log(`[${processed}/${allMemos.length}] Processing ${ticker}...`);
      
      // Calculate Score v4.0
      const v4Result = await calculateConvictionScoreV4(ticker);
      const scoreV4 = v4Result.score;
      const scoreV4Quintile = getV4Quintile(scoreV4);
      const scoreV4Recommendation = getV4Recommendation(scoreV4Quintile);
      
      // Calculate Turnaround Score
      const turnaroundResult = await calculateTurnaroundScore(ticker);
      if (!turnaroundResult) {
        throw new Error('Failed to calculate Turnaround Score');
      }
      const turnaroundScore = turnaroundResult.score;
      const turnaroundQuintile = getTurnaroundQuintile(turnaroundScore);
      const turnaroundRecommendation = getTurnaroundRecommendation(turnaroundQuintile);
      
      // Update database using repository method
      await icMemosRepository.updateScoresV4(memo.memoId, {
        scoreV4: scoreV4.toString(),
        scoreV4Quintile,
        scoreV4Recommendation,
        turnaroundScore: turnaroundScore.toString(),
        turnaroundQuintile,
        turnaroundRecommendation,
      });
      
      console.log(`  ✅ ${ticker}: v4.0=${scoreV4.toFixed(1)} (${scoreV4Quintile}), Turnaround=${turnaroundScore.toFixed(1)} (Q${turnaroundQuintile})`);
      
      results.push({
        memoId: memo.memoId,
        ticker,
        scoreV4,
        scoreV4Quintile,
        turnaroundScore,
        turnaroundQuintile,
        success: true,
      });
      
      success++;
      
      // Rate limiting - wait 200ms between API calls
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`  ❌ ${ticker}: ${(error as Error).message}`);
      results.push({
        memoId: memo.memoId,
        ticker,
        scoreV4: null,
        scoreV4Quintile: null,
        turnaroundScore: null,
        turnaroundQuintile: null,
        success: false,
        error: (error as Error).message,
      });
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('RECALCULATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  
  // Summary statistics
  const successResults = results.filter(r => r.success);
  const v4Scores = successResults.map(r => r.scoreV4!).filter(s => s !== null);
  const turnaroundScores = successResults.map(r => r.turnaroundScore!).filter(s => s !== null);
  
  if (v4Scores.length > 0) {
    const avgV4 = v4Scores.reduce((a, b) => a + b, 0) / v4Scores.length;
    const avgTurnaround = turnaroundScores.reduce((a, b) => a + b, 0) / turnaroundScores.length;
    
    console.log('\nScore Statistics:');
    console.log(`  Score v4.0: avg=${avgV4.toFixed(1)}, min=${Math.min(...v4Scores).toFixed(1)}, max=${Math.max(...v4Scores).toFixed(1)}`);
    console.log(`  Turnaround: avg=${avgTurnaround.toFixed(1)}, min=${Math.min(...turnaroundScores).toFixed(1)}, max=${Math.max(...turnaroundScores).toFixed(1)}`);
    
    // Quintile distribution
    const v4Quintiles = successResults.reduce((acc, r) => {
      if (r.scoreV4Quintile) {
        acc[r.scoreV4Quintile] = (acc[r.scoreV4Quintile] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nScore v4.0 Quintile Distribution:');
    Object.entries(v4Quintiles).sort().forEach(([q, count]) => {
      console.log(`  ${q}: ${count} (${(count / v4Scores.length * 100).toFixed(1)}%)`);
    });
  }
  
  process.exit(0);
}

recalculateAllScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
