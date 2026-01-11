/**
 * ARC Investment Factory - Job Scheduler
 * 
 * Schedules (LOCKED - America/Sao_Paulo timezone):
 * - Lane A (daily_discovery_run): 06:00 Mon-Fri
 * - Lane B (daily_lane_b): 08:00 Mon-Fri
 * - Weekly QA Report: 18:00 Fridays (per governance spec)
 * - IC Bundle (weekly_ic_bundle): 19:00 Fridays (after QA Report)
 * 
 * IMPORTANT: All schedules use America/Sao_Paulo timezone (NOT UTC)
 * IMPORTANT: All schedules are weekday-only (Mon-Fri)
 */

import {
  SYSTEM_TIMEZONE,
  SCHEDULES,
  isWeekday,
  getCurrentDateInTimezone,
} from '@arc/shared';

// ============================================================================
// TYPES
// ============================================================================

interface ScheduledJob {
  name: string;
  cron: string;
  timezone: string;
  weekdaysOnly: boolean;
  handler: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  lastResult?: 'success' | 'failure' | 'skipped';
  lastError?: string;
}

// ============================================================================
// CRON EXPRESSIONS (LOCKED PARAMETERS)
// ============================================================================

/**
 * Cron expressions for all scheduled jobs
 * Format: minute hour day-of-month month day-of-week
 * 
 * All times are in America/Sao_Paulo timezone
 */
const CRON_EXPRESSIONS = {
  // Lane A: 06:00 Mon-Fri
  LANE_A: '0 6 * * 1-5',
  
  // Lane B: 08:00 Mon-Fri
  LANE_B: '0 8 * * 1-5',
  
  // Weekly QA Report: 18:00 Fridays (per governance spec)
  QA_REPORT: '0 18 * * 5',
  
  // IC Bundle: 19:00 Fridays (after QA Report at 18:00)
  IC_BUNDLE: '0 19 * * 5',
} as const;

// ============================================================================
// SCHEDULED JOBS (LOCKED PARAMETERS)
// ============================================================================

/**
 * Create scheduled jobs with correct timezone and weekday constraints
 */
function createScheduledJobs(handlers: {
  laneA: () => Promise<void>;
  laneB: () => Promise<void>;
  qaReport: () => Promise<void>;
  icBundle: () => Promise<void>;
}): ScheduledJob[] {
  return [
    {
      name: 'daily_discovery',
      cron: CRON_EXPRESSIONS.LANE_A,
      timezone: SYSTEM_TIMEZONE, // America/Sao_Paulo
      weekdaysOnly: true,
      handler: handlers.laneA,
      enabled: true,
    },
    {
      name: 'daily_lane_b',
      cron: CRON_EXPRESSIONS.LANE_B,
      timezone: SYSTEM_TIMEZONE, // America/Sao_Paulo
      weekdaysOnly: true,
      handler: handlers.laneB,
      enabled: true,
    },
    {
      name: 'weekly_qa_report',
      cron: CRON_EXPRESSIONS.QA_REPORT,
      timezone: SYSTEM_TIMEZONE, // America/Sao_Paulo
      weekdaysOnly: true, // Friday only
      handler: handlers.qaReport,
      enabled: true,
    },
    {
      name: 'weekly_ic_bundle',
      cron: CRON_EXPRESSIONS.IC_BUNDLE,
      timezone: SYSTEM_TIMEZONE, // America/Sao_Paulo
      weekdaysOnly: true, // Friday only
      handler: handlers.icBundle,
      enabled: true,
    },
  ];
}

// ============================================================================
// TIMEZONE UTILITIES
// ============================================================================

/**
 * Get current time in America/Sao_Paulo timezone
 */
function getCurrentTimeInSaoPaulo(): Date {
  const now = new Date();
  // Create a date string in Sao Paulo timezone
  const saoPauloTime = now.toLocaleString('en-US', { timeZone: SYSTEM_TIMEZONE });
  return new Date(saoPauloTime);
}

/**
 * Check if current day is a weekday (Mon-Fri)
 */
function isWeekdayInSaoPaulo(): boolean {
  const saoPauloDate = getCurrentTimeInSaoPaulo();
  const day = saoPauloDate.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Check if current day is Friday
 */
function isFridayInSaoPaulo(): boolean {
  const saoPauloDate = getCurrentTimeInSaoPaulo();
  return saoPauloDate.getDay() === 5; // Friday = 5
}

/**
 * Parse cron expression and check if it matches current time
 * Uses America/Sao_Paulo timezone
 */
function matchesCronInTimezone(cron: string, timezone: string): boolean {
  const now = new Date();
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

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
    matches(minute, tzDate.getMinutes()) &&
    matches(hour, tzDate.getHours()) &&
    matches(dayOfMonth, tzDate.getDate()) &&
    matches(month, tzDate.getMonth() + 1) &&
    matches(dayOfWeek, tzDate.getDay())
  );
}

// ============================================================================
// SCHEDULER CLASS
// ============================================================================

