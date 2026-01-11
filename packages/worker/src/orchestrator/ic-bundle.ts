/**
 * ARC Investment Factory - IC Bundle Generator
 * Weekly Investment Committee bundle generation
 * 
 * DAG: weekly_ic_bundle
 * Schedule: 08:00 America/Sao_Paulo every Friday (WEEKDAY ONLY)
 * Content: Last 7 CALENDAR DAYS of completed ResearchPackets
 * 
 * Following Operating Parameters exactly:
 * - Timezone: America/Sao_Paulo (NOT UTC)
 * - Lookback: 7 calendar days (includes all packets completed in this window)
 * - Includes: Market context, new opportunities, pipeline summary, risk alerts
 */

import { DAGRunner, createDAGRunner, type DAGContext, type DAGNode } from './dag-runner.js';
import { createResilientClient, type ResilientLLMClient } from '@arc/llm-client';
import { OPERATING_PARAMETERS } from '@arc-investment/shared';
import {
  researchPacketsRepository,
  ideasRepository,
  runsRepository,
} from '@arc/database';

// ============================================================================
// CONSTANTS - Following Operating Parameters
// ============================================================================

/**
 * IC Bundle timing configuration
 * CRITICAL: Uses America/Sao_Paulo timezone, NOT UTC
 */
const IC_BUNDLE_CONFIG = {
  // Schedule: Friday 08:00 America/Sao_Paulo
  SCHEDULE: {
    DAY_OF_WEEK: 5, // Friday (0 = Sunday)
    HOUR: 8,
    MINUTE: 0,
    TIMEZONE: OPERATING_PARAMETERS.TIMEZONE, // 'America/Sao_Paulo'
  },
  
  // Content: Last 7 calendar days
  LOOKBACK_DAYS: 7,
  
  // Limits
  MAX_PACKETS_PER_BUNDLE: 20,
  MAX_TOP_IDEAS: 10,
  MAX_REJECTION_REASONS: 5,
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface ICBundleContext extends DAGContext {
  data: {
    // Time window (last 7 calendar days)
    periodStart: Date;
    periodEnd: Date;
    periodStartStr: string;
    periodEndStr: string;
    
    // Completed packets in the 7-day window
    completedPackets: any[];
    completedPacketCount: number;
    completedByStyle: Record<string, number>;
    
    // Pipeline stats
    inboxCount: number;
    inboxAvgScore: number;
    inboxByStyle: Record<string, number>;
    queueCount: number;
    queueInProgress: number;
    queueBlocked: number;
    
    // Rejections in the 7-day window
    rejectedCount: number;
    topRejectionReasons: Array<{ reason: string; count: number }>;
    
    // Capacity utilization
    weeklyCapacityUsed: number;
    weeklyCapacityTotal: number;
    capacityUtilizationPct: number;
    
    // Top ideas in pipeline
    topIdeas: any[];
    
    // Generated content
    marketContext: string;
    bundleDocument: string;
    actionItems: Array<{ priority: string; item: string }>;
  };
}

// ============================================================================
// PROMPTS
// ============================================================================

const IC_SUMMARY_SYSTEM_PROMPT = `You are an expert investment analyst preparing a weekly summary for an Investment Committee.

Your task is to create a concise, actionable summary that:
1. Highlights the most compelling opportunities from the week
2. Summarizes key risks across the portfolio
3. Identifies market themes and their implications
4. Provides clear recommendations for discussion

The summary should be suitable for senior investment professionals.
Write in a professional, institutional tone.`;

// ============================================================================
// DAG NODES
// ============================================================================

/**
 * Node 1: Calculate Time Window
 * CRITICAL: Uses last 7 CALENDAR DAYS, not business days
 */
function createCalculateTimeWindowNode(): DAGNode {
  return {
    id: 'calculate_time_window',
    name: 'Calculate Time Window',
    dependencies: [],
    timeout: 5000,
    retries: 0,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[calculate_time_window] Calculating 7-day lookback window...');

      // End of period is now
      const periodEnd = new Date();
      
      // Start of period is 7 calendar days ago
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - IC_BUNDLE_CONFIG.LOOKBACK_DAYS);
      
      // Set to start of day for clean comparison
      periodStart.setHours(0, 0, 0, 0);
      
      ctx.data.periodStart = periodStart;
      ctx.data.periodEnd = periodEnd;
      ctx.data.periodStartStr = periodStart.toISOString().split('T')[0];
      ctx.data.periodEndStr = periodEnd.toISOString().split('T')[0];

      console.log(`[calculate_time_window] Period: ${ctx.data.periodStartStr} to ${ctx.data.periodEndStr} (${IC_BUNDLE_CONFIG.LOOKBACK_DAYS} calendar days)`);
    },
  };
}

