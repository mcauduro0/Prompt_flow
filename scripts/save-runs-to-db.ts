/**
 * Save Lane A and Lane B run results to the database
 * This makes the telemetry data available in the dashboard
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Read all run files from output directory
const outputDir = '/home/ubuntu/Prompt_flow/output';

interface RunRecord {
  runId: string;
  runType: string;
  status: string;
  runDate: string;
  completedAt: string;
  payload: any;
  errorMessage?: string;
}

async function main() {
  console.log('========================================');
  console.log('Saving Run Results to Database');
  console.log('========================================\n');
  
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} run files\n`);
  
  const runs: RunRecord[] = [];
  
  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (file.startsWith('lane_a_run_')) {
      runs.push({
        runId: content.runId,
        runType: 'daily_discovery',
        status: content.success ? 'completed' : 'failed',
        runDate: new Date(Date.now() - content.duration_ms).toISOString(),
        completedAt: new Date().toISOString(),
        payload: {
          universeSize: content.universeSize,
          analyzed: content.analyzed,
          rawIdeas: content.ideasGenerated,
          persisted: content.ideasGenerated,
          duration_ms: content.duration_ms,
          telemetry: content.telemetry,
          errors: content.errors,
        },
      });
      console.log(`✅ Lane A run: ${content.runId}`);
      console.log(`   Ideas: ${content.ideasGenerated}, Cost: $${content.telemetry?.total_cost?.toFixed(4)}`);
    } else if (file.startsWith('lane_b_run_')) {
      runs.push({
        runId: content.runId,
        runType: 'lane_b_research',
        status: content.success ? 'completed' : 'failed',
        runDate: new Date(Date.now() - content.duration_ms).toISOString(),
        completedAt: new Date().toISOString(),
        payload: {
          ticker: content.ticker,
          companyName: content.companyName,
          duration_ms: content.duration_ms,
          analyses: content.analyses,
          investmentThesis: content.investmentThesis,
          telemetry: content.telemetry,
          errors: content.errors,
        },
      });
      console.log(`✅ Lane B run: ${content.runId}`);
      console.log(`   Ticker: ${content.ticker}, Cost: $${content.telemetry?.total_cost?.toFixed(4)}`);
    }
  }
  
  // Save to a consolidated runs file for the API to read
  const runsFile = '/home/ubuntu/Prompt_flow/output/runs_db.json';
  
  // Merge with existing runs if file exists
  let existingRuns: RunRecord[] = [];
  if (fs.existsSync(runsFile)) {
    existingRuns = JSON.parse(fs.readFileSync(runsFile, 'utf-8'));
  }
  
  // Add new runs (avoid duplicates)
  const existingIds = new Set(existingRuns.map(r => r.runId));
  const newRuns = runs.filter(r => !existingIds.has(r.runId));
  const allRuns = [...existingRuns, ...newRuns];
  
  fs.writeFileSync(runsFile, JSON.stringify(allRuns, null, 2));
  
  console.log(`\n========================================`);
  console.log(`Summary:`);
  console.log(`  Total runs in DB: ${allRuns.length}`);
  console.log(`  New runs added: ${newRuns.length}`);
  console.log(`  File: ${runsFile}`);
  console.log(`========================================`);
  
  // Calculate telemetry summary
  let totalCost = 0;
  let totalTokens = 0;
  let laneARuns = 0;
  let laneBRuns = 0;
  let totalIdeas = 0;
  
  for (const run of allRuns) {
    if (run.payload?.telemetry) {
      totalCost += run.payload.telemetry.total_cost || 0;
      totalTokens += run.payload.telemetry.total_tokens || 0;
    }
    if (run.runType === 'daily_discovery') {
      laneARuns++;
      totalIdeas += run.payload?.persisted || run.payload?.rawIdeas || 0;
    } else if (run.runType === 'lane_b_research') {
      laneBRuns++;
    }
  }
  
  console.log(`\nTelemetry Summary:`);
  console.log(`  Lane A runs: ${laneARuns}`);
  console.log(`  Lane B runs: ${laneBRuns}`);
  console.log(`  Total ideas generated: ${totalIdeas}`);
  console.log(`  Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
}

main().catch(console.error);
