/**
 * ARC Investment Factory - IC Bundle Generator
 * Schedule: Friday 19:00 America/Sao_Paulo
 * 
 * Generates the weekly Investment Committee bundle containing:
 * - All completed research packets from the week
 * - Summary statistics and highlights
 * - Prioritized list of ideas for IC review
 */

import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_TIMEZONE, LANE_B_WEEKLY_LIMIT } from '@arc/shared';
import {
  researchPacketsRepository,
  ideasRepository,
  runsRepository,
} from '@arc/database';
import { createResilientClient } from '@arc/llm-client';

export interface ICBundleConfig {
  dryRun?: boolean;
  lookbackDays?: number;
  forceIncludePacketIds?: string[];
}

export interface ICBundleResult {
  success: boolean;
  bundleId: string;
  packetsIncluded: number;
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
  };
  highlights: Array<{
    ticker: string;
    companyName: string;
    styleTag: string;
    headline: string;
    conviction: number;
    keyInsight: string;
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
  }>;
  executiveSummary: string;
}

// Type for the packet JSON structure
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
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Generate executive summary using LLM
 */
async function generateExecutiveSummary(
  packets: any[],
  highlights: ICBundle['highlights']
): Promise<string> {
  if (packets.length === 0) {
    return 'No research packets completed this week.';
  }

  const llm = createResilientClient();

  const prompt = `You are a senior investment analyst preparing the weekly Investment Committee brief.

This week, the research team completed ${packets.length} deep research packets.

Top highlights:
${highlights.map(h => `- ${h.ticker} (${h.styleTag}): ${h.headline}`).join('\n')}

Write a concise 2-3 paragraph executive summary for the Investment Committee that:
1. Summarizes the key themes and opportunities identified this week
2. Highlights any notable risks or concerns across the portfolio
3. Provides a recommendation on which ideas deserve priority discussion

Keep it professional, data-driven, and actionable. Maximum 300 words.`;

  try {
    const response = await llm.complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 500,
    });
    return response.content;
  } catch (error) {
    console.error('[IC Bundle] Failed to generate executive summary:', error);
    return `This week's research covered ${packets.length} companies across various sectors. Please review the individual packets for detailed analysis.`;
  }
}

/**
 * Extract highlights from packets
 */
function extractHighlights(
  packets: any[],
  ideas: Map<string, any>
): ICBundle['highlights'] {
  const highlights: ICBundle['highlights'] = [];

  for (const packet of packets) {
    const idea = ideas.get(packet.ideaId);
    if (!idea) continue;

    // Parse packet data
    const packetData = packet.packet as PacketData;

    // Calculate conviction score based on gate results and valuation
    let conviction = 5; // Base score
    if (packetData?.gateResults?.all_passed) conviction += 2;
    if (packetData?.modules?.valuation?.fair_value_range) {
      const upside = packetData.modules.valuation.fair_value_range.base / 
        (packetData.modules.valuation.current_price || 1) - 1;
      if (upside > 0.3) conviction += 2;
      else if (upside > 0.15) conviction += 1;
    }

    // Extract key insight
    let keyInsight = '';
    if (packetData?.modules?.business?.summary) {
      keyInsight = packetData.modules.business.summary.slice(0, 200);
    } else if (packetData?.modules?.industry_moat?.summary) {
      keyInsight = packetData.modules.industry_moat.summary.slice(0, 200);
    }

    highlights.push({
      ticker: packet.ticker,
      companyName: idea.companyName || packet.ticker,
      styleTag: idea.styleTag,
      headline: idea.oneSentenceHypothesis || 'Deep research completed',
      conviction: Math.min(10, conviction),
      keyInsight,
    });
  }

  // Sort by conviction and take top 5
  return highlights
    .sort((a, b) => b.conviction - a.conviction)
    .slice(0, 5);
}

/**
 * Generate the IC Bundle
 */
export async function generateICBundle(config: ICBundleConfig = {}): Promise<ICBundleResult> {
  const startTime = Date.now();
  const bundleId = uuidv4();
  const errors: string[] = [];

  console.log(`[IC Bundle] Generating bundle ${bundleId} at ${new Date().toISOString()}`);
  console.log(`[IC Bundle] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`[IC Bundle] Weekly capacity: ${LANE_B_WEEKLY_LIMIT}`);

  // Create run record
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
      errors: [],
      duration_ms: Date.now() - startTime,
    };
  }

  try {
    // Get lookback period
    const lookbackDays = config.lookbackDays ?? 7;
    const weekStart = getWeekStart();
    const weekOf = weekStart.toISOString().split('T')[0];

    console.log(`[IC Bundle] Looking back ${lookbackDays} days from ${weekOf}`);

    // Fetch recent research packets
    const packets = await researchPacketsRepository.getRecentPackets(lookbackDays);
    console.log(`[IC Bundle] Found ${packets.length} packets`);

    // Include any forced packets
    if (config.forceIncludePacketIds?.length) {
      for (const packetId of config.forceIncludePacketIds) {
        const packet = await researchPacketsRepository.getById(packetId);
        if (packet && !packets.find(p => p.packetId === packetId)) {
          packets.push(packet);
        }
      }
    }

    // Fetch associated ideas
    const ideaIds = [...new Set(packets.map(p => p.ideaId))];
    const ideas = new Map<string, any>();
    for (const ideaId of ideaIds) {
      const idea = await ideasRepository.getById(ideaId);
      if (idea) ideas.set(ideaId, idea);
    }

    // Calculate summary statistics
    const byStyle: Record<string, number> = {};
    const bySector: Record<string, number> = {};
    let passedAllGates = 0;

    for (const packet of packets) {
      const idea = ideas.get(packet.ideaId);
      const packetData = packet.packet as PacketData;
      
      if (idea) {
        byStyle[idea.styleTag] = (byStyle[idea.styleTag] || 0) + 1;
        // Sector would come from the profile in the packet
        const sector = packetData?.modules?.business?.sector || 'Unknown';
        bySector[sector] = (bySector[sector] || 0) + 1;
      }
      if (packetData?.gateResults?.all_passed) passedAllGates++;
    }

    // Extract highlights
    const highlights = extractHighlights(packets, ideas);

    // Generate executive summary
    console.log('[IC Bundle] Generating executive summary...');
    const executiveSummary = await generateExecutiveSummary(packets, highlights);

    // Build packet summaries
    const packetSummaries = packets.map(packet => {
      const idea = ideas.get(packet.ideaId);
      const packetData = packet.packet as PacketData;
      
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
      };
    });

    // Build the bundle
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
      },
      highlights,
      packets: packetSummaries,
      executiveSummary,
    };

    // Update run record with bundle data
    await runsRepository.updateStatus(bundleId, 'completed');
    await runsRepository.updatePayload(bundleId, {
      bundle,
      packetsIncluded: packets.length,
      duration_ms: Date.now() - startTime,
    });

    console.log(`[IC Bundle] Bundle generated successfully`);
    console.log(`[IC Bundle] Packets included: ${packets.length}`);
    console.log(`[IC Bundle] Passed all gates: ${passedAllGates}`);

    return {
      success: true,
      bundleId,
      packetsIncluded: packets.length,
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
      errors,
      duration_ms: Date.now() - startTime,
    };
  }
}

export default { generateICBundle };