/**
 * Node 2: Fetch Completed Packets
 * Gets ALL packets completed in the last 7 calendar days
 */
function createFetchCompletedPacketsNode(): DAGNode {
  return {
    id: 'fetch_completed_packets',
    name: 'Fetch Completed Packets',
    dependencies: ['calculate_time_window'],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[fetch_completed_packets] Fetching packets completed in last 7 days...');

      // Get all packets completed in the date range
      const packets = await researchPacketsRepository.getCompletedInDateRange(
        ctx.data.periodStart,
        ctx.data.periodEnd
      );
      
      // Limit to max per bundle
      ctx.data.completedPackets = packets.slice(0, IC_BUNDLE_CONFIG.MAX_PACKETS_PER_BUNDLE);
      ctx.data.completedPacketCount = packets.length;
      
      // Count by style
      ctx.data.completedByStyle = {};
      for (const packet of packets) {
        const style = packet.styleTag || 'unknown';
        ctx.data.completedByStyle[style] = (ctx.data.completedByStyle[style] || 0) + 1;
      }

      console.log(`[fetch_completed_packets] Found ${ctx.data.completedPacketCount} completed packets in period`);
      console.log(`[fetch_completed_packets] By style:`, ctx.data.completedByStyle);
    },
  };
}

/**
 * Node 3: Fetch Pipeline Stats
 */
function createFetchPipelineStatsNode(): DAGNode {
  return {
    id: 'fetch_pipeline_stats',
    name: 'Fetch Pipeline Stats',
    dependencies: ['calculate_time_window'],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[fetch_pipeline_stats] Fetching pipeline statistics...');

      // Inbox stats
      const inboxIdeas = await ideasRepository.getByStatus('inbox');
      ctx.data.inboxCount = inboxIdeas.length;
      ctx.data.inboxAvgScore = inboxIdeas.length > 0
        ? inboxIdeas.reduce((sum, i) => sum + parseFloat(i.rankScore || '0'), 0) / inboxIdeas.length
        : 0;
      
      ctx.data.inboxByStyle = {};
      for (const idea of inboxIdeas) {
        const style = idea.styleTag || 'unknown';
        ctx.data.inboxByStyle[style] = (ctx.data.inboxByStyle[style] || 0) + 1;
      }

      // Queue stats
      const queueIdeas = await ideasRepository.getByStatus('promoted');
      ctx.data.queueCount = queueIdeas.length;
      ctx.data.queueInProgress = queueIdeas.filter(i => i.researchStatus === 'in_progress').length;
      ctx.data.queueBlocked = queueIdeas.filter(i => i.researchStatus === 'blocked').length;

      // Top ideas for pipeline overview
      const monitoringIdeas = await ideasRepository.getByStatus('monitoring', 20);
      ctx.data.topIdeas = monitoringIdeas
        .sort((a, b) => parseFloat(b.rankScore ?? '0') - parseFloat(a.rankScore ?? '0'))
        .slice(0, IC_BUNDLE_CONFIG.MAX_TOP_IDEAS);

      console.log(`[fetch_pipeline_stats] Inbox: ${ctx.data.inboxCount}, Queue: ${ctx.data.queueCount}, Top Ideas: ${ctx.data.topIdeas.length}`);
    },
  };
}