export class JobScheduler {
  private jobs: ScheduledJob[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private running: boolean = false;

  constructor(handlers: {
    laneA: () => Promise<void>;
    laneB: () => Promise<void>;
    qaReport: () => Promise<void>;
    icBundle: () => Promise<void>;
  }) {
    this.jobs = createScheduledJobs(handlers);
  }

  /**
   * Check and run due jobs
   */
  async checkAndRunJobs(): Promise<void> {
    const saoPauloTime = getCurrentTimeInSaoPaulo();
    console.log(`[Scheduler] Checking jobs at ${saoPauloTime.toISOString()} (${SYSTEM_TIMEZONE})`);

    for (const job of this.jobs) {
      if (!job.enabled) continue;

      // Check weekday constraint
      if (job.weekdaysOnly && !isWeekdayInSaoPaulo()) {
        continue; // Skip on weekends
      }

      // Check cron match in timezone
      if (matchesCronInTimezone(job.cron, job.timezone)) {
        console.log(`[Scheduler] Running job: ${job.name}`);
        console.log(`[Scheduler] Schedule: ${job.cron} (${job.timezone})`);

        try {
          await job.handler();
          job.lastRun = new Date();
          job.lastResult = 'success';
          console.log(`[Scheduler] Completed job: ${job.name}`);
        } catch (error) {
          job.lastRun = new Date();
          job.lastResult = 'failure';
          job.lastError = error instanceof Error ? error.message : String(error);
          console.error(`[Scheduler] Failed job: ${job.name}`, error);
        }
      }
    }
  }

  /**
   * Start the scheduler (runs every minute)
   */
  start(): void {
    if (this.running) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('[Scheduler] Starting job scheduler');
    console.log(`[Scheduler] Timezone: ${SYSTEM_TIMEZONE}`);
    console.log(`[Scheduler] Current time: ${getCurrentTimeInSaoPaulo().toISOString()}`);
    console.log(`[Scheduler] Is weekday: ${isWeekdayInSaoPaulo()}`);
    console.log(`[Scheduler] Is Friday: ${isFridayInSaoPaulo()}`);
    console.log(`${'='.repeat(60)}\n`);

    // Log registered jobs
    console.log('[Scheduler] Registered jobs:');
    for (const job of this.jobs) {
      console.log(`  - ${job.name}: ${job.cron} (${job.timezone}) - ${job.enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    console.log('');

    // Run immediately
    this.checkAndRunJobs();

    // Then run every minute
    this.intervalId = setInterval(() => this.checkAndRunJobs(), 60 * 1000);
    this.running = true;

    console.log('[Scheduler] Scheduler started. Checking every minute...\n');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running || !this.intervalId) {
      console.log('[Scheduler] Not running');
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.running = false;
    console.log('[Scheduler] Scheduler stopped');
  }

  /**
   * Run a specific job by name (manual trigger)
   */
  async runJob(name: string): Promise<void> {
    const job = this.jobs.find((j) => j.name === name);
    if (!job) {
      throw new Error(`Unknown job: ${name}`);
    }

    console.log(`[Scheduler] Manually running job: ${name}`);
    console.log(`[Scheduler] Bypassing schedule check`);

    try {
      await job.handler();
      job.lastRun = new Date();
      job.lastResult = 'success';
      console.log(`[Scheduler] Completed job: ${name}`);
    } catch (error) {
      job.lastRun = new Date();
      job.lastResult = 'failure';
      job.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Get list of scheduled jobs with status
   */
  getScheduledJobs(): Array<{
    name: string;
    cron: string;
    timezone: string;
    enabled: boolean;
    lastRun?: string;
    lastResult?: string;
  }> {
    return this.jobs.map((job) => ({
      name: job.name,
      cron: job.cron,
      timezone: job.timezone,
      enabled: job.enabled,
      lastRun: job.lastRun?.toISOString(),
      lastResult: job.lastResult,
    }));
  }
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

let defaultScheduler: JobScheduler | null = null;

export function startScheduler(): NodeJS.Timeout {
  console.log('[Scheduler] Starting scheduler with placeholder handlers...');
  console.log('[Scheduler] WARNING: Use JobScheduler class for production');

  // Placeholder handlers
  defaultScheduler = new JobScheduler({
    laneA: async () => {
      console.log('[Scheduler] Lane A placeholder - import actual handler');
    },
    laneB: async () => {
      console.log('[Scheduler] Lane B placeholder - import actual handler');
    },
    qaReport: async () => {
      console.log('[Scheduler] QA Report placeholder - import actual handler');
    },
    icBundle: async () => {
      console.log('[Scheduler] IC Bundle placeholder - import actual handler');
    },
  });

  defaultScheduler.start();

  // Return interval ID for compatibility
  return setInterval(() => {}, 60 * 1000);
}

export async function runJob(name: string): Promise<void> {
  if (!defaultScheduler) {
    throw new Error('Scheduler not started. Call startScheduler() first.');
  }
  await defaultScheduler.runJob(name);
}

export function getScheduledJobs(): Array<{ name: string; cron: string; enabled: boolean }> {
  if (!defaultScheduler) {
    return [];
  }
  return defaultScheduler.getScheduledJobs().map(({ name, cron, enabled }) => ({
    name,
    cron,
    enabled,
  }));
}

export { JobScheduler, CRON_EXPRESSIONS };
export default JobScheduler;
