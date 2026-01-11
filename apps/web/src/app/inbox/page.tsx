'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ThumbsUp,
  ThumbsDown,
  Eye,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Screen 1: Inbox (Lane A Output)
 * 
 * Shows today's ideas from daily_discovery_run with:
 * - Promote button (→ Lane B queue)
 * - Reject button (with reason)
 * - View details
 */

interface IdeaCard {
  idea_id: string;
  ticker: string;
  company_name: string;
  style_tag: string;
  one_sentence_hypothesis: string;
  edge_clarity: number;
  downside_protection: number;
  total_score: number;
  catalysts: Array<{ name: string; window: string }>;
  status: 'new' | 'promoted' | 'rejected' | 'watching';
  created_at: string;
  novelty_score?: number;
  is_new_to_universe?: boolean;
  what_is_new_since_last_time?: string;
}

// Mock data for development
const MOCK_IDEAS: IdeaCard[] = [
  {
    idea_id: '1',
    ticker: 'NVDA',
    company_name: 'NVIDIA Corporation',
    style_tag: 'quality',
    one_sentence_hypothesis: 'AI infrastructure demand continues to accelerate with enterprise adoption',
    edge_clarity: 0.85,
    downside_protection: 0.72,
    total_score: 8.5,
    catalysts: [
      { name: 'Q4 Earnings', window: '2024-02-21' },
      { name: 'GTC Conference', window: '2024-03-18' },
    ],
    status: 'new',
    created_at: new Date().toISOString(),
    novelty_score: 0.95,
    is_new_to_universe: true,
  },
  {
    idea_id: '2',
    ticker: 'META',
    company_name: 'Meta Platforms Inc',
    style_tag: 'growth',
    one_sentence_hypothesis: 'Reels monetization and AI investments driving revenue reacceleration',
    edge_clarity: 0.78,
    downside_protection: 0.68,
    total_score: 7.8,
    catalysts: [
      { name: 'Q4 Earnings', window: '2024-02-01' },
    ],
    status: 'new',
    created_at: new Date().toISOString(),
    novelty_score: 0.82,
    is_new_to_universe: false,
    what_is_new_since_last_time: 'New Llama 3 release and Reality Labs cost cuts',
  },
];

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Fetch ideas
  const { data: ideas, isLoading, refetch } = useQuery({
    queryKey: ['inbox-ideas'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return MOCK_IDEAS;
    },
  });

  // Promote mutation
  const promoteMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      // TODO: Replace with actual API call
      console.log('Promoting idea:', ideaId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-ideas'] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ ideaId, reason }: { ideaId: string; reason: string }) => {
      // TODO: Replace with actual API call
      console.log('Rejecting idea:', ideaId, 'Reason:', reason);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-ideas'] });
      setRejectingId(null);
      setRejectReason('');
    },
  });

  const filteredIdeas = ideas?.filter(
    (idea) => filterStyle === 'all' || idea.style_tag === filterStyle
  );

  const getStyleColor = (style: string) => {
    const colors: Record<string, string> = {
      quality: 'bg-purple-100 text-purple-800',
      value: 'bg-indigo-100 text-indigo-800',
      growth: 'bg-emerald-100 text-emerald-800',
      special: 'bg-orange-100 text-orange-800',
      turnaround: 'bg-amber-100 text-amber-800',
    };
    return colors[style] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-600">Lane A output - Today's investment ideas</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Style Filter */}
          <select
            value={filterStyle}
            onChange={(e) => setFilterStyle(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Styles</option>
            <option value="quality">Quality</option>
            <option value="value">Value</option>
            <option value="growth">Growth</option>
            <option value="special">Special Situations</option>
            <option value="turnaround">Turnaround</option>
          </select>
          
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{ideas?.length || 0}</div>
          <div className="text-sm text-gray-600">Total Ideas</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {ideas?.filter((i) => i.status === 'new').length || 0}
          </div>
          <div className="text-sm text-gray-600">New</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {ideas?.filter((i) => i.status === 'promoted').length || 0}
          </div>
          <div className="text-sm text-gray-600">Promoted</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">
            {ideas?.filter((i) => i.status === 'rejected').length || 0}
          </div>
          <div className="text-sm text-gray-600">Rejected</div>
        </div>
      </div>

      {/* Ideas List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600">Loading ideas...</div>
      ) : filteredIdeas?.length === 0 ? (
        <div className="text-center py-12 text-gray-600">No ideas found</div>
      ) : (
        <div className="space-y-4">
          {filteredIdeas?.map((idea) => (
            <div
              key={idea.idea_id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Main Row */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Ticker & Name */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-lg text-gray-900">
                        {idea.ticker}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStyleColor(idea.style_tag))}>
                        {idea.style_tag}
                      </span>
                      {idea.is_new_to_universe && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{idea.company_name}</div>
                  </div>
                </div>

                {/* Scores */}
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {idea.total_score.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {(idea.edge_clarity * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">Edge</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {(idea.downside_protection * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">Downside</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {/* Promote Button */}
                  <button
                    onClick={() => promoteMutation.mutate(idea.idea_id)}
                    disabled={idea.status !== 'new' || promoteMutation.isPending}
                    className={cn(
                      'flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      idea.status === 'new'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span>Promote</span>
                  </button>

                  {/* Reject Button */}
                  <button
                    onClick={() => setRejectingId(idea.idea_id)}
                    disabled={idea.status !== 'new'}
                    className={cn(
                      'flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      idea.status === 'new'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    <span>Reject</span>
                  </button>

                  {/* Expand/Collapse */}
                  <button
                    onClick={() => setExpandedId(expandedId === idea.idea_id ? null : idea.idea_id)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    {expandedId === idea.idea_id ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Reject Reason Input */}
              {rejectingId === idea.idea_id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <button
                      onClick={() => rejectMutation.mutate({ ideaId: idea.idea_id, reason: rejectReason })}
                      disabled={!rejectReason || rejectMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:bg-gray-300"
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {expandedId === idea.idea_id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-4 space-y-4">
                    {/* Hypothesis */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Hypothesis</div>
                      <div className="text-gray-900">{idea.one_sentence_hypothesis}</div>
                    </div>

                    {/* What's New */}
                    {idea.what_is_new_since_last_time && (
                      <div>
                        <div className="text-sm font-medium text-gray-700 mb-1">What's New</div>
                        <div className="text-gray-900">{idea.what_is_new_since_last_time}</div>
                      </div>
                    )}

                    {/* Catalysts */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Catalysts</div>
                      <div className="flex flex-wrap gap-2">
                        {idea.catalysts.map((catalyst, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700"
                          >
                            {catalyst.name} ({catalyst.window})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