/**
 * Node 4: Fetch Rejection Stats
 */
function createFetchRejectionStatsNode(): DAGNode {
  return {
    id: 'fetch_rejection_stats',
    name: 'Fetch Rejection Stats',
    dependencies: ['calculate_time_window'],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[fetch_rejection_stats] Fetching rejection statistics...');

      // Get rejections in the date range
      const rejectedIdeas = await ideasRepository.getRejectedInDateRange(
        ctx.data.periodStart,
        ctx.data.periodEnd
      );
      
      ctx.data.rejectedCount = rejectedIdeas.length;
      
      // Count rejection reasons
      const reasonCounts: Record<string, number> = {};
      for (const idea of rejectedIdeas) {
        const reason = idea.rejectionReason || 'Unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
      
      ctx.data.topRejectionReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, IC_BUNDLE_CONFIG.MAX_REJECTION_REASONS);

      console.log(`[fetch_rejection_stats] ${ctx.data.rejectedCount} rejections in period`);
    },
  };
}

/**
 * Node 5: Calculate Capacity Utilization
 */
function createCalculateCapacityNode(): DAGNode {
  return {
    id: 'calculate_capacity',
    name: 'Calculate Capacity',
    dependencies: ['fetch_completed_packets'],
    timeout: 5000,
    retries: 0,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[calculate_capacity] Calculating capacity utilization...');

      ctx.data.weeklyCapacityTotal = OPERATING_PARAMETERS.LANE_B_LIMITS.WEEKLY_CAP;
      ctx.data.weeklyCapacityUsed = ctx.data.completedPacketCount;
      ctx.data.capacityUtilizationPct = 
        (ctx.data.weeklyCapacityUsed / ctx.data.weeklyCapacityTotal) * 100;

      console.log(`[calculate_capacity] Capacity: ${ctx.data.weeklyCapacityUsed}/${ctx.data.weeklyCapacityTotal} (${ctx.data.capacityUtilizationPct.toFixed(1)}%)`);
    },
  };
}

/**
 * Node 6: Generate Market Context
 */
function createGenerateMarketContextNode(llmClient: ResilientLLMClient): DAGNode {
  return {
    id: 'generate_market_context',
    name: 'Generate Market Context',
    dependencies: ['fetch_completed_packets', 'fetch_pipeline_stats'],
    timeout: 120000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[generate_market_context] Generating market context...');

      const prompt = `Based on the following research packets completed in the last 7 days, provide a brief market context summary (2-3 paragraphs):

COMPLETED RESEARCH PACKETS (${ctx.data.completedPacketCount}):
${ctx.data.completedPackets.map((p) => {
  const brief = p.decisionBrief as any;
  return `- ${p.ticker} (${p.styleTag}): ${brief?.thesis_summary ?? 'No thesis'}`;
}).join('\n')}

TOP IDEAS IN PIPELINE (${ctx.data.topIdeas.length}):
${ctx.data.topIdeas.map((i) => `- ${i.ticker}: ${i.oneSentenceHypothesis}`).join('\n')}

Focus on:
1. Common themes across opportunities
2. Sector/industry trends
3. Key risks to monitor
4. Market regime observations`;

      const response = await llmClient.complete({
        messages: [
          { role: 'system', content: IC_SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        maxTokens: 1000,
        temperature: 0.5,
      });

      ctx.data.marketContext = response.content;
      console.log('[generate_market_context] Market context generated');
    },
  };
}

/**
 * Node 7: Generate Action Items
 */
function createGenerateActionItemsNode(): DAGNode {
  return {
    id: 'generate_action_items',
    name: 'Generate Action Items',
    dependencies: ['fetch_completed_packets', 'fetch_pipeline_stats', 'fetch_rejection_stats', 'calculate_capacity'],
    timeout: 5000,
    retries: 0,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[generate_action_items] Generating action items...');

      ctx.data.actionItems = [];

      // High conviction packets need review
      const highConviction = ctx.data.completedPackets.filter(p => {
        const brief = p.decisionBrief as any;
        return brief?.position_sizing?.conviction_1_5 >= 4;
      });
      if (highConviction.length > 0) {
        ctx.data.actionItems.push({
          priority: 'HIGH',
          item: `Review ${highConviction.length} high-conviction packet(s): ${highConviction.map(p => p.ticker).join(', ')}`,
        });
      }

      // Low capacity utilization
      if (ctx.data.capacityUtilizationPct < 50) {
        ctx.data.actionItems.push({
          priority: 'MEDIUM',
          item: `Low capacity utilization (${ctx.data.capacityUtilizationPct.toFixed(0)}%) - consider promoting more ideas from inbox`,
        });
      }

      // Blocked queue items
      if (ctx.data.queueBlocked > 0) {
        ctx.data.actionItems.push({
          priority: 'MEDIUM',
          item: `${ctx.data.queueBlocked} item(s) blocked in research queue - investigate data availability`,
        });
      }

      // High rejection rate
      const totalDecisions = ctx.data.rejectedCount + ctx.data.completedPacketCount;
      if (totalDecisions > 0) {
        const rejectionRate = ctx.data.rejectedCount / totalDecisions;
        if (rejectionRate > 0.5 && ctx.data.rejectedCount > 3) {
          ctx.data.actionItems.push({
            priority: 'LOW',
            item: `High rejection rate (${(rejectionRate * 100).toFixed(0)}%) - review idea generation criteria`,
          });
        }
      }

      console.log(`[generate_action_items] Generated ${ctx.data.actionItems.length} action items`);
    },
  };
}

