/**
 * ARC Investment Factory - Job Scheduler
 * Cron-based job scheduling for DAG runs
 */

import { runDailyDiscovery } from '../orchestrator/daily-discovery.js';
import { runLaneB } from '../orchestrator/lane-b-runner.js';
import { runICBundle } from '../orchestrator/ic-bundle.js';

interface ScheduledJob {
  name: string;
  cron: string;
  handler: () => Promise<void>;
  enabled: boolean;
}

const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: 'daily_discovery',
    cron: '0 6 * * *', // 06:00 UTC daily
    handler: runDailyDiscovery,
    enabled: true,
  },
  {
    name: 'daily_lane_b',
    cron: '0 7 * * *', // 07:00 UTC daily (after Lane A)
    handler: runLaneB,
    enabled: true,
  },
  {
    name: 'weekly_ic_bundle',
    cron: '0 8 * * 5', // 08:00 UTC every Friday
    handler: runICBundle,
    enabled: true,
  },
  {
    name: 'monthly_process_audit',
    cron: '0 9 1 * *', // 09:00 UTC first day of month
    handler: async () => {
      console.log('[scheduler] monthly_process_audit - placeholder');
      // TODO: Implement process audit
    },
    enabled: false,
  },
];

/**
 * Parse cron expression and check if it matches current time
 */
function matchesCron(cron: string, date: Date): boolean {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.split(' ');

  const matches = (field: string, value: number): boolean => {
    if (field === '*') return true;
    if (field.includes(',')) {
      return field.split(',').some((f) => matches(f, value));
    }
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return value >= start && value <= end;
    }
    if (field.includes('/')) {
      const [, step] = field.split('/');
      return value % parseInt(step) === 0;
    }
    return parseInt(field) === value;
  };

  return (
    matches(minute, date.getUTCMinutes()) &&
    matches(hour, date.getUTCHours()) &&
    matches(dayOfMonth, date.getUTCDate()) &&
    matches(month, date.getUTCMonth() + 1) &&
    matches(dayOfWeek, date.getUTCDay())
  );
}

/**
 * Check and run due jobs
 */
export async function checkAndRunJobs(): Promise<void> {
  const now = new Date();
  console.log(`[scheduler] Checking jobs at ${now.toISOString()}`);

  for (const job of SCHEDULED_JOBS) {
    if (!job.enabled) continue;

    if (matchesCron(job.cron, now)) {
      console.log(`[scheduler] Running job: ${job.name}`);
      try {
        await job.handler();
        console.log(`[scheduler] Completed job: ${job.name}`);
      } catch (error) {
        console.error(`[scheduler] Failed job: ${job.name}`, error);
      }
    }
  }
}

/**
 * Start the scheduler (runs every minute)
 */
export function startScheduler(): NodeJS.Timeout {
  console.log('[scheduler] Starting scheduler...');

  // Run immediately
  checkAndRunJobs();

  // Then run every minute
  return setInterval(checkAndRunJobs, 60 * 1000);
}

/**
 * Run a specific job by name
 */
export async function runJob(name: string): Promise<void> {
  const job = SCHEDULED_JOBS.find((j) => j.name === name);
  if (!job) {
    throw new Error(`Unknown job: ${name}`);
  }

  console.log(`[scheduler] Manually running job: ${name}`);
  await job.handler();
}

/**
 * Get list of scheduled jobs
 */
export function getScheduledJobs(): Array<{ name: string; cron: string; enabled: boolean }> {
  return SCHEDULED_JOBS.map(({ name, cron, enabled }) => ({ name, cron, enabled }));
}
