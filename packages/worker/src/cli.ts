#!/usr/bin/env node
/**
 * ARC Investment Factory - Worker CLI
 */

import { runDailyDiscovery } from './orchestrator/daily-discovery.js';
import { runLaneB } from './orchestrator/lane-b-runner.js';
import { generateICBundle } from './orchestrator/ic-bundle.js';
import { runWeeklyQAReport } from './jobs/weekly-qa-report.js';
import { scheduler } from './jobs/scheduler.js';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'discovery':
      console.log('Running Lane A Discovery...');
      const discoveryResult = await runDailyDiscovery({ dryRun: process.argv.includes('--dry-run') });
      console.log('Result:', JSON.stringify(discoveryResult, null, 2));
      break;
      
    case 'research':
      console.log('Running Lane B Research...');
      const researchResult = await runLaneB({ dryRun: process.argv.includes('--dry-run') });
      console.log('Result:', JSON.stringify(researchResult, null, 2));
      break;
      
    case 'ic-bundle':
      console.log('Generating IC Bundle...');
      const bundleResult = await generateICBundle({ dryRun: process.argv.includes('--dry-run') });
      console.log('Result:', JSON.stringify(bundleResult, null, 2));
      break;
      
    case 'qa-report':
      console.log('Running QA Report...');
      const qaResult = await runWeeklyQAReport();
      console.log('Result:', JSON.stringify(qaResult, null, 2));
      break;
      
    case 'scheduler':
      console.log('Starting scheduler...');
      scheduler.start();
      break;
      
    default:
      console.log('Usage: arc-worker <command>');
      console.log('Commands: discovery, research, ic-bundle, qa-report, scheduler');
      process.exit(1);
  }
}

main().catch(console.error);
