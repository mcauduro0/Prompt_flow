'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Memory Search Page
 * 
 * Search and browse the system's memory of all ideas:
 * - Rejection shadows (why ideas were rejected)
 * - Reappearance deltas (what changed since last time)
 * - Historical idea tracking
 * - Novelty state visualization
 */

// Types
interface MemoryRecord {
  id: string;
  ticker: string;
  company_name: string;
  
  // Appearance history
  first_seen: string;
  last_seen: string;
  total_appearances: number;
  
  // Current status
  current_status: 'active' | 'rejected' | 'promoted' | 'expired';
  
  // Novelty
  novelty_status: 'new' | 'reappearance' | 'repeat';
  days_since_last_seen: number;
  
  // Rejection shadow (if rejected)
  rejection_shadow?: {
    rejected_at: string;
    rejection_reason: string;
    rejected_by: string;
    times_rejected: number;
  };
  
  // Reappearance delta (what's new)
  reappearance_delta?: {
    new_catalysts: string[];
    price_change_pct: number;
    new_filings: string[];
    thesis_changes: string[];
    score_change: number;
  };
  
  // Latest scores
  latest_score: number;
  score_history: Array<{ date: string; score: number }>;
  
  // Style tags seen
  style_tags_seen: string[];
}

interface SearchFilters {
  query: string;
  status: 'all' | 'active' | 'rejected' | 'promoted' | 'expired';
  novelty: 'all' | 'new' | 'reappearance' | 'repeat';
  hasRejectionShadow: boolean;
  hasReappearanceDelta: boolean;
  dateFrom: string;
  dateTo: string;
}

// Mock data
const mockMemoryRecords: MemoryRecord[] = [
  {
    id: 'mem_001',
    ticker: 'AAPL',
    company_name: 'Apple Inc.',
    first_seen: '2023-06-15T06:00:00Z',
    last_seen: '2024-01-15T06:00:00Z',
    total_appearances: 8,
    current_status: 'active',
    novelty_status: 'reappearance',
    days_since_last_seen: 45,
    rejection_shadow: {
      rejected_at: '2023-11-15T14:30:00Z',
      rejection_reason: 'Valuation too stretched at 28x forward P/E',
      rejected_by: 'user@example.com',
      times_rejected: 2,
    },
    reappearance_delta: {
      new_catalysts: ['Q1 2024 Earnings beat', 'AI features announced at WWDC'],
      price_change_pct: -8.5,
      new_filings: ['10-K 2024', '8-K Feb 2024'],
      thesis_changes: ['Services growth accelerated from 11% to 14% YoY'],
      score_change: 12.3,
    },
    latest_score: 78.5,
    score_history: [
      { date: '2023-06-15', score: 65.2 },
      { date: '2023-09-10', score: 68.4 },
      { date: '2023-11-15', score: 66.2 },
      { date: '2024-01-15', score: 78.5 },
    ],
    style_tags_seen: ['quality_compounder', 'growth_at_reasonable_price'],
  },
  {
    id: 'mem_002',
    ticker: 'NVDA',
    company_name: 'NVIDIA Corporation',
    first_seen: '2023-03-01T06:00:00Z',
    last_seen: '2024-01-15T06:00:00Z',
    total_appearances: 15,
    current_status: 'promoted',
    novelty_status: 'repeat',
    days_since_last_seen: 7,
    latest_score: 92.1,
    score_history: [
      { date: '2023-03-01', score: 75.0 },
      { date: '2023-06-15', score: 88.2 },
      { date: '2023-09-10', score: 90.5 },
      { date: '2024-01-15', score: 92.1 },
    ],
    style_tags_seen: ['momentum', 'growth_at_reasonable_price'],
  },
  {
    id: 'mem_003',
    ticker: 'META',
    company_name: 'Meta Platforms Inc.',
    first_seen: '2022-11-01T06:00:00Z',
    last_seen: '2024-01-10T06:00:00Z',
    total_appearances: 12,
    current_status: 'rejected',
    novelty_status: 'reappearance',
    days_since_last_seen: 30,
    rejection_shadow: {
      rejected_at: '2024-01-10T14:30:00Z',
      rejection_reason: 'Metaverse capex concerns remain unresolved',
      rejected_by: 'user@example.com',
      times_rejected: 3,
    },
    reappearance_delta: {
      new_catalysts: ['Reality Labs losses narrowing'],
      price_change_pct: 15.2,
      new_filings: ['10-Q Q3 2023'],
      thesis_changes: ['Ad revenue recovery stronger than expected'],
      score_change: 8.7,
    },
    latest_score: 71.3,
    score_history: [
      { date: '2022-11-01', score: 45.2 },
      { date: '2023-03-15', score: 58.4 },
      { date: '2023-09-10', score: 62.6 },
      { date: '2024-01-10', score: 71.3 },
    ],
    style_tags_seen: ['deep_value', 'turnaround', 'quality_compounder'],
  },
  {
    id: 'mem_004',
    ticker: 'TSLA',
    company_name: 'Tesla Inc.',
    first_seen: '2023-01-15T06:00:00Z',
    last_seen: '2023-12-01T06:00:00Z',
    total_appearances: 6,
    current_status: 'expired',
    novelty_status: 'new',
    days_since_last_seen: 90,
    rejection_shadow: {
      rejected_at: '2023-12-01T14:30:00Z',
      rejection_reason: 'Margin compression from price cuts, demand concerns',
      rejected_by: 'user@example.com',
      times_rejected: 4,
    },
    latest_score: 52.1,
    score_history: [
      { date: '2023-01-15', score: 68.2 },
      { date: '2023-06-15', score: 61.4 },
      { date: '2023-09-10', score: 55.6 },
      { date: '2023-12-01', score: 52.1 },
    ],
    style_tags_seen: ['momentum', 'growth_at_reasonable_price'],
  },
];

