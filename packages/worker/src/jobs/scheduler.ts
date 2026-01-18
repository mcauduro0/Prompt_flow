/**
 * ARC Investment Factory - Job Scheduler
 * Timezone: America/Sao_Paulo
 * 
 * Updated: 2026-01-18 v3
 * - All lanes run daily (Mon-Sun)
 * - Sequential schedule: Lane 0 → Lane A → Lane B → Lane C
 * - Added Lane C (IC Bundle) daily generation
 * - Manual trigger support for all lanes
 * - FIXED: Conflict detection between manual and scheduled runs
 * - FIXED: Proper startedAt timestamp tracking
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

// Track which lanes are currently running to prevent conflicts
interface LaneState {
  isRunning: boolean;
  runId: string | null;
  startedAt: string | null;
  type: 'manual' | 'scheduled' | null;
}

export class JobScheduler {
  private jobs: CronJob[] = [];
  private isRunning = false;
  private triggerCheckInterval: NodeJS.Timeout | null = null;
  
  // Track lane states to prevent conflicts
  private laneStates: Record<string, LaneState> = {
    lane_0: { isRunning: false, runId: null, startedAt: null, type: null },
    lane_a: { isRunning: false, runId: null, startedAt: null, type: null },
    lane_b: { isRunning: false, runId: null, startedAt: null, type: null },
    lane_c: { isRunning: false, runId: null, startedAt: null, type: null },
  };

  /**
   * Check if a lane is currently running (manual or scheduled)
   */
  private isLaneRunning(lane: string): boolean {
    return this.laneStates[lane]?.isRunning || false;
  }

  /**
   * Mark a lane as running
   */
  private markLaneRunning(lane: string, runId: string, type: 'manual' | 'scheduled'): void {
    this.laneStates[lane] = {
      isRunning: true,
      runId,
      startedAt: new Date().toISOString(),
      type,
    };
    console.log(`[Scheduler] Lane ${lane} marked as running (${type}): ${runId}`);
  }

  /**
   * Mark a lane as idle
   */
  private markLaneIdle(lane: string): void {
    const previousState = this.laneStates[lane];
    this.laneStates[lane] = {
      isRunning: false,
      runId: null,
      startedAt: null,
      type: null,
    };
    console.log(`[Scheduler] Lane ${lane} marked as idle (was: ${previousState?.type || 'unknown'})`);
  }

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
        if (this.isLaneRunning('lane_0')) {
          console.log('[Scheduler] Skipping scheduled Lane 0 - already running');
          return;
        }
        console.log('[Scheduler] Running scheduled Lane 0 Ingestion (Substack + Reddit)');
        const runId = `scheduled-lane0-${Date.now()}`;
        this.markLaneRunning('lane_0', runId, 'scheduled');
        try {
          await this.runLane0();
        } finally {
          this.markLaneIdle('lane_0');
        }
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // Lane A: Daily Discovery - 06:00 daily
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_A_CRON,
      async () => {
        if (this.isLaneRunning('lane_a')) {
          console.log('[Scheduler] Skipping scheduled Lane A - already running');
          return;
        }
        console.log('[Scheduler] Running scheduled Lane A Discovery');
        const runId = `scheduled-lanea-${Date.now()}`;
        this.markLaneRunning('lane_a', runId, 'scheduled');
        try {
          await runDailyDiscovery();
        } finally {
          this.markLaneIdle('lane_a');
        }
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // Lane B: Deep Research - 08:00 daily
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_B_CRON,
      async () => {
        if (this.isLaneRunning('lane_b')) {
          console.log('[Scheduler] Skipping scheduled Lane B - already running');
          return;
        }
        console.log('[Scheduler] Running scheduled Lane B Research');
        const runId = `scheduled-laneb-${Date.now()}`;
        this.markLaneRunning('lane_b', runId, 'scheduled');
        try {
          await runLaneB();
        } finally {
          this.markLaneIdle('lane_b');
        }
      },
      null,
      true,
      SYSTEM_TIMEZONE
    ));

    // Lane C: IC Bundle - 10:00 daily
    this.jobs.push(new CronJob(
      SCHEDULES.LANE_C_CRON,
      async () => {
        if (this.isLaneRunning('lane_c')) {
          console.log('[Scheduler] Skipping scheduled Lane C - already running');
          return;
        }
        console.log('[Scheduler] Running scheduled Lane C IC Bundle');
        const runId = `scheduled-lanec-${Date.now()}`;
        this.markLaneRunning('lane_c', runId, 'scheduled');
        try {
          await generateICBundle();
        } finally {
          this.markLaneIdle('lane_c');
        }
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
      // ========================================
      // Lane 0 Manual Triggers
      // ========================================
      const lane0Runs = await runsRepository.getByType('manual_lane_0_trigger', 10);
      const pendingLane0Runs = lane0Runs.filter(r => r.status === 'pending');
      
      for (const run of pendingLane0Runs) {
        // Check if lane is already running (manual or scheduled)
        if (this.isLaneRunning('lane_0')) {
          console.log(`[Scheduler] Skipping manual Lane 0 trigger ${run.runId} - lane already running`);
          continue;
        }
        
        console.log(`[Scheduler] Found manual Lane 0 trigger: ${run.runId}`);
        const startedAt = new Date().toISOString();
        
        // Mark lane as running and update DB
        this.markLaneRunning('lane_0', run.runId, 'manual');
        await runsRepository.updateStatus(run.runId, 'running');
        await runsRepository.updatePayload(run.runId, {
          ...(run.payload as object || {}),
          startedAt,
        });
        
        try {
          await this.runLane0();
          
          const completedAt = new Date().toISOString();
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            ...(run.payload as object || {}),
            startedAt,
            completedAt,
            durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
          });
          
          console.log(`[Scheduler] Manual Lane 0 completed: ${run.runId}`);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane 0 failed: ${run.runId}`, error);
        } finally {
          this.markLaneIdle('lane_0');
        }
      }

      // ========================================
      // Lane A Manual Triggers
      // ========================================
      const laneARuns = await runsRepository.getByType('manual_lane_a_trigger', 10);
      const pendingLaneARuns = laneARuns.filter(r => r.status === 'pending');
      
      for (const run of pendingLaneARuns) {
        // Check if lane is already running (manual or scheduled)
        if (this.isLaneRunning('lane_a')) {
          console.log(`[Scheduler] Skipping manual Lane A trigger ${run.runId} - lane already running`);
          continue;
        }
        
        console.log(`[Scheduler] Found manual Lane A trigger: ${run.runId}`);
        const startedAt = new Date().toISOString();
        
        // Mark lane as running and update DB
        this.markLaneRunning('lane_a', run.runId, 'manual');
        await runsRepository.updateStatus(run.runId, 'running');
        await runsRepository.updatePayload(run.runId, {
          ...(run.payload as object || {}),
          startedAt,
        });
        
        try {
          const payload = run.payload as { dryRun?: boolean; maxIdeas?: number } | null;
          const result = await runDailyDiscovery({
            dryRun: payload?.dryRun ?? false,
            maxIdeas: payload?.maxIdeas ?? 200,
          });
          
          const completedAt = new Date().toISOString();
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            ...(payload as object || {}),
            startedAt,
            completedAt,
            durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
            result,
          });
          
          console.log(`[Scheduler] Manual Lane A completed: ${run.runId}`, result);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane A failed: ${run.runId}`, error);
        } finally {
          this.markLaneIdle('lane_a');
        }
      }

      // ========================================
      // Lane B Manual Triggers
      // ========================================
      const laneBRuns = await runsRepository.getByType('manual_lane_b_trigger', 10);
      const pendingLaneBRuns = laneBRuns.filter(r => r.status === 'pending');
      
      for (const run of pendingLaneBRuns) {
        // Check if lane is already running (manual or scheduled)
        if (this.isLaneRunning('lane_b')) {
          console.log(`[Scheduler] Skipping manual Lane B trigger ${run.runId} - lane already running`);
          continue;
        }
        
        console.log(`[Scheduler] Found manual Lane B trigger: ${run.runId}`);
        const startedAt = new Date().toISOString();
        
        // Mark lane as running and update DB
        this.markLaneRunning('lane_b', run.runId, 'manual');
        await runsRepository.updateStatus(run.runId, 'running');
        await runsRepository.updatePayload(run.runId, {
          ...(run.payload as object || {}),
          startedAt,
        });
        
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
          
          const completedAt = new Date().toISOString();
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            ...(payload as object || {}),
            startedAt,
            completedAt,
            durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
            result,
          });
          
          console.log(`[Scheduler] Manual Lane B completed: ${run.runId}`, result);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane B failed: ${run.runId}`, error);
        } finally {
          this.markLaneIdle('lane_b');
        }
      }

      // ========================================
      // Lane C Manual Triggers
      // ========================================
      const laneCRuns = await runsRepository.getByType('manual_lane_c_trigger', 10);
      const pendingLaneCRuns = laneCRuns.filter(r => r.status === 'pending');
      
      for (const run of pendingLaneCRuns) {
        // Check if lane is already running (manual or scheduled)
        if (this.isLaneRunning('lane_c')) {
          console.log(`[Scheduler] Skipping manual Lane C trigger ${run.runId} - lane already running`);
          continue;
        }
        
        console.log(`[Scheduler] Found manual Lane C trigger: ${run.runId}`);
        const startedAt = new Date().toISOString();
        
        // Mark lane as running and update DB
        this.markLaneRunning('lane_c', run.runId, 'manual');
        await runsRepository.updateStatus(run.runId, 'running');
        await runsRepository.updatePayload(run.runId, {
          ...(run.payload as object || {}),
          startedAt,
        });
        
        try {
          const payload = run.payload as { dryRun?: boolean } | null;
          const result = await generateICBundle({
            dryRun: payload?.dryRun ?? false,
          });
          
          const completedAt = new Date().toISOString();
          await runsRepository.updateStatus(run.runId, 'completed');
          await runsRepository.updatePayload(run.runId, {
            ...(payload as object || {}),
            startedAt,
            completedAt,
            durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
            result,
          });
          
          console.log(`[Scheduler] Manual Lane C completed: ${run.runId}`, result);
        } catch (error) {
          await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
          console.error(`[Scheduler] Manual Lane C failed: ${run.runId}`, error);
        } finally {
          this.markLaneIdle('lane_c');
        }
      }

    } catch (error) {
      console.error('[Scheduler] Error checking manual triggers:', error);
    }
  }

  /**
   * Get current lane states (for debugging/monitoring)
   */
  getLaneStates(): Record<string, LaneState> {
    return { ...this.laneStates };
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
