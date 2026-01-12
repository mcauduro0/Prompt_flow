/**
 * ARC Investment Factory - Job Scheduler
 * Timezone: America/Sao_Paulo
 */

import { CronJob } from 'cron';
import {
  SYSTEM_TIMEZONE,
  SCHEDULES,
} from '@arc/shared';
import { runsRepository } from '@arc/database';
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
  private triggerCheckInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log(`[Scheduler] Starting with timezone: ${SYSTEM_TIMEZONE}`);

    // Check for manual triggers on startup
    await this.checkManualTriggers();

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

    // Check for manual triggers every 30 seconds
    this.triggerCheckInterval = setInterval(async () => {
      await this.checkManualTriggers();
    }, 30000);

    this.isRunning = true;
    console.log('[Scheduler] All jobs scheduled');
  }

  async checkManualTriggers(): Promise<void> {
    try {
      // Check for pending manual Lane A triggers
      const runs = await runsRepository.getByType('manual_lane_a_trigger', 10);
      const pendingRuns = runs.filter(r => r.status === 'running');

      for (const run of pendingRuns) {
        console.log(`[Scheduler] Found manual Lane A trigger: ${run.runId}`);
        
        // Update status to processing
        await runsRepository.updateStatus(run.runId, 'running');
        
        try {
          const payload = run.payload as { dryRun?: boolean; maxIdeas?: number } | null;
          const result = await runDailyDiscovery({
            dryRun: payload?.dryRun ?? false,
            maxIdeas: payload?.maxIdeas ?? 10,
          });
          
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            ...payload,
            result,
            completedAt: new Date().toISOString(),
          });
          
          console.log(`[Scheduler] Manual Lane A completed: ${run.runId}`, result);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane A failed: ${run.runId}`, error);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error checking manual triggers:', error);
    }
  }

  stop(): void {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    if (this.triggerCheckInterval) {
      clearInterval(this.triggerCheckInterval);
      this.triggerCheckInterval = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Stopped');
  }
}

export const scheduler = new JobScheduler();
export default scheduler;
