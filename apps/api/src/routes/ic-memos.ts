/**
 * IC Memos API Routes
 * Lane C - Investment Committee Memos
 * Updated to integrate Lane C Runner with ROIC Decomposition
 */
import { Router, Request, Response } from 'express';
import {
  icMemosRepository,
  researchPacketsRepository,
  ideasRepository,
  runsRepository,
} from '@arc/database';
import type { Router as RouterType } from 'express';

export const icMemosRouter: RouterType = Router();

// GET /api/ic-memos - List all IC Memos
icMemosRouter.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    
    let memos;
    if (status) {
      memos = await icMemosRepository.getByStatus(status as any, limit);
    } else {
      memos = await icMemosRepository.getAll(limit);
    }

    // Enrich with packet info
    const enrichedMemos = await Promise.all(
      memos.map(async (memo) => {
        const packet = await researchPacketsRepository.getById(memo.packetId);
        const idea = await ideasRepository.getById(memo.ideaId);
        
        return {
          id: memo.memoId,
          packet_id: memo.packetId,
          idea_id: memo.ideaId,
          ticker: memo.ticker,
          company_name: memo.companyName || idea?.companyName || memo.ticker,
          style_tag: memo.styleTag,
          status: memo.status,
          generation_progress: memo.generationProgress,
          recommendation: memo.recommendation,
          conviction: memo.conviction,
          // Score v4.0 (Contrarian/Turnaround Model)
          score_v4: (memo as any).scoreV4 || null,
          score_v4_quintile: (memo as any).scoreV4Quintile || null,
          score_v4_recommendation: (memo as any).scoreV4Recommendation || null,
          // Turnaround Score
          turnaround_score: (memo as any).turnaroundScore || null,
          turnaround_quintile: (memo as any).turnaroundQuintile || null,
          turnaround_recommendation: (memo as any).turnaroundRecommendation || null,
          // Piotroski F-Score
          piotroski_score: (memo as any).piotroskiScore || null,
          // Quality Score (14 factors)
          quality_score: (memo as any).qualityScore || null,
          quality_score_quintile: (memo as any).qualityScoreQuintile || null,
          // Contrarian Score (inverted momentum)
          contrarian_score: (memo as any).contrarianScore || null,
          contrarian_score_quintile: (memo as any).contrarianScoreQuintile || null,
          // Turnaround Score Quintile
          turnaround_score_quintile: (memo as any).turnaroundScoreQuintile || null,
          // Piotroski Score Quintile
          piotroski_score_quintile: (memo as any).piotroskiScoreQuintile || null,
          approved_at: memo.approvedAt,
          created_at: memo.createdAt,
          completed_at: memo.completedAt,
          has_content: !!memo.memoContent,
          supportingAnalyses: memo.supportingAnalyses,
        };
      })
    );

    res.json(enrichedMemos);
  } catch (error) {
    console.error('Error fetching IC memos:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ic-memos/stats - Get IC Memo statistics
icMemosRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const countByStatus = await icMemosRepository.countByStatus();
    
    res.json({
      total: Object.values(countByStatus).reduce((a, b) => a + b, 0),
      by_status: countByStatus,
    });
  } catch (error) {
    console.error('Error fetching IC memo stats:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ic-memos/:memoId - Get specific IC Memo
icMemosRouter.get('/:memoId', async (req: Request, res: Response) => {
  try {
    const memo = await icMemosRepository.getById(req.params.memoId);
    
    if (!memo) {
      return res.status(404).json({ error: 'IC Memo not found' });
    }

    // Get related packet and idea
    const packet = await researchPacketsRepository.getById(memo.packetId);
    const idea = await ideasRepository.getById(memo.ideaId);

    res.json({
      id: memo.memoId,
      packet_id: memo.packetId,
      idea_id: memo.ideaId,
      ticker: memo.ticker,
      company_name: memo.companyName || idea?.companyName || memo.ticker,
      style_tag: memo.styleTag,
      as_of: memo.asOf,
      status: memo.status,
      generation_progress: memo.generationProgress,
      recommendation: memo.recommendation,
      conviction: memo.conviction,
      approved_at: memo.approvedAt,
      created_at: memo.createdAt,
      completed_at: memo.completedAt,
      memo_content: memo.memoContent,
      supporting_analyses: memo.supportingAnalyses,
      error_message: memo.errorMessage,
      research_packet: packet ? {
        id: packet.packetId,
        decision_brief: packet.decisionBrief,
        modules: (packet as any).modules,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching IC memo:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ic-memos/approve/:packetId - Approve single research packet for IC Memo generation
icMemosRouter.post('/approve/:packetId', async (req: Request, res: Response) => {
  try {
    const { packetId } = req.params;
    
    const packet = await researchPacketsRepository.getById(packetId);
    
    if (!packet) {
      return res.status(404).json({ error: 'Packet not found' });
    }

    // Check if IC Memo already exists for this packet
    const existingMemo = await icMemosRepository.getByPacketId(packetId);
    if (existingMemo) {
      return res.status(400).json({ 
        error: 'IC Memo already exists for this packet',
        memoId: existingMemo.memoId,
      });
    }

    // Create IC Memo
    const idea = await ideasRepository.getById(packet.ideaId);
    const decisionBrief = packet.decisionBrief as any || {};
    
    const memoId = await icMemosRepository.create({
      packetId,
      ideaId: packet.ideaId,
      ticker: packet.ticker,
      companyName: idea?.companyName || packet.ticker,
      styleTag: decisionBrief.style_tag || 'quality_compounder',
      asOf: new Date().toISOString(),
      status: 'pending',
      generationProgress: 0,
    });

    console.log(`[IC Memos API] Approved packet ${packetId} for IC Memo generation (Memo: ${memoId})`);

    res.json({
      success: true,
      message: 'Packet approved for IC Memo generation',
      packetId,
      memoId,
    });
  } catch (error) {
    console.error('Error approving packet:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ic-memos/approve - Approve research packets for IC Memo generation (batch)
icMemosRouter.post('/approve', async (req: Request, res: Response) => {
  try {
    const { packetIds } = req.body;
    
    if (!packetIds || !Array.isArray(packetIds) || packetIds.length === 0) {
      return res.status(400).json({ error: 'packetIds array is required' });
    }

    const results = [];
    
    for (const packetId of packetIds) {
      const packet = await researchPacketsRepository.getById(packetId);
      
      if (!packet) {
        results.push({ packetId, success: false, error: 'Packet not found' });
        continue;
      }

      // Check if IC Memo already exists for this packet
      const existingMemo = await icMemosRepository.getByPacketId(packetId);
      if (existingMemo) {
        results.push({ 
          packetId, 
          success: false, 
          error: 'IC Memo already exists',
          memoId: existingMemo.memoId,
        });
        continue;
      }

      // Create IC Memo
      const idea = await ideasRepository.getById(packet.ideaId);
      const decisionBrief = packet.decisionBrief as any || {};
      
      const memoId = await icMemosRepository.create({
        packetId,
        ideaId: packet.ideaId,
        ticker: packet.ticker,
        companyName: idea?.companyName || packet.ticker,
        styleTag: decisionBrief.style_tag || 'quality_compounder',
        asOf: new Date().toISOString(),
        status: 'pending',
        generationProgress: 0,
      });

      results.push({ packetId, success: true, memoId });
    }

    res.json({
      success: true,
      message: `Approved ${results.filter(r => r.success).length} of ${packetIds.length} packets`,
      results,
    });
  } catch (error) {
    console.error('Error approving packets:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ic-memos/:memoId/generate - Trigger IC Memo generation with ROIC Decomposition
icMemosRouter.post('/:memoId/generate', async (req: Request, res: Response) => {
  try {
    const memo = await icMemosRepository.getById(req.params.memoId);
    
    if (!memo) {
      return res.status(404).json({ error: 'IC Memo not found' });
    }

    if (memo.status === 'generating') {
      return res.status(400).json({ 
        error: 'IC Memo generation already in progress',
        progress: memo.generationProgress,
      });
    }

    if (memo.status === 'complete') {
      return res.status(400).json({ 
        error: 'IC Memo already complete',
      });
    }

    // Update status to generating
    await icMemosRepository.updateStatus(memo.memoId, 'generating');
    await icMemosRepository.updateProgress(memo.memoId, 5);

    // Create a run record to trigger the worker
    const runId = await runsRepository.create({
      runType: 'manual_lane_c_trigger',
      status: 'pending',
      payload: {
        memoId: memo.memoId,
        packetId: memo.packetId,
        ticker: memo.ticker,
        triggeredAt: new Date().toISOString(),
        includeROIC: true, // Enable ROIC Decomposition
      },
    });

    console.log(`[IC Memos API] Triggered Lane C generation for ${memo.ticker} (Memo: ${memo.memoId}, Run: ${runId})`);

    res.json({
      success: true,
      message: 'IC Memo generation started with ROIC Decomposition',
      memo_id: memo.memoId,
      run_id: runId,
      status: 'generating',
      note: 'The worker will process this memo and include ROIC Decomposition analysis.',
    });
  } catch (error) {
    console.error('Error triggering IC memo generation:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ic-memos/:memoId/status - Get generation status
icMemosRouter.get('/:memoId/status', async (req: Request, res: Response) => {
  try {
    const memo = await icMemosRepository.getById(req.params.memoId);
    
    if (!memo) {
      return res.status(404).json({ error: 'IC Memo not found' });
    }

    res.json({
      memo_id: memo.memoId,
      ticker: memo.ticker,
      status: memo.status,
      generation_progress: memo.generationProgress,
      error_message: memo.errorMessage,
      completed_at: memo.completedAt,
      has_roic: !!(memo.supportingAnalyses as any)?.roic_decomposition,
    });
  } catch (error) {
    console.error('Error fetching IC memo status:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ic-memos/run-lane-c - Trigger Lane C run for pending memos
icMemosRouter.post('/run-lane-c', async (req: Request, res: Response) => {
  try {
    const { maxMemos, dryRun } = req.body;
    const pendingMemos = await icMemosRepository.getPending(maxMemos || 5);
    
    if (pendingMemos.length === 0) {
      return res.json({
        success: true,
        message: 'No pending IC Memos to process',
        pending_count: 0,
      });
    }

    if (dryRun) {
      return res.json({
        success: true,
        message: `Dry run: ${pendingMemos.length} IC Memos would be processed`,
        pending_count: pendingMemos.length,
        memos: pendingMemos.map(m => ({
          memo_id: m.memoId,
          ticker: m.ticker,
          status: m.status,
        })),
      });
    }

    // Create a run record to trigger the worker for batch processing
    const runId = await runsRepository.create({
      runType: 'manual_lane_c_batch_trigger',
      status: 'pending',
      payload: {
        memoIds: pendingMemos.map(m => m.memoId),
        triggeredAt: new Date().toISOString(),
        includeROIC: true,
      },
    });

    res.json({
      success: true,
      message: `Lane C run triggered for ${pendingMemos.length} pending IC Memos`,
      run_id: runId,
      pending_count: pendingMemos.length,
      memos: pendingMemos.map(m => ({
        memo_id: m.memoId,
        ticker: m.ticker,
        status: m.status,
      })),
      note: 'Processing started with ROIC Decomposition. Check /api/ic-memos for status updates.',
    });
  } catch (error) {
    console.error('Error triggering Lane C run:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ic-memos/:memoId/pdf - Generate and download PDF
icMemosRouter.get('/:memoId/pdf', async (req: Request, res: Response) => {
  try {
    const memo = await icMemosRepository.getById(req.params.memoId);
    
    if (!memo) {
      return res.status(404).json({ error: 'IC Memo not found' });
    }

    if (memo.status !== 'complete') {
      return res.status(400).json({ 
        error: 'IC Memo is not complete yet',
        status: memo.status,
      });
    }

    const content = memo.memoContent;
    const idea = await ideasRepository.getById(memo.ideaId);
    
    const html = generateICMemoPdfHtml({
      ticker: memo.ticker,
      companyName: memo.companyName || idea?.companyName || memo.ticker,
      styleTag: memo.styleTag,
      recommendation: memo.recommendation,
      conviction: memo.conviction,
      content: content as any,
      supportingAnalyses: memo.supportingAnalyses as any,
      asOf: memo.asOf ? new Date(memo.asOf) : null,
    });

    // For now, return HTML (PDF generation can be added later with puppeteer)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="${memo.ticker}_IC_Memo.html"`);
    res.send(html);
  } catch (error) {
    console.error('Error generating IC memo PDF:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Helper function to generate PDF HTML
function generateICMemoPdfHtml(data: {
  ticker: string;
  companyName: string;
  styleTag: string;
  recommendation: string | null;
  conviction: number | null;
  content: any;
  supportingAnalyses: any;
  asOf: Date | null;
}): string {
  const { ticker, companyName, styleTag, recommendation, conviction, content, supportingAnalyses, asOf } = data;
  
  const hasParseError = content?._parse_error || content?.executive_summary?.opportunity === 'Failed to generate - see raw content';
  
  // Format ROIC Decomposition section if available
  let roicSection = '';
  if (supportingAnalyses?.roic_decomposition?.success) {
    const roic = supportingAnalyses.roic_decomposition;
    roicSection = `
      <div class="section">
        <h2>ROIC Decomposition Analysis</h2>
        <div class="roic-summary">
          <p><strong>ROIC Durability Score:</strong> ${roic.durability_score || 'N/A'}/10</p>
          <p><strong>Gross Margin Classification:</strong> ${roic.gross_margin_classification || 'N/A'}</p>
          <p><strong>Capital Efficiency Classification:</strong> ${roic.capital_efficiency_classification || 'N/A'}</p>
          <p><strong>Number One Thing to Watch:</strong> ${roic.number_one_thing_to_watch || 'N/A'}</p>
        </div>
      </div>
    `;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${ticker} - IC Memo</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #4a90a4; padding-bottom: 10px; }
    h2 { color: #4a90a4; margin-top: 30px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .meta { color: #666; font-size: 14px; }
    .recommendation { 
      display: inline-block; 
      padding: 8px 16px; 
      border-radius: 4px; 
      font-weight: bold;
      color: white;
    }
    .recommendation.buy { background: #22c55e; }
    .recommendation.hold { background: #f59e0b; }
    .recommendation.sell { background: #ef4444; }
    .conviction { font-size: 18px; margin-left: 10px; }
    .section { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .roic-summary { background: #e8f4f8; padding: 15px; border-radius: 8px; margin-top: 10px; }
    .raw-content { white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 15px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #4a90a4; color: white; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${ticker} - ${companyName}</h1>
      <div class="meta">Style: ${styleTag} | As of: ${asOf ? new Date(asOf).toLocaleDateString() : 'N/A'}</div>
    </div>
    <div>
      <span class="recommendation ${(recommendation || '').toLowerCase()}">${recommendation || 'N/A'}</span>
      <span class="conviction">Conviction: ${conviction || 'N/A'}/10</span>
    </div>
  </div>

  ${hasParseError ? `
    <div class="section">
      <h2>Raw Content</h2>
      <div class="raw-content">${content?._raw_content || JSON.stringify(content, null, 2)}</div>
    </div>
  ` : `
    <div class="section">
      <h2>Executive Summary</h2>
      <p><strong>Opportunity:</strong> ${content?.executive_summary?.opportunity || 'N/A'}</p>
      <p><strong>Thesis:</strong> ${content?.executive_summary?.thesis || 'N/A'}</p>
      <p><strong>Key Catalysts:</strong> ${content?.executive_summary?.key_catalysts || 'N/A'}</p>
    </div>

    <div class="section">
      <h2>Investment Thesis</h2>
      <p>${content?.investment_thesis?.detailed_thesis || 'N/A'}</p>
    </div>

    <div class="section">
      <h2>Valuation</h2>
      <p><strong>Current Valuation:</strong> ${content?.valuation?.current_valuation || 'N/A'}</p>
      <p><strong>Target Price:</strong> ${content?.valuation?.target_price || 'N/A'}</p>
      <p><strong>Upside/Downside:</strong> ${content?.valuation?.upside_downside || 'N/A'}</p>
    </div>

    <div class="section">
      <h2>Key Risks</h2>
      <ul>
        ${(content?.risks?.key_risks || []).map((r: string) => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    ${roicSection}
  `}
</body>
</html>
  `;
}

export default icMemosRouter;