/**
 * Node 8: Assemble Bundle Document
 */
function createAssembleBundleNode(llmClient: ResilientLLMClient): DAGNode {
  return {
    id: 'assemble_bundle',
    name: 'Assemble Bundle',
    dependencies: ['generate_market_context', 'generate_action_items'],
    timeout: 180000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[assemble_bundle] Assembling IC bundle document...');

      const bundlePrompt = `Create a comprehensive Investment Committee bundle document.

PERIOD: ${ctx.data.periodStartStr} to ${ctx.data.periodEndStr} (Last 7 Calendar Days)

MARKET CONTEXT:
${ctx.data.marketContext}

COMPLETED RESEARCH PACKETS (${ctx.data.completedPacketCount}):
${ctx.data.completedPackets.map((p) => {
  const brief = p.decisionBrief as any;
  return `
### ${p.ticker} (${p.styleTag})
- **Verdict**: ${brief?.verdict ?? 'N/A'}
- **Thesis**: ${brief?.thesis_summary ?? 'N/A'}
- **Variant Perception**: ${brief?.variant_perception ?? 'N/A'}
- **Key Risks**: ${brief?.key_risks?.map((r: any) => r.risk).join(', ') ?? 'N/A'}
- **Position Sizing**: Conviction ${brief?.position_sizing?.conviction_1_5 ?? 'N/A'}/5, Max ${brief?.position_sizing?.max_position_pct ?? 'N/A'}%
- **Upside/Downside**: +${brief?.upside_pct ?? 'N/A'}% / -${brief?.downside_pct ?? 'N/A'}%
`;
}).join('\n')}

PIPELINE SUMMARY:
- Inbox: ${ctx.data.inboxCount} ideas (avg score: ${ctx.data.inboxAvgScore.toFixed(1)})
- Research Queue: ${ctx.data.queueCount} (${ctx.data.queueInProgress} in progress, ${ctx.data.queueBlocked} blocked)
- Completed This Week: ${ctx.data.completedPacketCount}
- Rejected This Week: ${ctx.data.rejectedCount}
- Capacity Utilization: ${ctx.data.weeklyCapacityUsed}/${ctx.data.weeklyCapacityTotal} (${ctx.data.capacityUtilizationPct.toFixed(0)}%)

TOP REJECTION REASONS:
${ctx.data.topRejectionReasons.map(r => `- ${r.reason}: ${r.count}`).join('\n')}

TOP IDEAS IN PIPELINE (${ctx.data.topIdeas.length}):
${ctx.data.topIdeas.map((i, idx) => `${idx + 1}. ${i.ticker}: ${i.oneSentenceHypothesis}`).join('\n')}

ACTION ITEMS:
${ctx.data.actionItems.map(a => `- [${a.priority}] ${a.item}`).join('\n')}

Create a well-formatted Markdown document with:
1. Executive Summary (1 paragraph highlighting key takeaways)
2. Market Context
3. New Opportunities (detailed for each completed packet)
4. Pipeline Overview
5. Capacity & Efficiency Metrics
6. Key Discussion Points for IC
7. Action Items`;

      const response = await llmClient.complete({
        messages: [
          { role: 'system', content: IC_SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: bundlePrompt },
        ],
        maxTokens: 4000,
        temperature: 0.5,
      });

      ctx.data.bundleDocument = response.content;
      console.log('[assemble_bundle] Bundle document assembled');
    },
  };
}

