#!/usr/bin/env node
/**
 * CLI Script to recalculate all 3 scores for existing IC Memos:
 * - Score v4.0 (Contrarian/Turnaround Model)
 * - Turnaround Score
 * - Piotroski F-Score
 * 
 * Quintiles are based on Score v4.0 only.
 * 
 * Usage: node packages/worker/dist/cli-recalculate-all-scores.js
 */
import 'dotenv/config';
import { icMemosRepository } from '@arc/database';
import { calculateConvictionScoreV4, getV4Quintile, getV4Recommendation } from './scoring/conviction-score-v4.js';
import { calculateTurnaroundScore } from './scoring/turnaround-score.js';
import { calculatePiotroskiFScore } from './scoring/piotroski-fscore.js';

interface RecalculationResult {
  memoId: string;
  ticker: string;
  scoreV4: number | null;
  scoreV4Quintile: string | null;
  scoreV4Recommendation: string | null;
  turnaroundScore: number | null;
  piotroskiScore: number | null;
  success: boolean;
  error?: string;
}

async function recalculateAllScores() {
  console.log('='.repeat(70));
  console.log('RECALCULATING ALL 3 SCORES FOR IC MEMOS');
  console.log('Score v4.0 | Turnaround | Piotroski F-Score');
  console.log('='.repeat(70));
  
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
      
      // Calculate all 3 scores in parallel
      const [v4Result, turnaroundResult, piotroskiResult] = await Promise.all([
        calculateConvictionScoreV4(ticker),
        calculateTurnaroundScore(ticker),
        calculatePiotroskiFScore(ticker),
      ]);
      
      // Score v4.0
      const scoreV4 = v4Result.score;
      const scoreV4Quintile = getV4Quintile(scoreV4);
      const scoreV4Recommendation = getV4Recommendation(scoreV4Quintile);
      
      // Turnaround Score
      const turnaroundScore = turnaroundResult?.score ?? null;
      
      // Piotroski F-Score
      const piotroskiScore = piotroskiResult?.fscore ?? null;
      
      // Update database with all 3 scores
      await icMemosRepository.updateAllScores(memo.memoId, {
        scoreV4: scoreV4.toString(),
        scoreV4Quintile,
        scoreV4Recommendation,
        scoreV4Components: v4Result.components,
        turnaroundScore: turnaroundScore?.toString() ?? null,
        turnaroundQuintile: turnaroundResult?.quintile ?? null,
        turnaroundRecommendation: turnaroundResult?.recommendation ?? null,
        turnaroundComponents: turnaroundResult?.components ?? null,
        piotroskiScore: piotroskiScore,
        piotroskiDetails: piotroskiResult?.details ?? null,
      });
      
      const v4Display = `v4=${scoreV4.toFixed(1)} (${scoreV4Quintile})`;
      const turnaroundDisplay = turnaroundScore !== null ? `T=${turnaroundScore.toFixed(1)}` : 'T=N/A';
      const piotroskiDisplay = piotroskiScore !== null ? `P=${piotroskiScore}/9` : 'P=N/A';
      
      console.log(`  ✅ ${ticker}: ${v4Display}, ${turnaroundDisplay}, ${piotroskiDisplay}`);
      
      results.push({
        memoId: memo.memoId,
        ticker,
        scoreV4,
        scoreV4Quintile,
        scoreV4Recommendation,
        turnaroundScore,
        piotroskiScore,
        success: true,
      });
      
      success++;
      
      // Rate limiting - wait 300ms between API calls
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.log(`  ❌ ${ticker}: ${(error as Error).message}`);
      results.push({
        memoId: memo.memoId,
        ticker,
        scoreV4: null,
        scoreV4Quintile: null,
        scoreV4Recommendation: null,
        turnaroundScore: null,
        piotroskiScore: null,
        success: false,
        error: (error as Error).message,
      });
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('RECALCULATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total processed: ${processed}`);
  console.log(`Success: ${success} (${(success/processed*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${(failed/processed*100).toFixed(1)}%)`);
  
  // Summary statistics
  const successResults = results.filter(r => r.success);
  const v4Scores = successResults.map(r => r.scoreV4!).filter(s => s !== null);
  const turnaroundScores = successResults.map(r => r.turnaroundScore!).filter(s => s !== null);
  const piotroskiScores = successResults.map(r => r.piotroskiScore!).filter(s => s !== null);
  
  if (v4Scores.length > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('SCORE STATISTICS');
    console.log('-'.repeat(70));
    
    const avgV4 = v4Scores.reduce((a, b) => a + b, 0) / v4Scores.length;
    console.log(`\nScore v4.0 (0-100):`);
    console.log(`  Average: ${avgV4.toFixed(1)}`);
    console.log(`  Min: ${Math.min(...v4Scores).toFixed(1)}`);
    console.log(`  Max: ${Math.max(...v4Scores).toFixed(1)}`);
    
    if (turnaroundScores.length > 0) {
      const avgTurnaround = turnaroundScores.reduce((a, b) => a + b, 0) / turnaroundScores.length;
      console.log(`\nTurnaround Score (0-100):`);
      console.log(`  Average: ${avgTurnaround.toFixed(1)}`);
      console.log(`  Min: ${Math.min(...turnaroundScores).toFixed(1)}`);
      console.log(`  Max: ${Math.max(...turnaroundScores).toFixed(1)}`);
    }
    
    if (piotroskiScores.length > 0) {
      const avgPiotroski = piotroskiScores.reduce((a, b) => a + b, 0) / piotroskiScores.length;
      console.log(`\nPiotroski F-Score (0-9):`);
      console.log(`  Average: ${avgPiotroski.toFixed(1)}`);
      console.log(`  Min: ${Math.min(...piotroskiScores)}`);
      console.log(`  Max: ${Math.max(...piotroskiScores)}`);
    }
    
    // Quintile distribution (based on Score v4.0)
    const v4Quintiles = successResults.reduce((acc, r) => {
      if (r.scoreV4Quintile) {
        acc[r.scoreV4Quintile] = (acc[r.scoreV4Quintile] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n' + '-'.repeat(70));
    console.log('QUINTILE DISTRIBUTION (Based on Score v4.0)');
    console.log('-'.repeat(70));
    ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].forEach(q => {
      const count = v4Quintiles[q] || 0;
      const pct = (count / v4Scores.length * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(count / v4Scores.length * 30));
      console.log(`  ${q}: ${count.toString().padStart(3)} (${pct.padStart(5)}%) ${bar}`);
    });
    
    // Top 10 by Score v4.0
    console.log('\n' + '-'.repeat(70));
    console.log('TOP 10 BY SCORE v4.0');
    console.log('-'.repeat(70));
    const top10 = successResults
      .filter(r => r.scoreV4 !== null)
      .sort((a, b) => (b.scoreV4 || 0) - (a.scoreV4 || 0))
      .slice(0, 10);
    
    top10.forEach((r, i) => {
      const v4 = r.scoreV4?.toFixed(1) || 'N/A';
      const t = r.turnaroundScore?.toFixed(1) || 'N/A';
      const p = r.piotroskiScore !== null ? `${r.piotroskiScore}/9` : 'N/A';
      console.log(`  ${(i+1).toString().padStart(2)}. ${r.ticker.padEnd(8)} v4=${v4.padStart(5)} T=${t.padStart(5)} P=${p.padStart(4)} [${r.scoreV4Quintile}] ${r.scoreV4Recommendation}`);
    });
  }
  
  process.exit(0);
}

recalculateAllScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