export default function MemorySearchPage() {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MemoryRecord | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    status: 'all',
    novelty: 'all',
    hasRejectionShadow: false,
    hasReappearanceDelta: false,
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    // In production, fetch from API
    setRecords(mockMemoryRecords);
    setFilteredRecords(mockMemoryRecords);
    setLoading(false);
  }, []);

  useEffect(() => {
    let filtered = [...records];

    // Query filter
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.ticker.toLowerCase().includes(query) ||
          r.company_name.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((r) => r.current_status === filters.status);
    }

    // Novelty filter
    if (filters.novelty !== 'all') {
      filtered = filtered.filter((r) => r.novelty_status === filters.novelty);
    }

    // Rejection shadow filter
    if (filters.hasRejectionShadow) {
      filtered = filtered.filter((r) => r.rejection_shadow);
    }

    // Reappearance delta filter
    if (filters.hasReappearanceDelta) {
      filtered = filtered.filter((r) => r.reappearance_delta);
    }

    setFilteredRecords(filtered);
  }, [filters, records]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'promoted':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getNoveltyColor = (novelty: string) => {
    switch (novelty) {
      case 'new':
        return 'bg-purple-100 text-purple-800';
      case 'reappearance':
        return 'bg-orange-100 text-orange-800';
      case 'repeat':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Memory Search</h1>
      <p className="text-gray-600 mb-6">
        Search and browse the system's memory of all ideas, including rejection shadows and reappearance deltas.
      </p>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              placeholder="Ticker or company name..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="rejected">Rejected</option>
              <option value="promoted">Promoted</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Novelty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Novelty</label>
            <select
              value={filters.novelty}
              onChange={(e) => setFilters({ ...filters, novelty: e.target.value as any })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="new">New (90+ days)</option>
              <option value="reappearance">Reappearance</option>
              <option value="repeat">Repeat (&lt;30 days)</option>
            </select>
          </div>

          {/* Checkboxes */}
          <div className="col-span-2 flex items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasRejectionShadow}
                onChange={(e) => setFilters({ ...filters, hasRejectionShadow: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Has Rejection Shadow</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasReappearanceDelta}
                onChange={(e) => setFilters({ ...filters, hasReappearanceDelta: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Has Reappearance Delta</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold">Results ({filteredRecords.length})</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedRecord?.id === record.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{record.ticker}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(record.current_status)}`}>
                          {record.current_status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getNoveltyColor(record.novelty_status)}`}>
                          {record.novelty_status}
                        </span>
                        {record.rejection_shadow && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            ⚠️ Rejected {record.rejection_shadow.times_rejected}x
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{record.company_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{record.latest_score.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">{record.total_appearances} appearances</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>First: {new Date(record.first_seen).toLocaleDateString()}</span>
                    <span>Last: {new Date(record.last_seen).toLocaleDateString()}</span>
                    <span>{record.days_since_last_seen} days ago</span>
                  </div>
                </div>
              ))}
              {filteredRecords.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No records found matching your filters.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedRecord ? (
            <div className="bg-white rounded-lg shadow sticky top-6">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{selectedRecord.ticker} Details</h2>
                  <Link
                    href={`/ideas/${selectedRecord.id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View Full →
                  </Link>
                </div>
              </div>
              <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Rejection Shadow */}
                {selectedRecord.rejection_shadow && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h3 className="font-semibold text-amber-800 text-sm mb-2">⚠️ Rejection Shadow</h3>
                    <div className="text-sm space-y-1">
                      <p><strong>Times Rejected:</strong> {selectedRecord.rejection_shadow.times_rejected}</p>
                      <p><strong>Last Rejection:</strong> {new Date(selectedRecord.rejection_shadow.rejected_at).toLocaleDateString()}</p>
                      <p><strong>Reason:</strong> {selectedRecord.rejection_shadow.rejection_reason}</p>
                      <p><strong>By:</strong> {selectedRecord.rejection_shadow.rejected_by}</p>
                    </div>
                  </div>
                )}

                {/* Reappearance Delta */}
                {selectedRecord.reappearance_delta && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h3 className="font-semibold text-blue-800 text-sm mb-2">🔄 What's New</h3>
                    <div className="text-sm space-y-2">
                      <div>
                        <strong>Score Change:</strong>{' '}
                        <span className={selectedRecord.reappearance_delta.score_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {selectedRecord.reappearance_delta.score_change >= 0 ? '+' : ''}
                          {selectedRecord.reappearance_delta.score_change.toFixed(1)}
                        </span>
                      </div>
                      <div>
                        <strong>Price Change:</strong>{' '}
                        <span className={selectedRecord.reappearance_delta.price_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {selectedRecord.reappearance_delta.price_change_pct >= 0 ? '+' : ''}
                          {selectedRecord.reappearance_delta.price_change_pct.toFixed(1)}%
                        </span>
                      </div>
                      {selectedRecord.reappearance_delta.new_catalysts.length > 0 && (
                        <div>
                          <strong>New Catalysts:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {selectedRecord.reappearance_delta.new_catalysts.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedRecord.reappearance_delta.thesis_changes.length > 0 && (
                        <div>
                          <strong>Thesis Changes:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {selectedRecord.reappearance_delta.thesis_changes.map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedRecord.reappearance_delta.new_filings.length > 0 && (
                        <div>
                          <strong>New Filings:</strong> {selectedRecord.reappearance_delta.new_filings.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Score History */}
                <div>
                  <h3 className="font-semibold text-sm mb-2">Score History</h3>
                  <div className="space-y-1">
                    {selectedRecord.score_history.map((h, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">{new Date(h.date).toLocaleDateString()}</span>
                        <span className="font-medium">{h.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Style Tags */}
                <div>
                  <h3 className="font-semibold text-sm mb-2">Style Tags Seen</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedRecord.style_tags_seen.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Metadata */}
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                  <p>First seen: {new Date(selectedRecord.first_seen).toLocaleString()}</p>
                  <p>Last seen: {new Date(selectedRecord.last_seen).toLocaleString()}</p>
                  <p>Total appearances: {selectedRecord.total_appearances}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a record to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
