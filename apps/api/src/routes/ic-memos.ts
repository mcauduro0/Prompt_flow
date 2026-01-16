/**
 * IC Memos API Routes
 * Lane C - Investment Committee Memos
 */

import { Router, Request, Response } from 'express';
import {
  icMemosRepository,
  researchPacketsRepository,
  ideasRepository,
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
          approved_at: memo.approvedAt,
          created_at: memo.createdAt,
          completed_at: memo.completedAt,
          has_content: !!memo.memoContent,
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
      memo_content: memo.memoContent,
      supporting_analyses: memo.supportingAnalyses,
      approved_at: memo.approvedAt,
      approved_by: memo.approvedBy,
      created_at: memo.createdAt,
      updated_at: memo.updatedAt,
      completed_at: memo.completedAt,
      error_message: memo.errorMessage,
      // Include research packet synthesis for context
      research_synthesis: packet?.decisionBrief,
      original_thesis: idea?.oneSentenceHypothesis,
    });
  } catch (error) {
    console.error('Error fetching IC memo:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ic-memos/approve/:packetId - Approve a research packet for IC Memo generation
icMemosRouter.post('/approve/:packetId', async (req: Request, res: Response) => {
  try {
    const { packetId } = req.params;
    const { approvedBy } = req.body;

    // Check if packet exists
    const packet = await researchPacketsRepository.getById(packetId);
    if (!packet) {
      return res.status(404).json({ error: 'Research packet not found' });
    }

    // Check if IC Memo already exists for this packet
    const existingMemo = await icMemosRepository.getByPacketId(packetId);
    if (existingMemo) {
      return res.status(400).json({ 
        error: 'IC Memo already exists for this packet',
        memo_id: existingMemo.memoId,
        status: existingMemo.status,
      });
    }

    // Get idea for company name
    const idea = await ideasRepository.getById(packet.ideaId);

    // Create IC Memo in pending status
    const memo = await icMemosRepository.create({
      packetId,
      ideaId: packet.ideaId,
      ticker: packet.ticker,
      companyName: idea?.companyName || packet.ticker,
      asOf: packet.asOf,
      styleTag: packet.styleTag,
      status: 'pending',
      generationProgress: 0,
      approvedAt: new Date(),
      approvedBy: approvedBy || 'system',
    });

    res.json({
      success: true,
      message: 'Research packet approved for IC Memo generation',
      memo_id: memo.memoId,
      ticker: memo.ticker,
      status: memo.status,
    });
  } catch (error) {
    console.error('Error approving packet for IC:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ic-memos/approve-batch - Approve multiple packets for IC Memo generation
icMemosRouter.post('/approve-batch', async (req: Request, res: Response) => {
  try {
    const { packetIds, approvedBy } = req.body;

    if (!Array.isArray(packetIds) || packetIds.length === 0) {
      return res.status(400).json({ error: 'packetIds array is required' });
    }

    const results = {
      approved: [] as string[],
      skipped: [] as { packetId: string; reason: string }[],
      failed: [] as { packetId: string; error: string }[],
    };

    for (const packetId of packetIds) {
      try {
        // Check if packet exists
        const packet = await researchPacketsRepository.getById(packetId);
        if (!packet) {
          results.skipped.push({ packetId, reason: 'Packet not found' });
          continue;
        }

        // Check if IC Memo already exists
        const existingMemo = await icMemosRepository.getByPacketId(packetId);
        if (existingMemo) {
          results.skipped.push({ packetId, reason: 'IC Memo already exists' });
          continue;
        }

        // Get idea for company name
        const idea = await ideasRepository.getById(packet.ideaId);

        // Create IC Memo
        await icMemosRepository.create({
          packetId,
          ideaId: packet.ideaId,
          ticker: packet.ticker,
          companyName: idea?.companyName || packet.ticker,
          asOf: packet.asOf,
          styleTag: packet.styleTag,
          status: 'pending',
          generationProgress: 0,
          approvedAt: new Date(),
          approvedBy: approvedBy || 'system',
        });

        results.approved.push(packetId);
      } catch (error) {
        results.failed.push({ packetId, error: (error as Error).message });
      }
    }

    res.json({
      success: true,
      total_requested: packetIds.length,
      approved_count: results.approved.length,
      skipped_count: results.skipped.length,
      failed_count: results.failed.length,
      results,
    });
  } catch (error) {
    console.error('Error in batch approval:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ic-memos/:memoId/generate - Trigger IC Memo generation
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

    // TODO: Trigger Lane C runner (will be implemented in next phase)
    // For now, just return success
    res.json({
      success: true,
      message: 'IC Memo generation started',
      memo_id: memo.memoId,
      status: 'generating',
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

    // Execute Lane C Runner via child process
    // This avoids import issues between packages
    const { spawn } = await import('child_process');
    
    const child = spawn('node', [
      '-e',
      `
        const { runLaneC } = require('/opt/arc/packages/worker/dist/orchestrator/index.js');
        runLaneC({ maxMemos: ${pendingMemos.length} })
          .then(result => {
            console.log('[Lane C] Completed:', JSON.stringify(result));
            process.exit(0);
          })
          .catch(err => {
            console.error('[Lane C] Error:', err.message);
            process.exit(1);
          });
      `
    ], {
      detached: true,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
    });
    
    child.unref();

    res.json({
      success: true,
      message: `Lane C run triggered for ${pendingMemos.length} pending IC Memos`,
      pending_count: pendingMemos.length,
      memos: pendingMemos.map(m => ({
        memo_id: m.memoId,
        ticker: m.ticker,
        status: m.status,
      })),
      note: 'Processing started. Check /api/ic-memos for status updates.',
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
    const packet = await researchPacketsRepository.getById(memo.packetId);

    // Generate HTML for PDF
    const html = generateICMemoPdfHtml({
      ticker: memo.ticker,
      companyName: memo.companyName || idea?.companyName || memo.ticker,
      styleTag: memo.styleTag,
      recommendation: memo.recommendation,
      conviction: memo.conviction,
      asOf: memo.asOf,
      completedAt: memo.completedAt,
      approvedBy: memo.approvedBy,
      content: content,
      supportingAnalyses: memo.supportingAnalyses,
    });

    // Convert HTML to PDF using puppeteer or return HTML for now
    // For simplicity, we'll use a server-side HTML to PDF conversion
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const fs = await import('fs/promises');
      const path = await import('path');
      const execAsync = promisify(exec);
      
      // Create temp files
      const tempDir = '/tmp';
      const htmlPath = path.join(tempDir, `ic_memo_${memo.memoId}.html`);
      const pdfPath = path.join(tempDir, `ic_memo_${memo.memoId}.pdf`);
      
      // Write HTML to temp file
      await fs.writeFile(htmlPath, html, 'utf-8');
      
      // Convert HTML to PDF using weasyprint (pre-installed)
      await execAsync(`weasyprint ${htmlPath} ${pdfPath}`);
      
      // Read PDF and send
      const pdfBuffer = await fs.readFile(pdfPath);
      
      // Clean up temp files
      await fs.unlink(htmlPath).catch(() => {});
      await fs.unlink(pdfPath).catch(() => {});
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="IC_Memo_${memo.ticker}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      // Fallback: return HTML
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="IC_Memo_${memo.ticker}_${new Date().toISOString().split('T')[0]}.html"`);
      res.send(html);
    }
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
  asOf: Date | string | null;
  completedAt: Date | string | null;
  approvedBy: string | null;
  content: any;
  supportingAnalyses: any;
}): string {
  const { ticker, companyName, styleTag, recommendation, conviction, asOf, completedAt, approvedBy, content, supportingAnalyses } = data;
  
  const formatDate = (date: Date | null | string): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const escapeHtml = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const renderArray = (arr: string[] | undefined): string => {
    if (!arr || arr.length === 0) return '';
    return `<ul>${arr.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  };

  const renderRisks = (risks: any[]): string => {
    if (!risks || risks.length === 0) return '';
    return risks.map(risk => `
      <div class="risk-item">
        <h4>${escapeHtml(risk.risk)}</h4>
        ${risk.manifestation ? `<p><strong>Manifestation:</strong> ${escapeHtml(risk.manifestation)}</p>` : ''}
        ${risk.impact ? `<p><strong>Impact:</strong> ${escapeHtml(risk.impact)}</p>` : ''}
        ${risk.early_signals?.length > 0 ? `
          <p><strong>Early Signals:</strong></p>
          <ul>${risk.early_signals.map((s: string) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
        ` : ''}
      </div>
    `).join('');
  };

  const renderCatalysts = (catalysts: any[]): string => {
    if (!catalysts || catalysts.length === 0) return '';
    return catalysts.map(c => `
      <div class="catalyst-item">
        <p><strong>${escapeHtml(c.event)}</strong></p>
        <p>Timeline: ${escapeHtml(c.timeline)} | ${c.controllable ? 'Controllable' : 'External'}</p>
      </div>
    `).join('');
  };

  // Check if content has parse error
  const hasParseError = content?._parse_error || content?.executive_summary?.opportunity === 'Failed to generate - see raw content';
  const rawContent = content?._raw_content;

  let bodyContent = '';
  
  if (hasParseError && rawContent) {
    // Try to parse and format the raw content
    let formattedContent = rawContent;
    try {
      const fixed = rawContent
        .replace(/:\s*(partially)\s*([,}\]])/gi, ': "partially"$2')
        .replace(/,([\s]*[}\]])/g, '$1');
      const parsed = JSON.parse(fixed);
      formattedContent = JSON.stringify(parsed, null, 2);
    } catch {}
    
    bodyContent = `
      <div class="section">
        <h2>Raw IC Memo Content</h2>
        <p class="warning">Note: Content parsing encountered issues. Raw content displayed below.</p>
        <pre>${escapeHtml(formattedContent)}</pre>
      </div>
    `;
  } else {
    bodyContent = `
      ${content?.executive_summary ? `
        <div class="section">
          <h2>Executive Summary</h2>
          ${content.executive_summary.opportunity ? `<p><strong>Opportunity:</strong> ${escapeHtml(content.executive_summary.opportunity)}</p>` : ''}
          ${content.executive_summary.why_now ? `<p><strong>Why Now:</strong> ${escapeHtml(content.executive_summary.why_now)}</p>` : ''}
          ${content.executive_summary.risk_reward_asymmetry ? `<p><strong>Risk/Reward Asymmetry:</strong> ${escapeHtml(content.executive_summary.risk_reward_asymmetry)}</p>` : ''}
          ${content.executive_summary.decision_required ? `<div class="highlight"><strong>Decision Required:</strong> ${escapeHtml(content.executive_summary.decision_required)}</div>` : ''}
        </div>
      ` : ''}

      ${content?.investment_thesis ? `
        <div class="section">
          <h2>Investment Thesis</h2>
          ${content.investment_thesis.central_thesis ? `<p><strong>Central Thesis:</strong> ${escapeHtml(content.investment_thesis.central_thesis)}</p>` : ''}
          ${content.investment_thesis.value_creation_mechanism ? `<p><strong>Value Creation Mechanism:</strong> ${escapeHtml(content.investment_thesis.value_creation_mechanism)}</p>` : ''}
          ${content.investment_thesis.sustainability ? `<p><strong>Sustainability:</strong> ${escapeHtml(content.investment_thesis.sustainability)}</p>` : ''}
          ${content.investment_thesis.structural_vs_cyclical ? `<p><strong>Structural vs Cyclical:</strong> ${escapeHtml(content.investment_thesis.structural_vs_cyclical)}</p>` : ''}
        </div>
      ` : ''}

      ${content?.business_analysis ? `
        <div class="section">
          <h2>Business Analysis</h2>
          ${content.business_analysis.how_company_makes_money ? `<p><strong>How Company Makes Money:</strong> ${escapeHtml(content.business_analysis.how_company_makes_money)}</p>` : ''}
          ${content.business_analysis.competitive_advantages?.length > 0 ? `<p><strong>Competitive Advantages:</strong></p>${renderArray(content.business_analysis.competitive_advantages)}` : ''}
          ${content.business_analysis.competitive_weaknesses?.length > 0 ? `<p><strong>Competitive Weaknesses:</strong></p>${renderArray(content.business_analysis.competitive_weaknesses)}` : ''}
          ${content.business_analysis.industry_structure ? `<p><strong>Industry Structure:</strong> ${escapeHtml(content.business_analysis.industry_structure)}</p>` : ''}
          ${content.business_analysis.competitive_dynamics ? `<p><strong>Competitive Dynamics:</strong> ${escapeHtml(content.business_analysis.competitive_dynamics)}</p>` : ''}
          ${content.business_analysis.barriers_to_entry ? `<p><strong>Barriers to Entry:</strong> ${escapeHtml(content.business_analysis.barriers_to_entry)}</p>` : ''}
          ${content.business_analysis.pricing_power ? `<p><strong>Pricing Power:</strong> ${escapeHtml(content.business_analysis.pricing_power)}</p>` : ''}
          ${content.business_analysis.disruption_risks ? `<p><strong>Disruption Risks:</strong> ${escapeHtml(content.business_analysis.disruption_risks)}</p>` : ''}
        </div>
      ` : ''}

      ${content?.financial_quality ? `
        <div class="section">
          <h2>Financial Quality</h2>
          ${content.financial_quality.revenue_quality ? `<p><strong>Revenue Quality:</strong> ${escapeHtml(content.financial_quality.revenue_quality)}</p>` : ''}
          ${content.financial_quality.margin_analysis ? `<p><strong>Margin Analysis:</strong> ${escapeHtml(content.financial_quality.margin_analysis)}</p>` : ''}
          ${content.financial_quality.capital_intensity ? `<p><strong>Capital Intensity:</strong> ${escapeHtml(content.financial_quality.capital_intensity)}</p>` : ''}
          ${content.financial_quality.return_on_capital ? `<p><strong>Return on Capital:</strong> ${escapeHtml(content.financial_quality.return_on_capital)}</p>` : ''}
          ${content.financial_quality.accounting_distortions?.length > 0 ? `<p><strong>Accounting Distortions:</strong></p>${renderArray(content.financial_quality.accounting_distortions)}` : ''}
          ${content.financial_quality.earnings_quality_risks?.length > 0 ? `<p><strong>Earnings Quality Risks:</strong></p>${renderArray(content.financial_quality.earnings_quality_risks)}` : ''}
          ${content.financial_quality.growth_capital_dynamics ? `<p><strong>Growth Capital Dynamics:</strong> ${escapeHtml(content.financial_quality.growth_capital_dynamics)}</p>` : ''}
        </div>
      ` : ''}

      ${content?.valuation ? `
        <div class="section">
          <h2>Valuation</h2>
          ${content.valuation.methodology ? `<p><strong>Methodology:</strong> ${escapeHtml(content.valuation.methodology)}</p>` : ''}
          ${content.valuation.key_assumptions?.length > 0 ? `<p><strong>Key Assumptions:</strong></p>${renderArray(content.valuation.key_assumptions)}` : ''}
          ${content.valuation.value_range ? `
            <div class="value-range">
              <div class="bear"><strong>Bear:</strong> $${content.valuation.value_range.bear?.toLocaleString() || '-'}</div>
              <div class="base"><strong>Base:</strong> $${content.valuation.value_range.base?.toLocaleString() || '-'}</div>
              <div class="bull"><strong>Bull:</strong> $${content.valuation.value_range.bull?.toLocaleString() || '-'}</div>
            </div>
          ` : ''}
          ${content.valuation.sensitivities?.length > 0 ? `<p><strong>Sensitivities:</strong></p>${renderArray(content.valuation.sensitivities)}` : ''}
          ${content.valuation.expected_return ? `<p><strong>Expected Return:</strong> ${escapeHtml(content.valuation.expected_return)}</p>` : ''}
          ${content.valuation.opportunity_cost ? `<p><strong>Opportunity Cost:</strong> ${escapeHtml(content.valuation.opportunity_cost)}</p>` : ''}
        </div>
      ` : ''}

      ${content?.risks ? `
        <div class="section">
          <h2>Risks</h2>
          ${content.risks.material_risks?.length > 0 ? `<h3>Material Risks</h3>${renderRisks(content.risks.material_risks)}` : ''}
          ${content.risks.thesis_error_risks?.length > 0 ? `<p><strong>Thesis Error Risks:</strong></p>${renderArray(content.risks.thesis_error_risks)}` : ''}
          ${content.risks.asymmetric_risks?.length > 0 ? `<p><strong>Asymmetric Risks:</strong></p>${renderArray(content.risks.asymmetric_risks)}` : ''}
        </div>
      ` : ''}

      ${content?.variant_perception ? `
        <div class="section">
          <h2>Variant Perception</h2>
          ${content.variant_perception.consensus_view ? `<p><strong>Consensus View:</strong> ${escapeHtml(content.variant_perception.consensus_view)}</p>` : ''}
          ${content.variant_perception.our_view ? `<p><strong>Our View:</strong> ${escapeHtml(content.variant_perception.our_view)}</p>` : ''}
          ${content.variant_perception.why_market_wrong ? `<p><strong>Why Market May Be Wrong:</strong> ${escapeHtml(content.variant_perception.why_market_wrong)}</p>` : ''}
          ${content.variant_perception.confirming_facts?.length > 0 ? `<p><strong>Confirming Facts:</strong></p>${renderArray(content.variant_perception.confirming_facts)}` : ''}
          ${content.variant_perception.invalidating_facts?.length > 0 ? `<p><strong>Invalidating Facts:</strong></p>${renderArray(content.variant_perception.invalidating_facts)}` : ''}
        </div>
      ` : ''}

      ${content?.catalysts ? `
        <div class="section">
          <h2>Catalysts</h2>
          ${content.catalysts.value_unlocking_events?.length > 0 ? renderCatalysts(content.catalysts.value_unlocking_events) : ''}
          ${content.catalysts.expected_horizon ? `<p><strong>Expected Horizon:</strong> ${escapeHtml(content.catalysts.expected_horizon)}</p>` : ''}
        </div>
      ` : ''}

      ${content?.portfolio_fit ? `
        <div class="section">
          <h2>Portfolio Fit</h2>
          ${content.portfolio_fit.portfolio_role ? `<p><strong>Portfolio Role:</strong> ${escapeHtml(content.portfolio_fit.portfolio_role)}</p>` : ''}
          ${content.portfolio_fit.correlation ? `<p><strong>Correlation:</strong> ${escapeHtml(content.portfolio_fit.correlation)}</p>` : ''}
          ${content.portfolio_fit.concentration_impact ? `<p><strong>Concentration Impact:</strong> ${escapeHtml(content.portfolio_fit.concentration_impact)}</p>` : ''}
          ${content.portfolio_fit.liquidity ? `<p><strong>Liquidity:</strong> ${escapeHtml(content.portfolio_fit.liquidity)}</p>` : ''}
          ${content.portfolio_fit.drawdown_impact ? `<p><strong>Drawdown Impact:</strong> ${escapeHtml(content.portfolio_fit.drawdown_impact)}</p>` : ''}
          ${content.portfolio_fit.sizing_rationale ? `<p><strong>Sizing Rationale:</strong> ${escapeHtml(content.portfolio_fit.sizing_rationale)}</p>` : ''}
          ${content.portfolio_fit.suggested_position_size ? `<div class="highlight"><strong>Suggested Position Size:</strong> ${escapeHtml(content.portfolio_fit.suggested_position_size)}</div>` : ''}
        </div>
      ` : ''}

      ${content?.decision ? `
        <div class="section">
          <h2>Decision</h2>
          ${content.decision.revisit_conditions?.length > 0 ? `<p><strong>Revisit Conditions:</strong></p>${renderArray(content.decision.revisit_conditions)}` : ''}
          ${content.decision.change_of_mind_triggers?.length > 0 ? `<p><strong>Change of Mind Triggers:</strong></p>${renderArray(content.decision.change_of_mind_triggers)}` : ''}
        </div>
      ` : ''}
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IC Memo - ${escapeHtml(ticker)}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #1a365d;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28pt;
      margin: 0 0 5px 0;
      color: #1a365d;
    }
    .header .company-name {
      font-size: 14pt;
      color: #4a5568;
      margin: 0 0 15px 0;
    }
    .header .meta {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      color: #718096;
    }
    .recommendation-banner {
      background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .recommendation-banner .recommendation {
      font-size: 24pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .recommendation-banner .conviction {
      text-align: right;
    }
    .recommendation-banner .conviction-label {
      font-size: 10pt;
      opacity: 0.8;
    }
    .recommendation-banner .conviction-value {
      font-size: 24pt;
      font-weight: bold;
    }
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 14pt;
      color: #1a365d;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .section h3 {
      font-size: 12pt;
      color: #2d3748;
      margin: 15px 0 10px 0;
    }
    .section h4 {
      font-size: 11pt;
      color: #4a5568;
      margin: 10px 0 5px 0;
    }
    .section p {
      margin: 8px 0;
    }
    .section ul {
      margin: 8px 0;
      padding-left: 20px;
    }
    .section li {
      margin: 4px 0;
    }
    .highlight {
      background: #ebf8ff;
      border-left: 4px solid #3182ce;
      padding: 12px 15px;
      margin: 15px 0;
    }
    .warning {
      background: #fffbeb;
      border-left: 4px solid #d69e2e;
      padding: 12px 15px;
      margin: 15px 0;
    }
    .value-range {
      display: flex;
      justify-content: space-between;
      margin: 15px 0;
    }
    .value-range > div {
      text-align: center;
      padding: 15px;
      border-radius: 8px;
      flex: 1;
      margin: 0 5px;
    }
    .value-range .bear {
      background: #fff5f5;
      color: #c53030;
    }
    .value-range .base {
      background: #ebf8ff;
      color: #2b6cb0;
    }
    .value-range .bull {
      background: #f0fff4;
      color: #276749;
    }
    .risk-item {
      border-left: 3px solid #e53e3e;
      padding-left: 15px;
      margin: 15px 0;
    }
    .catalyst-item {
      border-left: 3px solid #3182ce;
      padding-left: 15px;
      margin: 10px 0;
    }
    pre {
      background: #f7fafc;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 9pt;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 9pt;
      color: #718096;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(ticker)}</h1>
    <p class="company-name">${escapeHtml(companyName)} | ${escapeHtml(styleTag)}</p>
    <div class="meta">
      <span>Generated: ${formatDate(completedAt)}</span>
      <span>As of: ${formatDate(asOf)}</span>
      <span>Approved by: ${escapeHtml(approvedBy || 'System')}</span>
    </div>
  </div>

  ${recommendation ? `
    <div class="recommendation-banner">
      <div>
        <div style="font-size: 10pt; opacity: 0.8;">RECOMMENDATION</div>
        <div class="recommendation">${escapeHtml(recommendation.replace(/_/g, ' '))}</div>
      </div>
      ${conviction !== null ? `
        <div class="conviction">
          <div class="conviction-label">CONVICTION</div>
          <div class="conviction-value">${conviction}</div>
        </div>
      ` : ''}
    </div>
  ` : ''}

  ${bodyContent}

  <div class="footer">
    <span>ARC Investment Factory - IC Memo</span>
    <span>Confidential - For Internal Use Only</span>
  </div>
</body>
</html>
  `;
}

// DELETE /api/ic-memos/:memoId - Delete IC Memo (for failed/cancelled)
icMemosRouter.delete('/:memoId', async (req: Request, res: Response) => {
  try {
    const memo = await icMemosRepository.getById(req.params.memoId);
    
    if (!memo) {
      return res.status(404).json({ error: 'IC Memo not found' });
    }

    if (memo.status === 'generating') {
      return res.status(400).json({ 
        error: 'Cannot delete IC Memo while generation is in progress',
      });
    }

    await icMemosRepository.delete(memo.memoId);

    res.json({
      success: true,
      message: 'IC Memo deleted',
    });
  } catch (error) {
    console.error('Error deleting IC memo:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default icMemosRouter;
