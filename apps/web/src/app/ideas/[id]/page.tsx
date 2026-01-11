'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Idea Detail Page
 * 
 * Shows full evidence for an idea with action buttons:
 * - Promote to Lane B
 * - Reject (with reason)
 * - Add to Watchlist
 * - Request More Research
 */

// Types
interface Evidence {
  id: string;
  source_type: 'filing' | 'transcript' | 'investor_deck' | 'news' | 'dataset';
  doc_id: string;
  chunk_id?: string;
  source_url?: string;
  snippet: string;
  claim_type: 'numeric' | 'qualitative';
  confidence: number;
  extracted_at: string;
}

interface GateResult {
  gate_id: number;
  gate_name: string;
  passed: boolean;
  score?: number;
  threshold?: number;
  details?: string;
}

interface IdeaDetail {
  id: string;
  ticker: string;
  company_name: string;
  style_tag: string;
  status: 'inbox' | 'promoted' | 'rejected' | 'watchlist';
  
  // Hypothesis
  hypothesis: string;
  edge_claim: string;
  
  // Scores
  total_score: number;
  edge_clarity: number;
  downside_protection: number;
  catalyst_clarity: number;
  
  // Gate results
  gates: GateResult[];
  
  // Evidence
  evidence: Evidence[];
  
  // Novelty
  novelty_status: 'new' | 'reappearance' | 'repeat';
  days_since_last_seen?: number;
  whats_new_since_last_time?: string;
  
  // Rejection shadow (if previously rejected)
  rejection_shadow?: {
    rejected_at: string;
    rejection_reason: string;
    rejected_by: string;
  };
  
  // Catalysts
  catalysts: Array<{
    name: string;
    expected_window: string;
    probability: number;
  }>;
  
  // Metadata
  created_at: string;
  updated_at: string;
  source_run_id: string;
}

