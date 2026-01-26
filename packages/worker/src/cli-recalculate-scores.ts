#!/usr/bin/env node
/**
 * Recalculate Conviction Scores v2.0 for all existing IC Memos
 * 
 * This script:
 * 1. Fetches all completed IC Memos from the database
 * 2. For each memo, calculates the Conviction Score v2.0
 * 3. Updates the memo with the new score and breakdown
 * 4. Updates the associated idea with the new score
 * 
 * Usage: node packages/worker/dist/cli-recalculate-scores.js
 */

import 'dotenv/config';
import { icMemosRepository, ideasRepository } from '@arc/database';
import { calculateConvictionScoreV2 } from './scoring/conviction-score-v2.js';

interface RecalculationResult {
  memoId: string;
  ticker: string;
  oldScore: number | null;
  newScore: number;
  recommendation: string;
  success: boolean;
  error?: string;
}

async function recalculateAllScores(): Promise<void> {
  console.log('='.repeat(80));
  console.log('CONVICTION SCORE v2.0 - MASS RECALCULATION');
  console.log('='.repeat(80));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  // Fetch all completed IC Memos
  console.log('[1/4] Fetching completed IC Memos...');
  const memos = await icMemosRepository.getCompleted(500); // Get up to 500 memos
  console.log(`Found ${memos.length} completed IC Memos to process`);
  console.log('');

  if (memos.length === 0) {
    console.log('No IC Memos to process. Exiting.');
    return;
  }

  // Process each memo
  console.log('[2/4] Recalculating scores...');
  const results: RecalculationResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < memos.length; i++) {
    const memo = memos[i];
    const progress = `[${i + 1}/${memos.length}]`;
    
    try {
      console.log(`${progress} Processing ${memo.ticker}...`);
      
      // Get supporting analyses from memo
      const supportingAnalyses = memo.supportingAnalyses 
        ? Object.entries(memo.supportingAnalyses).map(([key, value]: [string, any]) => ({
            promptName: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            result: value?.result || value,
            success: value?.success !== false,
            error: value?.error,
          }))
        : [];

      // Calculate new score using v2.0
      const scoreV2 = await calculateConvictionScoreV2(
        memo.ticker,
        memo.memoContent,
        supportingAnalyses
      );

      // Determine recommendation based on score
      const recommendation = getRecommendationFromScore(scoreV2.total);

      // Update IC Memo with new score
      await icMemosRepository.updateRecommendation(
        memo.memoId,
        recommendation as any,
        Math.round(scoreV2.total)
      );

      // Update memo content with v2.0 breakdown
      if (memo.memoContent) {
        const updatedContent = {
          ...memo.memoContent,
          _conviction_score_v2: scoreV2,
        };
        await icMemosRepository.updateContent(memo.memoId, updatedContent as any);
      }

      // Update associated idea with new score
      if (memo.ideaId) {
        try {
          await ideasRepository.updateScores(
            memo.ideaId,
            {
              total: scoreV2.total,
              edge_clarity: scoreV2.components.moat_analysis,
              business_quality_prior: scoreV2.fundamental_score,
              financial_resilience_prior: scoreV2.quant_score,
              valuation_tension: scoreV2.sentiment_score,
              catalyst_clarity: scoreV2.prob_outperformance,
              information_availability: scoreV2.data_quality.data_completeness,
              complexity_penalty: 0,
              disclosure_friction_penalty: 0,
            },
            String(scoreV2.total),
            String(scoreV2.total)
          );
        } catch (ideaError) {
          console.warn(`  Warning: Could not update idea ${memo.ideaId}: ${(ideaError as Error).message}`);
        }
      }

      results.push({
        memoId: memo.memoId,
        ticker: memo.ticker,
        oldScore: memo.conviction,
        newScore: scoreV2.total,
        recommendation: scoreV2.recommendation,
        success: true,
      });

      console.log(`  ✓ ${memo.ticker}: ${memo.conviction || 'N/A'} → ${scoreV2.total.toFixed(1)} (${scoreV2.recommendation})`);
      successCount++;

      // Small delay to avoid rate limiting on FMP API
      await sleep(500);

    } catch (error) {
      console.error(`  ✗ ${memo.ticker}: Error - ${(error as Error).message}`);
      results.push({
        memoId: memo.memoId,
        ticker: memo.ticker,
        oldScore: memo.conviction,
        newScore: 0,
        recommendation: 'ERROR',
        success: false,
        error: (error as Error).message,
      });
      failCount++;
    }
  }

  // Print summary
  console.log('');
  console.log('[3/4] Recalculation complete!');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total IC Memos processed: ${memos.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('');

  // Print detailed results table
  console.log('[4/4] Detailed Results:');
  console.log('-'.repeat(80));
  console.log('| Ticker     | Old Score | New Score | Change  | Recommendation |');
  console.log('-'.repeat(80));

  for (const result of results) {
    if (result.success) {
      const change = result.oldScore 
        ? (result.newScore - result.oldScore).toFixed(1)
        : 'N/A';
      const changeStr = result.oldScore 
        ? (result.newScore > result.oldScore ? `+${change}` : change)
        : 'NEW';
      console.log(
        `| ${result.ticker.padEnd(10)} | ${String(result.oldScore || 'N/A').padEnd(9)} | ${result.newScore.toFixed(1).padEnd(9)} | ${changeStr.padEnd(7)} | ${result.recommendation.padEnd(14)} |`
      );
    } else {
      console.log(
        `| ${result.ticker.padEnd(10)} | ${String(result.oldScore || 'N/A').padEnd(9)} | ERROR     | -       | ${(result.error?.substring(0, 14) || 'Unknown')} |`
      );
    }
  }
  console.log('-'.repeat(80));

  // Calculate statistics
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgNewScore = successfulResults.reduce((sum, r) => sum + r.newScore, 0) / successfulResults.length;
    const avgOldScore = successfulResults
      .filter(r => r.oldScore !== null)
      .reduce((sum, r) => sum + (r.oldScore || 0), 0) / successfulResults.filter(r => r.oldScore !== null).length;

    console.log('');
    console.log('STATISTICS:');
    console.log(`Average Old Score: ${avgOldScore.toFixed(1)}`);
    console.log(`Average New Score: ${avgNewScore.toFixed(1)}`);
    console.log(`Average Change: ${(avgNewScore - avgOldScore).toFixed(1)}`);
    
    // Distribution by recommendation
    const recommendations = successfulResults.reduce((acc, r) => {
      acc[r.recommendation] = (acc[r.recommendation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('');
    console.log('RECOMMENDATION DISTRIBUTION:');
    for (const [rec, count] of Object.entries(recommendations).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / successfulResults.length) * 100).toFixed(1);
      console.log(`  ${rec}: ${count} (${pct}%)`);
    }
  }

  console.log('');
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
}

function getRecommendationFromScore(score: number): string {
  if (score >= 70) return 'buy';
  if (score >= 60) return 'invest';
  if (score >= 50) return 'hold';
  if (score >= 40) return 'reduce';
  return 'reject';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the script
recalculateAllScores()
  .then(() => {
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
