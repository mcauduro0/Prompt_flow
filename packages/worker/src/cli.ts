#!/usr/bin/env node
/**
 * ARC Investment Factory - Worker CLI
 * Command-line interface for running jobs
 */

import { runDailyDiscovery } from './orchestrator/daily-discovery.js';
import { runLaneB } from './orchestrator/lane-b-runner.js';
import { startScheduler, runJob, getScheduledJobs } from './jobs/scheduler.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'discovery':
    case 'lane-a':
      console.log('Running daily discovery (Lane A)...');
      await runDailyDiscovery();
      break;

    case 'lane-b':
    case 'research':
      console.log('Running Lane B research...');
      await runLaneB();
      break;

    case 'scheduler':
    case 'start':
      console.log('Starting scheduler...');
      startScheduler();
      // Keep process alive
      process.on('SIGINT', () => {
        console.log('Shutting down scheduler...');
        process.exit(0);
      });
      break;

    case 'run':
      const jobName = args[1];
      if (!jobName) {
        console.error('Usage: worker run <job-name>');
        process.exit(1);
      }
      console.log(`Running job: ${jobName}`);
      await runJob(jobName);
      break;

    case 'list':
    case 'jobs':
      console.log('Scheduled jobs:');
      const jobs = getScheduledJobs();
      for (const job of jobs) {
        console.log(`  ${job.name}: ${job.cron} (${job.enabled ? 'enabled' : 'disabled'})`);
      }
      break;

    case 'help':
    default:
      console.log(`
ARC Investment Factory - Worker CLI

Usage:
  worker discovery     Run daily discovery (Lane A)
  worker lane-b        Run Lane B research
  worker scheduler     Start the job scheduler
  worker run <job>     Run a specific job
  worker list          List scheduled jobs
  worker help          Show this help message

Jobs:
  daily_discovery      Lane A - idea generation (06:00 UTC)
  daily_lane_b         Lane B - deep research (07:00 UTC)
  weekly_ic_bundle     Weekly IC bundle (08:00 UTC Friday)
  monthly_process_audit Monthly audit (09:00 UTC 1st)
      `);
      break;
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
