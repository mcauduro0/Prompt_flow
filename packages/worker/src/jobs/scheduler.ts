/**
 * ARC Investment Factory - Job Scheduler
 * Timezone: America/Sao_Paulo
 * 
 * Updated: 2026-01-18
 * - All lanes run daily (Mon-Sun)
 * - Sequential schedule: Lane 0 → Lane A → Lane B → Lane C
 * - Added Lane C (IC Bundle) daily generation
 * - Manual trigger support for all lanes
 */

import { CronJob } from 'cron';
import {
  SYSTEM_TIMEZONE,
  SCHEDULES,
  LANE_B_DAILY_LIMIT,
  LANE_B_WEEKLY_LIMIT,
} from '@arc/shared';
import { runsRepository, ideasRepository } from '@arc/database';
import { runDailyDiscovery } from '../orchestrator/daily-discovery.js';
import { runLaneB } from '../orchestrator/lane-b-runner.js';
import { generateICBundle } from '../orchestrator/ic-bundle.js';
import { runWeeklyQAReport } from './weekly-qa-report.js';
import { Lane0Runner } from '../lane-zero/lane0-runner.js';
import { createDefaultClient } from '@arc/llm-client';

export class JobScheduler {
  private jobs: CronJob[] = [];
  private isRunning = false;
  private triggerCheckInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log(`[Scheduler] Starting with timezone: ${SYSTEM_TIMEZONE}`);
    console.log(`[Scheduler] All lanes run daily (Mon-Sun)`);
    
    // Check for manual triggers on startup
    await this.checkManualTriggers();

