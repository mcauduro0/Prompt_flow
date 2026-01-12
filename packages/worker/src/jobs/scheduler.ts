/**
 * ARC Investment Factory - Job Scheduler
 * Timezone: America/Sao_Paulo
 */

import { CronJob } from 'cron';
import {
  SYSTEM_TIMEZONE,
  SCHEDULES,
} from '@arc/shared';
import { runDailyDiscovery } from '../orchestrator/daily-discovery.js';
import { runLaneB } from '../orchestrator/lane-b-runner.js';
import { generateICBundle } from '../orchestrator/ic-bundle.js';
import { runWeeklyQAReport } from './weekly-qa-report.js';

function isWeekday(): boolean {
  const now = new Date();
  const day = now.getDay();
  return day >= 1 && day <= 5;
}

export class JobScheduler {
  private jobs: CronJob[] = [];
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    
    console.log(`[Scheduler] Starting with timezone: ${SYSTEM_TIMEZONE}`);

    // Lane A: Daily Discovery - 06:00 weekdays
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_A_CRON,
      async () => {
        if (!isWeekday()) return;
        console.log('[Scheduler] Running Lane A Discovery');
        await runDailyDiscovery();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // Lane B: Deep Research - 08:00 weekdays
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_B_CRON,
      async () => {
        if (!isWeekday()) return;
        console.log('[Scheduler] Running Lane B Research');
        await runLaneB();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // QA Report: Friday 18:00
    this.jobs.push(new CronJob(
      '0 18 * * 5',
      async () => {
        console.log('[Scheduler] Running Weekly QA Report');
        await runWeeklyQAReport();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // IC Bundle: Friday 19:00
    this.jobs.push(new CronJob(
      '0 19 * * 5',
      async () => {
        console.log('[Scheduler] Running IC Bundle');
        await generateICBundle();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    this.isRunning = true;
    console.log('[Scheduler] All jobs scheduled');
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;
    console.log('[Scheduler] Stopped');
  }
}

export const scheduler = new JobScheduler();
export default scheduler;
