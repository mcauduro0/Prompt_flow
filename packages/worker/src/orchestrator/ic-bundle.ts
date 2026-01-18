/**
 * ARC Investment Factory - IC Bundle Generator
 * Schedule: Friday 19:00 America/Sao_Paulo
 * 
 * Generates the weekly Investment Committee bundle containing:
 * - All completed research packets from the week
 * - Summary statistics and highlights
 * - Prioritized list of ideas for IC review
 * - ROIC Decomposition analysis (NEW)
 */
import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_TIMEZONE, LANE_B_WEEKLY_LIMIT } from '@arc/shared';
import {
  researchPacketsRepository,
  ideasRepository,
  runsRepository,
} from '@arc/database';
import { createResilientClient } from '@arc/llm-client';
import { runROICDecompositionForICMemo, type ROICDecompositionResult, type ROICDecomposition } from './roic-decomposition-runner.js';

export interface ICBundleConfig {
  dryRun?: boolean;
  lookbackDays?: number;
  forceIncludePacketIds?: string[];
  includeROICDecomposition?: boolean;
  roicDecompositionConcurrency?: number;
}

export interface ICBundleResult {
  success: boolean;
  bundleId: string;
  packetsIncluded: number;
  roicAnalysesCompleted: number;
  errors: string[];
  duration_ms: number;
  bundle?: ICBundle;
}

export interface ICBundle {
  bundleId: string;
  generatedAt: string;
  weekOf: string;
  summary: {
    totalPackets: number;
    byStyle: Record<string, number>;
    bySector: Record<string, number>;
    avgConviction: number;
    passedAllGates: number;
    roicAnalysesCompleted: number;
  };
  highlights: Array<{
    ticker: string;
    companyName: string;
    styleTag: string;
    headline: string;
    conviction: number;
    keyInsight: string;
    roicDurabilityScore?: number;
  }>;
  packets: Array<{
    packetId: string;
    ideaId: string;
    ticker: string;
    companyName: string;
    styleTag: string;
    status: string;
    gatesPassed: boolean;
    fairValueRange?: { low: number; base: number; high: number };
    keyRisks: string[];
    catalysts: string[];
    roicDecomposition?: ROICDecompositionSummary;
  }>;
  executiveSummary: string;
}

export interface ROICDecompositionSummary {
  grossMarginQualityScore?: number;
  grossMarginDurabilityScore?: number;
  grossMarginClassification?: string;
  capitalEfficiencyClassification?: string;
  roicDurabilityScore?: number;
  numberOneThingToWatch?: string;
  completed: boolean;
}

interface PacketData {
  modules?: {
    business?: { summary?: string; sector?: string };
    industry_moat?: { summary?: string };
    valuation?: { 
      summary?: string;
      fair_value_range?: { low: number; base: number; high: number };
      key_drivers?: string[];
      current_price?: number;
    };
    risk?: { key_risks?: string[] };
    synthesis?: any;
  };
  gateResults?: {
    all_passed?: boolean;
    first_failed_gate?: number | null;
  };
  status?: string;
  roicDecomposition?: any;
}

function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function extractHighlights(
  packets: any[],
  ideas: Map<string, any>,
  roicResults: Map<string, ROICDecompositionSummary>
): ICBundle['highlights'] {
  const highlights: ICBundle['highlights'] = [];
  
  for (const packet of packets) {
    const idea = ideas.get(packet.ideaId);
    const packetData = packet.packet as PacketData;
    
    if (!idea || !packetData?.modules?.synthesis) continue;
    
    const synthesis = packetData.modules.synthesis;
    const conviction = synthesis.conviction_score || 5;
    
    if (conviction >= 6) {
      const roicData = roicResults.get(packet.packetId);
      
      highlights.push({
        ticker: packet.ticker,
        companyName: idea.companyName || packet.ticker,
        styleTag: packet.styleTag || 'unknown',
        headline: synthesis.one_liner || `${packet.ticker} investment opportunity`,
        conviction,
        keyInsight: synthesis.key_insight || packetData.modules.business?.summary?.slice(0, 200) || '',
        roicDurabilityScore: roicData?.roicDurabilityScore,
      });
    }
  }
  
  return highlights.sort((a, b) => b.conviction - a.conviction).slice(0, 10);
}

