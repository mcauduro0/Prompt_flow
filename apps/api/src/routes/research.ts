/**
 * ARC Investment Factory - Research Routes
 */

import { Router, Request, Response } from 'express';
import { researchPacketsRepository, evidenceRepository, runsRepository, icMemosRepository } from '@arc/database';
import { randomUUID } from 'crypto';

export const researchRouter: Router = Router();

// Helper function to transform database packet to frontend format
function transformPacketForFrontend(dbPacket: any) {
  const packet = dbPacket.packet || {};
  const decisionBrief = dbPacket.decisionBrief || {};
  const companyData = packet.companyData || {};
  const profile = companyData.profile || {};
  const metrics = companyData.metrics || {};
  const gateResults = packet.gateResults || {};
  
  // Count passed gates
  const gateKeys = ['gate_0_data_sufficiency', 'gate_1_coherence', 'gate_2_edge_claim', 'gate_3_downside_shape', 'gate_4_style_fit'];
  let gatesPassed = 0;
  for (const key of gateKeys) {
    if (gateResults[key]?.passed) gatesPassed++;
  }
  
  // Determine if packet is complete (has decision brief with valid recommendation)
  const validRecommendations = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];
  const isComplete = decisionBrief.recommendation && 
                     validRecommendations.includes(decisionBrief.recommendation) && 
                     decisionBrief.thesis && 
                     !decisionBrief.thesis.includes('Synthesis failed');
  
  // Map recommendation to frontend format
  const recommendationMap: Record<string, string> = {
    'strong_buy': 'BUY',
    'buy': 'BUY',
    'hold': 'HOLD',
    'sell': 'SELL',
    'strong_sell': 'SELL'
  };
  
  return {
    id: dbPacket.packetId,
    idea_id: dbPacket.ideaId,
    ticker: dbPacket.ticker,
    company_name: profile.companyName || dbPacket.ticker,
    headline: packet.oneSentenceHypothesis || decisionBrief.thesis || `Research packet for ${dbPacket.ticker}`,
    style: dbPacket.styleTag || 'unknown',
    recommendation: recommendationMap[decisionBrief.recommendation] || 'HOLD',
    conviction_level: decisionBrief.conviction >= 70 ? 'high' : decisionBrief.conviction >= 40 ? 'medium' : 'low',
    conviction_score: decisionBrief.conviction || 0,
    target_price: decisionBrief.position_guidance?.target_price || null,
    current_price: companyData.latestPrice?.close || null,
    upside_percent: null, // Calculate if both prices available
    gates_passed: gatesPassed,
    total_gates: 5,
    version: dbPacket.thesisVersion || 1,
    is_complete: isComplete,
    created_at: dbPacket.createdAt,
    updated_at: dbPacket.updatedAt,
    // Additional fields for detail view
    thesis: decisionBrief.thesis || '',
    bull_case: decisionBrief.bull_case || '',
    base_case: decisionBrief.base_case || '',
    bear_case: decisionBrief.bear_case || '',
    key_risks: decisionBrief.key_risks || [],
    catalysts: dbPacket.monitoringPlan?.catalysts || [],
    monitoring_plan: dbPacket.monitoringPlan || {},
    gate_results: gateResults,
    company_profile: profile,
    financial_metrics: metrics,
    // Raw data for debugging
    _raw: dbPacket
  };
}

// IMPORTANT: Specific routes MUST come before parameterized routes

// Trigger Lane A discovery manually
researchRouter.post('/trigger-lane-a', async (req: Request, res: Response) => {
  try {
    const dryRun = req.query.dryRun === 'true';
    const maxIdeas = parseInt(req.query.maxIdeas as string) || 10;
    
    // Create a run record to track this manual trigger
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_a_trigger',
      runDate: new Date(),
      status: 'running',
      payload: { dryRun, maxIdeas, triggeredAt: new Date().toISOString() },
    });
    
    res.json({ 
      message: 'Lane A discovery trigger recorded',
      runId,
      dryRun,
      maxIdeas,
      status: 'pending',
      note: 'The worker will pick this up on next scheduled run, or you can restart the worker to process immediately'
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get recent packets for IC bundle
researchRouter.get('/packets/recent', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const rawPackets = await researchPacketsRepository.getRecentPackets(days);
    const packets = rawPackets.map(transformPacketForFrontend);
    res.json({ packets, days, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all research packets (list endpoint)
researchRouter.get('/packets', async (req: Request, res: Response) => {
  try {
    const rawPackets = await researchPacketsRepository.getRecentPackets(30);
    
    // Enrich packets with IC memo status
    const packetsWithICStatus = await Promise.all(
      rawPackets.map(async (rawPacket) => {
        const transformed = transformPacketForFrontend(rawPacket);
        const icMemo = await icMemosRepository.getByPacketId(rawPacket.packetId);
        return {
          ...transformed,
          ic_memo_status: icMemo?.status || null,
          ic_memo_id: icMemo?.memoId || null,
        };
      })
    );
    
    // Calculate stats
    const completedPackets = packetsWithICStatus.filter((p: any) => p.is_complete);
    const inProgressPackets = packetsWithICStatus.filter((p: any) => !p.is_complete);
    
    res.json({ 
      packets: packetsWithICStatus, 
      count: packetsWithICStatus.length,
      stats: {
        total: packetsWithICStatus.length,
        completed: completedPackets.length,
        in_progress: inProgressPackets.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get research packet by idea ID
researchRouter.get('/packets/idea/:ideaId', async (req: Request, res: Response) => {
  try {
    const rawPacket = await researchPacketsRepository.getByIdeaId(req.params.ideaId);
    if (!rawPacket) {
      res.status(404).json({ error: 'Research packet not found for idea' });
      return;
    }
    res.json(transformPacketForFrontend(rawPacket));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all versions for an idea
researchRouter.get('/packets/idea/:ideaId/versions', async (req: Request, res: Response) => {
  try {
    const rawPackets = await researchPacketsRepository.getAllVersionsByIdeaId(req.params.ideaId);
    const packets = rawPackets.map(transformPacketForFrontend);
    res.json({ packets, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get research packets by ticker
researchRouter.get('/packets/ticker/:ticker', async (req: Request, res: Response) => {
  try {
    const rawPackets = await researchPacketsRepository.getByTicker(req.params.ticker);
    const packets = rawPackets.map(transformPacketForFrontend);
    res.json({ packets, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get research packet by ID (MUST be last among /packets routes)
researchRouter.get('/packets/:packetId', async (req: Request, res: Response) => {
  try {
    const rawPacket = await researchPacketsRepository.getById(req.params.packetId);
    if (!rawPacket) {
      res.status(404).json({ error: 'Research packet not found' });
      return;
    }
    res.json(transformPacketForFrontend(rawPacket));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get evidence for an idea
researchRouter.get('/evidence/idea/:ideaId', async (req: Request, res: Response) => {
  try {
    const evidence = await evidenceRepository.getByIdeaId(req.params.ideaId);
    res.json({ evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get evidence by ticker
researchRouter.get('/evidence/ticker/:ticker', async (req: Request, res: Response) => {
  try {
    const evidence = await evidenceRepository.getByTicker(req.params.ticker);
    res.json({ evidence, count: evidence.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get weekly packet count
researchRouter.get('/stats/weekly-count', async (req: Request, res: Response) => {
  try {
    const count = await researchPacketsRepository.countWeeklyPackets();
    res.json({ weeklyCount: count });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