    // Lane 0: Substack + Reddit Ingestion - 05:00 daily
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_0_CRON,
      async () => {
        console.log('[Scheduler] Running Lane 0 Ingestion (Substack + Reddit)');
        await this.runLane0();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // Lane A: Daily Discovery - 06:00 daily
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_A_CRON,
      async () => {
        console.log('[Scheduler] Running Lane A Discovery');
        await runDailyDiscovery();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // Lane B: Deep Research - 08:00 daily
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_B_CRON,
      async () => {
        console.log('[Scheduler] Running Lane B Research');
        await runLaneB();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // Lane C: IC Bundle - 10:00 daily
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_C_CRON,
      async () => {
        console.log('[Scheduler] Running Lane C IC Bundle');
        await generateICBundle();
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // QA Report: Friday 18:00
    this.jobs.push(new CronJob(
      SCHEDULES.QA_REPORT_CRON,
      async () => {
        console.log('[Scheduler] Running Weekly QA Report');
        await runWeeklyQAReport();
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
    console.log('[Scheduler] Lane 0: 05:00 daily (Substack + Reddit)');
    console.log('[Scheduler] Lane A: 06:00 daily (Daily Discovery)');
    console.log('[Scheduler] Lane B: 08:00 daily (Deep Research)');
    console.log('[Scheduler] Lane C: 10:00 daily (IC Bundle)');
    console.log('[Scheduler] QA Report: 18:00 Friday');
  }

  /**
   * Run Lane 0 - Substack and Reddit ingestion
   */
  async runLane0(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('[Lane 0] Starting Substack + Reddit ingestion...');
      
      // Create LLM client for idea extraction
      const llmClient = createDefaultClient();
      
      // Create and run Lane 0
      const lane0 = new Lane0Runner(llmClient, {
        enableSubstack: true,
        enableReddit: true,
        maxIdeasPerSource: 50,
        maxIdeasToLaneA: 50,
        minConfidenceForLaneA: 'MEDIUM',
        parallelIngestion: true,
        dryRun: false,
      });
      
      const result = await lane0.run();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log('[Lane 0] Ingestion completed:');
      console.log(`[Lane 0]   - Substack ideas: ${result.stats.substackIdeas}`);
      console.log(`[Lane 0]   - Reddit ideas: ${result.stats.redditIdeas}`);
      console.log(`[Lane 0]   - Normalized ideas: ${result.stats.normalizedIdeas}`);
      console.log(`[Lane 0]   - Published to Lane A: ${result.stats.publishedToLaneA}`);
      console.log(`[Lane 0]   - Duration: ${duration}s`);
      
      if (result.errors.length > 0) {
        console.warn('[Lane 0] Errors:', result.errors);
      }
      
      // Log the report
      console.log('[Lane 0] Report:', result.report);
      
    } catch (error) {
      console.error('[Lane 0] Failed:', error);
    }
  }

  async checkManualTriggers(): Promise<void> {
    try {
      // Check for pending manual Lane 0 triggers
      const lane0Runs = await runsRepository.getByType('manual_lane_0_trigger', 10);
      const pendingLane0Runs = lane0Runs.filter(r => r.status === 'pending' || r.status === 'running');
      
      for (const run of pendingLane0Runs) {
        if (run.status === 'running') continue; // Skip already running
        
        console.log(`[Scheduler] Found manual Lane 0 trigger: ${run.runId}`);
        await runsRepository.updateStatus(run.runId, 'running');
        
        try {
          await this.runLane0();
          
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            completedAt: new Date().toISOString(),
          });
          
          console.log(`[Scheduler] Manual Lane 0 completed: ${run.runId}`);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane 0 failed: ${run.runId}`, error);
        }
      }

      // Check for pending manual Lane A triggers
      const runs = await runsRepository.getByType('manual_lane_a_trigger', 10);
      const pendingRuns = runs.filter(r => r.status === 'pending' || r.status === 'running');
      
      for (const run of pendingRuns) {
        if (run.status === 'running') continue; // Skip already running
        
        console.log(`[Scheduler] Found manual Lane A trigger: ${run.runId}`);
        await runsRepository.updateStatus(run.runId, 'running');
        
        try {
          const payload = run.payload as { dryRun?: boolean; maxIdeas?: number } | null;
          const result = await runDailyDiscovery({
            dryRun: payload?.dryRun ?? false,
            maxIdeas: payload?.maxIdeas ?? 200,
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

      // Check for pending manual Lane B triggers
      const laneB_Runs = await runsRepository.getByType('manual_lane_b_trigger', 10);
      const pendingLaneBRuns = laneB_Runs.filter(r => r.status === 'pending');
      
      for (const run of pendingLaneBRuns) {
        console.log(`[Scheduler] Found manual Lane B trigger: ${run.runId}`);
        await runsRepository.updateStatus(run.runId, 'running');
        
        try {
          const payload = run.payload as { ideaIds?: string[]; maxPackets?: number } | null;
          const ideaIds = payload?.ideaIds || [];
          const maxPackets = payload?.maxPackets || LANE_B_DAILY_LIMIT;
          
          console.log(`[Scheduler] Processing Lane B for ${ideaIds.length} ideas (max: ${maxPackets})`);
          
          // Run Lane B with specific idea IDs
          const result = await runLaneB({
            ideaIds: ideaIds.slice(0, maxPackets),
            maxPackets,
          });
          
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            ...payload,
            result,
            completedAt: new Date().toISOString(),
          });
          
          console.log(`[Scheduler] Manual Lane B completed: ${run.runId}`, result);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane B failed: ${run.runId}`, error);
        }
      }

      // Check for pending manual Lane C (IC Bundle) triggers
      const laneC_Runs = await runsRepository.getByType('manual_lane_c_trigger', 10);
      const pendingLaneCRuns = laneC_Runs.filter(r => r.status === 'pending');
      
      for (const run of pendingLaneCRuns) {
        console.log(`[Scheduler] Found manual Lane C trigger: ${run.runId}`);
        await runsRepository.updateStatus(run.runId, 'running');
        
        try {
          const payload = run.payload as { dryRun?: boolean } | null;
          const result = await generateICBundle({
            dryRun: payload?.dryRun ?? false,
          });
          
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            ...payload,
            result,
            completedAt: new Date().toISOString(),
          });
          
          console.log(`[Scheduler] Manual Lane C completed: ${run.runId}`, result);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane C failed: ${run.runId}`, error);
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