async function generateExecutiveSummary(
  packets: any[],
  highlights: ICBundle['highlights']
): Promise<string> {
  const llmClient = createResilientClient();
  
  const highlightsSummary = highlights.map(h => 
    `- ${h.ticker} (${h.companyName}): ${h.headline} [Conviction: ${h.conviction}/10${h.roicDurabilityScore ? `, ROIC Durability: ${h.roicDurabilityScore}/10` : ''}]`
  ).join('\n');
  
  const prompt = `Generate a concise executive summary for the Investment Committee weekly bundle.

Total packets reviewed: ${packets.length}
High conviction highlights:
${highlightsSummary}

Write a 2-3 paragraph executive summary that:
1. Summarizes the key themes and opportunities identified this week
2. Highlights the most compelling investment ideas with ROIC quality insights
3. Notes any concerns or areas requiring further analysis

Keep it professional and actionable.`;

  try {
    const response = await llmClient.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000,
      temperature: 0.5,
    });
    return response.content;
  } catch (error) {
    console.error('[IC Bundle] Failed to generate executive summary:', error);
    return `This week's IC Bundle contains ${packets.length} research packets. ${highlights.length} ideas met the high conviction threshold for detailed review.`;
  }
}

async function runROICForPacket(
  packet: any
): Promise<ROICDecompositionSummary | null> {
  try {
    console.log(`[IC Bundle] Running ROIC Decomposition for ${packet.ticker}...`);
    
    const result = await runROICDecompositionForICMemo(
      packet.ticker,
      packet.ideaId,
      packet.packetId
    );
    
    if (result.success && result.data) {
      const summary: ROICDecompositionSummary = {
        completed: true,
        grossMarginQualityScore: result.data.gross_margin_analysis?.scores?.gross_margin_quality_score,
        grossMarginDurabilityScore: result.data.gross_margin_analysis?.scores?.gross_margin_durability_score,
        grossMarginClassification: result.data.gross_margin_analysis?.scores?.classification,
        capitalEfficiencyClassification: result.data.capital_efficiency_analysis?.executive_summary?.classification,
        roicDurabilityScore: result.data.roic_stress_test?.scores?.overall_roic_durability_score,
        numberOneThingToWatch: result.data.roic_stress_test?.number_one_thing_to_watch,
      };
      
      console.log(`[IC Bundle] ROIC Decomposition completed for ${packet.ticker}: Durability Score ${summary.roicDurabilityScore}/10`);
      return summary;
    } else {
      console.error(`[IC Bundle] ROIC Decomposition failed for ${packet.ticker}:`, result.errors);
      return { completed: false };
    }
  } catch (error) {
    console.error(`[IC Bundle] ROIC Decomposition error for ${packet.ticker}:`, error);
    return { completed: false };
  }
}

