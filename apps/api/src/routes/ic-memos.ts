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
    const { maxMemos, memoIds, dryRun } = req.body;

    // This endpoint triggers the Lane C runner
    // The actual processing happens in the worker
    // For now, we'll return the pending memos that would be processed
    
    const pendingMemos = await icMemosRepository.getPending(maxMemos || 5);
    
    if (pendingMemos.length === 0) {
      return res.json({
        success: true,
        message: 'No pending IC Memos to process',
        pending_count: 0,
      });
    }

    res.json({
      success: true,
      message: `Lane C run triggered for ${pendingMemos.length} pending IC Memos`,
      pending_count: pendingMemos.length,
      memos: pendingMemos.map(m => ({
        memo_id: m.memoId,
        ticker: m.ticker,
        status: m.status,
      })),
      note: 'The worker will process these memos. Check /api/ic-memos for status updates.',
    });
  } catch (error) {
    console.error('Error triggering Lane C run:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

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
