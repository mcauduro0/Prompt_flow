/**
 * ARC Investment Factory - IC Bundle Generator
 * Weekly Investment Committee bundle generation
 * 
 * DAG: weekly_ic_bundle
 * Schedule: 08:00 UTC every Friday
 */

import { DAGRunner, createDAGRunner, type DAGContext, type DAGNode } from './dag-runner.js';
import { createResilientClient, type ResilientLLMClient } from '@arc/llm-client';
import {
  researchPacketsRepository,
  ideasRepository,
  runsRepository,
} from '@arc/database';

// ============================================================================
// TYPES
// ============================================================================

interface ICBundleContext extends DAGContext {
  data: {
    weekStart: string;
    weekEnd: string;
    newPackets: any[];
    updatedPackets: any[];
    topIdeas: any[];
    marketContext: string;
    bundleDocument: string;
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

The summary should be suitable for senior investment professionals.`;

// ============================================================================
// DAG NODES
// ============================================================================

/**
 * Node 1: Fetch Weekly Data
 */
function createFetchWeeklyDataNode(): DAGNode {
  return {
    id: 'fetch_weekly_data',
    name: 'Fetch Weekly Data',
    dependencies: [],
    timeout: 60000,
    retries: 2,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[fetch_weekly_data] Fetching weekly data...');

      // Calculate week range
      const now = new Date();
      const weekEnd = now.toISOString().split('T')[0];
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      ctx.data.weekStart = weekStart;
      ctx.data.weekEnd = weekEnd;

      // Get research packets from the week
      const packets = await researchPacketsRepository.getRecentPackets(7);
      ctx.data.newPackets = packets.filter((p) => p.version === 1);
      ctx.data.updatedPackets = packets.filter((p) => p.version > 1);

      // Get top ideas by score
      const ideas = await ideasRepository.getByStatus('monitoring', 20);
      ctx.data.topIdeas = ideas
        .sort((a, b) => parseFloat(b.rankScore ?? '0') - parseFloat(a.rankScore ?? '0'))
        .slice(0, 10);

      console.log(`[fetch_weekly_data] Found ${ctx.data.newPackets.length} new packets, ${ctx.data.updatedPackets.length} updates`);
    },
  };
}

/**
 * Node 2: Generate Market Context
 */
function createGenerateMarketContextNode(llmClient: ResilientLLMClient): DAGNode {
  return {
    id: 'generate_market_context',
    name: 'Generate Market Context',
    dependencies: ['fetch_weekly_data'],
    timeout: 120000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[generate_market_context] Generating market context...');

      const prompt = `Based on the following research packets from the past week, provide a brief market context summary (2-3 paragraphs):

NEW RESEARCH PACKETS:
${ctx.data.newPackets.map((p) => `- ${p.ticker}: ${(p.decisionBrief as any)?.thesis_summary ?? 'No thesis'}`).join('\n')}

TOP IDEAS BEING MONITORED:
${ctx.data.topIdeas.map((i) => `- ${i.ticker}: ${i.oneSentenceHypothesis}`).join('\n')}

Focus on:
1. Common themes across opportunities
2. Sector/industry trends
3. Key risks to monitor`;

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
 * Node 3: Assemble Bundle
 */
function createAssembleBundleNode(llmClient: ResilientLLMClient): DAGNode {
  return {
    id: 'assemble_bundle',
    name: 'Assemble Bundle',
    dependencies: ['generate_market_context'],
    timeout: 180000,
    retries: 1,
    execute: async (context: DAGContext) => {
      const ctx = context as ICBundleContext;
      console.log('[assemble_bundle] Assembling IC bundle...');

      const bundlePrompt = `Create a comprehensive Investment Committee bundle document for the week of ${ctx.data.weekStart} to ${ctx.data.weekEnd}.

MARKET CONTEXT:
${ctx.data.marketContext}

NEW RESEARCH COMPLETED (${ctx.data.newPackets.length}):
${ctx.data.newPackets.map((p) => {
  const brief = p.decisionBrief as any;
  return `
### ${p.ticker}
- **Verdict**: ${brief?.verdict ?? 'N/A'}
- **Thesis**: ${brief?.thesis_summary ?? 'N/A'}
- **Key Risks**: ${brief?.key_risks?.map((r: any) => r.risk).join(', ') ?? 'N/A'}
- **Position Sizing**: Conviction ${brief?.position_sizing?.conviction_1_5 ?? 'N/A'}/5, Max ${brief?.position_sizing?.max_position_pct ?? 'N/A'}%
`;
}).join('\n')}

UPDATED RESEARCH (${ctx.data.updatedPackets.length}):
${ctx.data.updatedPackets.map((p) => `- ${p.ticker} v${p.version}`).join('\n')}

TOP IDEAS IN PIPELINE (${ctx.data.topIdeas.length}):
${ctx.data.topIdeas.map((i, idx) => `${idx + 1}. ${i.ticker}: ${i.oneSentenceHypothesis}`).join('\n')}

Create a well-formatted Markdown document with:
1. Executive Summary (1 paragraph)
2. Market Context
3. New Opportunities (detailed)
4. Updated Research (brief)
5. Pipeline Overview
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
      console.log('[assemble_bundle] Bundle assembled');
    },
  };
}

/**
 * Node 4: Persist Bundle
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

      // In a real implementation, this would save to a document store or send via email
      // For now, we log the bundle
      console.log('='.repeat(80));
      console.log('IC BUNDLE');
      console.log('='.repeat(80));
      console.log(ctx.data.bundleDocument);
      console.log('='.repeat(80));

      // TODO: Save to file system or document store
      // TODO: Send via email or Slack
    },
  };
}

/**
 * Node 5: Notify User
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
        weekStart: ctx.data.weekStart,
        weekEnd: ctx.data.weekEnd,
        newPackets: ctx.data.newPackets.length,
        updatedPackets: ctx.data.updatedPackets.length,
        topIdeas: ctx.data.topIdeas.length,
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
    createFetchWeeklyDataNode(),
    createGenerateMarketContextNode(llmClient),
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
    });
  } catch (error) {
    await runsRepository.updateStatus(run.runId, 'failed', (error as Error).message);
    throw error;
  }
}
