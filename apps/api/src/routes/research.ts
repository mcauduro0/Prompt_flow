/**
 * ARC Investment Factory - Research Routes
 * Updated with manual research trigger endpoints
 */
import { Router, Request, Response } from 'express';
import { researchPacketsRepository, evidenceRepository, runsRepository, icMemosRepository, ideasRepository } from '@arc/database';
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
    upside_percent: null,
    gates_passed: gatesPassed,
    total_gates: 5,
    version: dbPacket.thesisVersion || 1,
    is_complete: isComplete,
    created_at: dbPacket.createdAt,
    updated_at: dbPacket.updatedAt,
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
    _raw: dbPacket
  };
}

// ============================================================================
// MANUAL RESEARCH TRIGGER ENDPOINTS (NEW)
// ============================================================================

// POST /api/research/start - Start research for specific ideas
researchRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { ideaIds, maxPackets = 5 } = req.body;
    
    if (!Array.isArray(ideaIds) || ideaIds.length === 0) {
      res.status(400).json({ error: 'ideaIds array required' });
      return;
    }
    
    // Create a run record to track this manual trigger
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_b_trigger',
      runDate: new Date(),
      status: 'pending',
      payload: { 
        ideaIds, 
        maxPackets,
        triggeredAt: new Date().toISOString(),
        source: 'api_manual_trigger'
      },
    });
    
    res.json({ 
      success: true,
      message: `Research queued for ${ideaIds.length} ideas`,
      runId,
      ideaIds,
      maxPackets,
      note: 'Research will be processed by the worker. Check /api/research/runs for status.'
    });
  } catch (error) {
    console.error('[Research API] Error starting research:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/research/start-all-queued - Start research for all queued ideas
researchRouter.post('/start-all-queued', async (req: Request, res: Response) => {
  try {
    const { maxPackets = 10 } = req.body;
    
    // Get all promoted ideas that don't have research packets yet
    const promotedIdeas = await ideasRepository.getByStatus('promoted', 100);
    
    // Filter to only those without research packets
    const queuedIdeas: string[] = [];
    for (const idea of promotedIdeas) {
      try {
        const packet = await researchPacketsRepository.getByIdeaId(idea.ideaId);
        if (!packet) {
          queuedIdeas.push(idea.ideaId);
        }
      } catch {
        queuedIdeas.push(idea.ideaId);
      }
    }
    
    if (queuedIdeas.length === 0) {
      res.json({ 
        success: true,
        message: 'No queued ideas found for research',
        count: 0
      });
      return;
    }
    
    // Limit to maxPackets
    const ideaIdsToProcess = queuedIdeas.slice(0, maxPackets);
    
    // Create a run record to track this manual trigger
    const runId = randomUUID();
    await runsRepository.create({
      runId,
      runType: 'manual_lane_b_batch_trigger',
      runDate: new Date(),
      status: 'pending',
      payload: { 
        ideaIds: ideaIdsToProcess, 
        totalQueued: queuedIdeas.length,
        maxPackets,
        triggeredAt: new Date().toISOString(),
        source: 'api_batch_trigger'
      },
    });
    
    res.json({ 
      success: true,
      message: `Research queued for ${ideaIdsToProcess.length} of ${queuedIdeas.length} queued ideas`,
      runId,
      ideaIds: ideaIdsToProcess,
      totalQueued: queuedIdeas.length,
      note: 'Research will be processed by the worker. Check /api/research/runs for status.'
    });
  } catch (error) {
    console.error('[Research API] Error starting batch research:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/research/queued - Get all queued ideas (promoted but no research packet)
researchRouter.get('/queued', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    
    // Get all promoted ideas
    const promotedIdeas = await ideasRepository.getByStatus('promoted', limit);
    
    // Filter to only those without research packets
    const queuedIdeas = [];
    for (const idea of promotedIdeas) {
      try {
        const packet = await researchPacketsRepository.getByIdeaId(idea.ideaId);
        if (!packet) {
          queuedIdeas.push({
            ideaId: idea.ideaId,
            ticker: idea.ticker,
            companyName: idea.companyName,
            styleTag: idea.styleTag,
            convictionScore: idea.convictionScore,
            promotedAt: idea.updatedAt,
          });
        }
      } catch {
        queuedIdeas.push({
          ideaId: idea.ideaId,
          ticker: idea.ticker,
          companyName: idea.companyName,
          styleTag: idea.styleTag,
          convictionScore: idea.convictionScore,
          promotedAt: idea.updatedAt,
        });
      }
    }
    
    res.json({ 
      queued: queuedIdeas, 
      count: queuedIdeas.length 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// EXISTING ENDPOINTS
// ============================================================================

// IMPORTANT: Specific routes MUST come before parameterized routes
// Trigger Lane A discovery manually
researchRouter.post('/trigger-lane-a', async (req: Request, res: Response) => {
  try {
    const dryRun = req.query.dryRun === 'true';
    const maxIdeas = parseInt(req.query.maxIdeas as string) || 10;
    
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
      note: 'Actual processing happens via scheduled worker. This endpoint records the intent.'
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all runs
researchRouter.get('/runs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await runsRepository.getRecent(limit);
    res.json({ runs, count: runs.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get run by ID
researchRouter.get('/runs/:runId', async (req: Request, res: Response) => {
  try {
    const run = await runsRepository.getById(req.params.runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all research packets
researchRouter.get('/packets', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    
    let rawPackets;
    if (status === 'complete') {
      rawPackets = await researchPacketsRepository.getCompleted(limit);
    } else if (status === 'pending') {
      rawPackets = await researchPacketsRepository.getPending(limit);
    } else {
      rawPackets = await researchPacketsRepository.getRecent(limit);
    }
    
    const packets = rawPackets.map(transformPacketForFrontend);
    res.json({ packets, count: packets.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get research packet by ID
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