async function runROICDecompositionBatch(
  packets: any[],
  concurrency: number = 3
): Promise<Map<string, ROICDecompositionSummary>> {
  const results = new Map<string, ROICDecompositionSummary>();
  
  const highConvictionPackets = packets.filter(packet => {
    const packetData = packet.packet as PacketData;
    const conviction = packetData?.modules?.synthesis?.conviction_score || 0;
    return conviction >= 6;
  });
  
  console.log(`[IC Bundle] Running ROIC Decomposition for ${highConvictionPackets.length} high-conviction packets (concurrency: ${concurrency})`);
  
  for (let i = 0; i < highConvictionPackets.length; i += concurrency) {
    const batch = highConvictionPackets.slice(i, i + concurrency);
    const batchPromises = batch.map(packet => 
      runROICForPacket(packet)
        .then(result => ({ packetId: packet.packetId, result }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const { packetId, result } of batchResults) {
      if (result) {
        results.set(packetId, result);
      }
    }
  }
  
  return results;
}

export async function generateICBundle(
  config: ICBundleConfig = {}
): Promise<ICBundleResult> {
  const startTime = Date.now();
  const bundleId = uuidv4();
  const errors: string[] = [];
  let roicAnalysesCompleted = 0;
  
  console.log(`[IC Bundle] Generating bundle ${bundleId} at ${new Date().toISOString()}`);
  console.log(`[IC Bundle] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[IC Bundle] Weekly capacity: ${LANE_B_WEEKLY_LIMIT}`);
  console.log(`[IC Bundle] ROIC Decomposition enabled: ${config.includeROICDecomposition !== false}`);
  
  await runsRepository.create({
    runId: bundleId,
    runType: 'ic_bundle_generation',
    runDate: new Date(),
    status: 'running',
  });
  
  if (config.dryRun) {
    console.log('[IC Bundle] Dry run - skipping actual processing');
    await runsRepository.updateStatus(bundleId, 'completed');
    return {
      success: true,
      bundleId,
      packetsIncluded: 0,
      roicAnalysesCompleted: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    };
  }
  
  try {
    const lookbackDays = config.lookbackDays ?? 7;
    const weekStart = getWeekStart();
    const weekOf = weekStart.toISOString().split('T')[0];
    console.log(`[IC Bundle] Looking back ${lookbackDays} days from ${weekOf}`);
    
    const packets = await researchPacketsRepository.getRecentPackets(lookbackDays);
    console.log(`[IC Bundle] Found ${packets.length} packets`);
    
    if (config.forceIncludePacketIds?.length) {
      for (const packetId of config.forceIncludePacketIds) {
        const packet = await researchPacketsRepository.getById(packetId);
        if (packet && !packets.find((p: any) => p.packetId === packetId)) {
          packets.push(packet);
        }
      }
    }
    
    const ideaIds = [...new Set(packets.map((p: any) => p.ideaId))];
    const ideas = new Map<string, any>();
    for (const ideaId of ideaIds) {
      const idea = await ideasRepository.getById(ideaId);
      if (idea) ideas.set(ideaId, idea);
    }
    
    let roicResults = new Map<string, ROICDecompositionSummary>();
    if (config.includeROICDecomposition !== false) {
      const concurrency = config.roicDecompositionConcurrency ?? 3;
      roicResults = await runROICDecompositionBatch(packets, concurrency);
      roicAnalysesCompleted = [...roicResults.values()].filter(r => r.completed).length;
      console.log(`[IC Bundle] ROIC Decomposition completed for ${roicAnalysesCompleted} packets`);
    }
    
    const byStyle: Record<string, number> = {};
    const bySector: Record<string, number> = {};
    let passedAllGates = 0;
    
    for (const packet of packets) {
      const idea = ideas.get(packet.ideaId);
      const packetData = packet.packet as PacketData;
      
      if (idea) {
        byStyle[idea.styleTag] = (byStyle[idea.styleTag] || 0) + 1;
        const sector = packetData?.modules?.business?.sector || 'Unknown';
        bySector[sector] = (bySector[sector] || 0) + 1;
      }
      if (packetData?.gateResults?.all_passed) passedAllGates++;
    }
    
    const highlights = extractHighlights(packets, ideas, roicResults);
    
    console.log('[IC Bundle] Generating executive summary...');
    const executiveSummary = await generateExecutiveSummary(packets, highlights);
    
    const packetSummaries = packets.map((packet: any) => {
      const idea = ideas.get(packet.ideaId);
      const packetData = packet.packet as PacketData;
      const roicData = roicResults.get(packet.packetId);
      
      return {
        packetId: packet.packetId,
        ideaId: packet.ideaId,
        ticker: packet.ticker,
        companyName: idea?.companyName || packet.ticker,
        styleTag: packet.styleTag || 'unknown',
        status: packetData?.status || 'unknown',
        gatesPassed: packetData?.gateResults?.all_passed || false,
        fairValueRange: packetData?.modules?.valuation?.fair_value_range,
        keyRisks: packetData?.modules?.risk?.key_risks || [],
        catalysts: packetData?.modules?.valuation?.key_drivers || [],
        roicDecomposition: roicData,
      };
    });
    
    const bundle: ICBundle = {
      bundleId,
      generatedAt: new Date().toISOString(),
      weekOf,
      summary: {
        totalPackets: packets.length,
        byStyle,
        bySector,
        avgConviction: highlights.reduce((sum, h) => sum + h.conviction, 0) / (highlights.length || 1),
        passedAllGates,
        roicAnalysesCompleted,
      },
      highlights,
      packets: packetSummaries,
      executiveSummary,
    };
    
    await runsRepository.updateStatus(bundleId, 'completed');
    await runsRepository.updatePayload(bundleId, {
      bundle,
      packetsIncluded: packets.length,
      roicAnalysesCompleted,
      duration_ms: Date.now() - startTime,
    });
    
    console.log(`[IC Bundle] Bundle generated successfully`);
    console.log(`[IC Bundle] Packets included: ${packets.length}`);
    console.log(`[IC Bundle] Passed all gates: ${passedAllGates}`);
    console.log(`[IC Bundle] ROIC analyses completed: ${roicAnalysesCompleted}`);
    
    return {
      success: true,
      bundleId,
      packetsIncluded: packets.length,
      roicAnalysesCompleted,
      errors,
      duration_ms: Date.now() - startTime,
      bundle,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    errors.push(errorMessage);
    await runsRepository.updateStatus(bundleId, 'failed', errorMessage);
    console.error('[IC Bundle] Generation failed:', errorMessage);
    
    return {
      success: false,
      bundleId,
      packetsIncluded: 0,
      roicAnalysesCompleted: 0,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }
}

export default { generateICBundle };