// Mock data for demonstration
const mockIdea: IdeaDetail = {
  id: 'idea_001',
  ticker: 'AAPL',
  company_name: 'Apple Inc.',
  style_tag: 'quality_compounder',
  status: 'inbox',
  hypothesis: 'Apple\'s Services segment will drive margin expansion as it grows from 22% to 30% of revenue by 2026, while the installed base continues to grow at 5% annually.',
  edge_claim: 'Market underestimates the durability of Services growth and the margin accretion from the shift in revenue mix.',
  total_score: 78.5,
  edge_clarity: 4.2,
  downside_protection: 3.8,
  catalyst_clarity: 4.0,
  gates: [
    { gate_id: 0, gate_name: 'Data Sufficiency', passed: true, score: 0.95, threshold: 0.7, details: 'All required data sources available' },
    { gate_id: 1, gate_name: 'Coherence', passed: true, score: 0.88, threshold: 0.6, details: 'Hypothesis is internally consistent' },
    { gate_id: 2, gate_name: 'Edge Claim', passed: true, score: 4.2, threshold: 3.0, details: 'Clear variant perception identified' },
    { gate_id: 3, gate_name: 'Downside Shape', passed: true, score: 3.8, threshold: 3.0, details: 'Acceptable downside risk profile' },
    { gate_id: 4, gate_name: 'Style Fit', passed: true, score: 0.92, threshold: 0.7, details: 'Matches quality_compounder criteria' },
  ],
  evidence: [
    {
      id: 'ev_001',
      source_type: 'filing',
      doc_id: 'sec_10k_AAPL_20240101',
      chunk_id: 'section_7_mda_p12',
      source_url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193',
      snippet: 'Services revenue grew 14% year-over-year to $85.2 billion, representing 22.2% of total revenue.',
      claim_type: 'numeric',
      confidence: 0.98,
      extracted_at: '2024-01-15T10:30:00Z',
    },
    {
      id: 'ev_002',
      source_type: 'transcript',
      doc_id: 'transcript_AAPL_2024Q1',
      chunk_id: 'qa_section_p5',
      snippet: 'We continue to see strong growth in our installed base, which now exceeds 2.2 billion active devices globally.',
      claim_type: 'numeric',
      confidence: 0.95,
      extracted_at: '2024-01-15T10:30:00Z',
    },
    {
      id: 'ev_003',
      source_type: 'dataset',
      doc_id: 'fmp_financials_AAPL',
      snippet: 'Gross margin for Services segment: 72.3% vs. Products: 36.5%',
      claim_type: 'numeric',
      confidence: 0.99,
      extracted_at: '2024-01-15T10:30:00Z',
    },
  ],
  novelty_status: 'reappearance',
  days_since_last_seen: 45,
  whats_new_since_last_time: 'Q1 2024 earnings showed Services growth accelerating from 11% to 14% YoY. New AI features announced at WWDC could drive upgrade cycle.',
  rejection_shadow: {
    rejected_at: '2023-11-15T14:30:00Z',
    rejection_reason: 'Valuation too stretched at 28x forward P/E',
    rejected_by: 'user@example.com',
  },
  catalysts: [
    { name: 'Q2 2024 Earnings', expected_window: '2024-04-25 to 2024-05-01', probability: 0.95 },
    { name: 'WWDC 2024', expected_window: '2024-06-10 to 2024-06-14', probability: 0.90 },
    { name: 'iPhone 16 Launch', expected_window: '2024-09-01 to 2024-09-15', probability: 0.85 },
  ],
  created_at: '2024-01-15T06:00:00Z',
  updated_at: '2024-01-15T06:00:00Z',
  source_run_id: 'run_20240115_060000',
};

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    // In production, fetch from API
    // const response = await fetch(`/api/ideas/${params.id}`);
    setIdea(mockIdea);
    setLoading(false);
  }, [params.id]);

  const handlePromote = async () => {
    setActionLoading('promote');
    try {
      // await fetch(`/api/ideas/${params.id}/promote`, { method: 'POST' });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push('/queue');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading('reject');
    try {
      // await fetch(`/api/ideas/${params.id}/reject`, {
      //   method: 'POST',
      //   body: JSON.stringify({ reason: rejectReason }),
      // });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowRejectModal(false);
      router.push('/inbox');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWatchlist = async () => {
    setActionLoading('watchlist');
    try {
      // await fetch(`/api/ideas/${params.id}/watchlist`, { method: 'POST' });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Added to watchlist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestResearch = async () => {
    setActionLoading('research');
    try {
      // await fetch(`/api/ideas/${params.id}/request-research`, { method: 'POST' });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Research request submitted');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">Idea not found</h1>
        <Link href="/inbox" className="text-blue-600 hover:underline mt-4 block">
          Back to Inbox
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{idea.ticker}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              idea.status === 'inbox' ? 'bg-yellow-100 text-yellow-800' :
              idea.status === 'promoted' ? 'bg-green-100 text-green-800' :
              idea.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {idea.status.toUpperCase()}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
              {idea.style_tag.replace(/_/g, ' ')}
            </span>
          </div>
          <h2 className="text-xl text-gray-600 mt-1">{idea.company_name}</h2>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handlePromote}
            disabled={actionLoading !== null || idea.status !== 'inbox'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {actionLoading === 'promote' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              '✓'
            )}
            Promote to Lane B
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={actionLoading !== null || idea.status !== 'inbox'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            ✗ Reject
          </button>
          <button
            onClick={handleWatchlist}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {actionLoading === 'watchlist' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              '👁'
            )}
            Watchlist
          </button>
          <button
            onClick={handleRequestResearch}
            disabled={actionLoading !== null}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {actionLoading === 'research' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              '🔍'
            )}
            Request Research
          </button>
        </div>
      </div>

      {/* Rejection Shadow Warning */}
      {idea.rejection_shadow && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2">
            ⚠️ Previously Rejected
          </h3>
          <p className="text-amber-700 mt-1">
            <strong>Date:</strong> {new Date(idea.rejection_shadow.rejected_at).toLocaleDateString()}
          </p>
          <p className="text-amber-700">
            <strong>Reason:</strong> {idea.rejection_shadow.rejection_reason}
          </p>
          <p className="text-amber-700">
            <strong>By:</strong> {idea.rejection_shadow.rejected_by}
          </p>
        </div>
      )}

      {/* Novelty Status */}
      {idea.novelty_status !== 'new' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2">
            🔄 Reappearance ({idea.days_since_last_seen} days since last seen)
          </h3>
          {idea.whats_new_since_last_time && (
            <div className="mt-2">
              <strong className="text-blue-800">What's New:</strong>
              <p className="text-blue-700 mt-1">{idea.whats_new_since_last_time}</p>
            </div>
          )}
        </div>
      )}

      {/* Score Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Score Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{idea.total_score.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Total Score</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{idea.edge_clarity.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Edge Clarity</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">{idea.downside_protection.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Downside Protection</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-orange-600">{idea.catalyst_clarity.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Catalyst Clarity</div>
          </div>
        </div>
      </div>

      {/* Hypothesis & Edge */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Investment Thesis</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-700">Hypothesis</h4>
            <p className="text-gray-900 mt-1">{idea.hypothesis}</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-700">Edge Claim (Variant Perception)</h4>
            <p className="text-gray-900 mt-1">{idea.edge_claim}</p>
          </div>
        </div>
      </div>

      {/* Gate Results */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Gate Results</h3>
        <div className="space-y-3">
          {idea.gates.map((gate) => (
            <div key={gate.gate_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  gate.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {gate.passed ? '✓' : '✗'}
                </span>
                <div>
                  <div className="font-medium">Gate {gate.gate_id}: {gate.gate_name}</div>
                  <div className="text-sm text-gray-600">{gate.details}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{gate.score?.toFixed(2)}</div>
                <div className="text-sm text-gray-500">Threshold: {gate.threshold}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Evidence ({idea.evidence.length} items)</h3>
        <div className="space-y-4">
          {idea.evidence.map((ev) => (
            <div key={ev.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    ev.source_type === 'filing' ? 'bg-blue-100 text-blue-800' :
                    ev.source_type === 'transcript' ? 'bg-green-100 text-green-800' :
                    ev.source_type === 'dataset' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ev.source_type.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    ev.claim_type === 'numeric' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {ev.claim_type}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Confidence: {(ev.confidence * 100).toFixed(0)}%
                </div>
              </div>
              <p className="mt-2 text-gray-900">{ev.snippet}</p>
              <div className="mt-2 text-sm text-gray-500 flex items-center gap-4">
                <span>Doc: {ev.doc_id}</span>
                {ev.chunk_id && <span>Chunk: {ev.chunk_id}</span>}
                {ev.source_url && (
                  <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    View Source →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Catalysts */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Catalysts</h3>
        <div className="space-y-3">
          {idea.catalysts.map((catalyst, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">{catalyst.name}</div>
                <div className="text-sm text-gray-600">{catalyst.expected_window}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{(catalyst.probability * 100).toFixed(0)}%</div>
                <div className="text-sm text-gray-500">Probability</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Created: {new Date(idea.created_at).toLocaleString()}</span>
          <span>Run ID: {idea.source_run_id}</span>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject Idea</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this idea. This will be stored as a rejection shadow for future reference.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full border border-gray-300 rounded-lg p-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === 'reject'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