/**
 * Node 9: Persist Bundle
 */
function createPersistBundleNode(): DAGNode {
  return {
    id: 'persist_bundle',
    name: 'Persist Bundle',
    dependencies: ['assemble_bundle'],
    timeout: 30000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[persist_bundle] Persisting IC bundle...');

      // Log the bundle
      console.log('='.repeat(80));
      console.log(`IC BUNDLE: ${ctx.data.periodStartStr} to ${ctx.data.periodEndStr}`);
      console.log('='.repeat(80));
      console.log(ctx.data.bundleDocument);
      console.log('='.repeat(80));

      // TODO: Save to file system or document store
      // TODO: Send via email or Slack
    },
  };
}

/**
 * Node 10: Notify User
 */
function createNotifyUserNode(): DAGNode {
  return {
    id: 'notify_user',
    name: 'Notify User',
    dependencies: ['persist_bundle'],
    timeout: 10000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[notify_user] IC Bundle notification...');

      const summary = {
        period: `${ctx.data.periodStartStr} to ${ctx.data.periodEndStr}`,
        lookbackDays: IC_BUNDLE_CONFIG.LOOKBACK_DAYS,
        completedPackets: ctx.data.completedPacketCount,
        rejectedIdeas: ctx.data.rejectedCount,
        inboxCount: ctx.data.inboxCount,
        queueCount: ctx.data.queueCount,
        capacityUtilization: `${ctx.data.capacityUtilizationPct.toFixed(0)}%`,
        actionItems: ctx.data.actionItems.length,
      };

      console.log('[notify_user] IC Bundle Summary:', JSON.stringify(summary, null, 2));
    },
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Create and configure the IC Bundle DAG
 */
export function createICBundleDAG(): DAGRunner {
  const llmClient = createResilientClient();
  const dag = createDAGRunner('weekly_ic_bundle');

  dag.addNodes([
    createCalculateTimeWindowNode(),
    createFetchCompletedPacketsNode(),
    createFetchPipelineStatsNode(),
    createFetchRejectionStatsNode(),
    createCalculateCapacityNode(),
    createGenerateMarketContextNode(llmClient),
    createGenerateActionItemsNode(),
    createAssembleBundleNode(llmClient),
    createPersistBundleNode(),
    createNotifyUserNode(),
  ]);

  return dag;
}

/**
 * Run IC Bundle generation
 */
export async function runICBundle(): Promise<void> {
  // Create run record
  const run = await runsRepository.create({
    runType: 'weekly_ic_bundle',
    status: 'running',
  });

  try {
    const dag = createICBundleDAG();
    const result = await dag.run();

    await runsRepository.updateStatus(
      run.runId,
      result.status === 'completed' ? 'completed' : 'failed',
      result.errors.length > 0 ? JSON.stringify(result.errors) : undefined
    );

    await runsRepository.updatePayload(run.runId, {
      completedNodes: result.completedNodes,
      failedNodes: result.failedNodes,
      durationMs: result.durationMs,
      config: IC_BUNDLE_CONFIG,
    });
  } catch (error) {
    await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { IC_BUNDLE_CONFIG };
