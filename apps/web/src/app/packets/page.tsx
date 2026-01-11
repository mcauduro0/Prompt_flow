'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Screen 3: Packets (Lane B Output)
 * 
 * Shows completed research packets with:
 * - All 7 research modules
 * - Bull/Base/Bear scenarios
 * - Decision brief
 * - Version history (immutable)
 */

interface ResearchPacket {
  packet_id: string;
  idea_id: string;
  ticker: string;
  company_name: string;
  style_tag: string;
  version: number;
  status: 'draft' | 'complete' | 'archived';
  created_at: string;
  modules_completed: string[];
  bull_base_bear?: {
    bull: { probability: number; target_price: number; description: string };
    base: { probability: number; target_price: number; description: string };
    bear: { probability: number; target_price: number; description: string };
  };
  decision_brief?: {
    verdict: string;
    thesis_summary: string;
    conviction: number;
  };
}

// Mock data
const MOCK_PACKETS: ResearchPacket[] = [
  {
    packet_id: 'p1',
    idea_id: '1',
    ticker: 'AAPL',
    company_name: 'Apple Inc',
    style_tag: 'quality',
    version: 2,
    status: 'complete',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    modules_completed: [
      'business_model',
      'industry_moat',
      'financial_forensics',
      'capital_allocation',
      'management_quality',
      'valuation',
      'risk_stress',
    ],
    bull_base_bear: {
      bull: { probability: 0.25, target_price: 220, description: 'Services growth accelerates, Vision Pro succeeds' },
      base: { probability: 0.55, target_price: 190, description: 'Steady iPhone replacement cycle, services growth' },
      bear: { probability: 0.20, target_price: 150, description: 'China weakness, regulatory headwinds' },
    },
    decision_brief: {
      verdict: 'buy',
      thesis_summary: 'Quality compounder with strong ecosystem moat and improving services mix',
      conviction: 4,
    },
  },
  {
    packet_id: 'p2',
    idea_id: '2',
    ticker: 'GOOGL',
    company_name: 'Alphabet Inc',
    style_tag: 'quality',
    version: 1,
    status: 'complete',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    modules_completed: [
      'business_model',
      'industry_moat',
      'financial_forensics',
      'capital_allocation',
      'management_quality',
      'valuation',
      'risk_stress',
    ],
    bull_base_bear: {
      bull: { probability: 0.30, target_price: 180, description: 'AI leadership, Cloud acceleration' },
      base: { probability: 0.50, target_price: 155, description: 'Search resilience, steady Cloud growth' },
      bear: { probability: 0.20, target_price: 120, description: 'AI disruption to Search, antitrust' },
    },
    decision_brief: {
      verdict: 'buy',
      thesis_summary: 'Undervalued AI leader with dominant Search franchise and growing Cloud business',
      conviction: 4,
    },
  },
];

const MODULES = [
  { id: 'business_model', name: 'Business Model' },
  { id: 'industry_moat', name: 'Industry & Moat' },
  { id: 'financial_forensics', name: 'Financial Forensics' },
  { id: 'capital_allocation', name: 'Capital Allocation' },
  { id: 'management_quality', name: 'Management Quality' },
  { id: 'valuation', name: 'Valuation' },
  { id: 'risk_stress', name: 'Risk & Stress' },
];

export default function PacketsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: packets, isLoading } = useQuery({
    queryKey: ['research-packets'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return MOCK_PACKETS;
    },
  });

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'strong_buy':
        return 'bg-green-600 text-white';
      case 'buy':
        return 'bg-green-100 text-green-800';
      case 'hold':
        return 'bg-yellow-100 text-yellow-800';
      case 'sell':
        return 'bg-red-100 text-red-800';
      case 'strong_sell':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Research Packets</h1>
        <p className="text-gray-600">Lane B output - Completed deep research</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{packets?.length || 0}</div>
          <div className="text-sm text-gray-600">Total Packets</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {packets?.filter((p) => p.status === 'complete').length || 0}
          </div>
          <div className="text-sm text-gray-600">Complete</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {packets?.filter((p) => p.decision_brief?.verdict === 'buy' || p.decision_brief?.verdict === 'strong_buy').length || 0}
          </div>
          <div className="text-sm text-gray-600">Buy Rated</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">
            {packets?.reduce((sum, p) => sum + p.version, 0) || 0}
          </div>
          <div className="text-sm text-gray-600">Total Versions</div>
        </div>
      </div>

      {/* Packets List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600">Loading packets...</div>
      ) : packets?.length === 0 ? (
        <div className="text-center py-12 text-gray-600">No packets found</div>
      ) : (
        <div className="space-y-4">
          {packets?.map((packet) => (
            <div
              key={packet.packet_id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Header Row */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-lg text-gray-900">{packet.ticker}</span>
                      <span className="text-sm text-gray-500">v{packet.version}</span>
                      {packet.decision_brief && (
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getVerdictColor(packet.decision_brief.verdict))}>
                          {packet.decision_brief.verdict.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{packet.company_name}</div>
                  </div>
                </div>

                {/* Modules Progress */}
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {packet.modules_completed.length}/7
                    </div>
                    <div className="text-xs text-gray-500">Modules</div>
                  </div>
                  {packet.decision_brief && (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {packet.decision_brief.conviction}/5
                      </div>
                      <div className="text-xs text-gray-500">Conviction</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Link
                    href={`/packets/${packet.packet_id}`}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>View Full</span>
                  </Link>
                  <button
                    onClick={() => setExpandedId(expandedId === packet.packet_id ? null : packet.packet_id)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    {expandedId === packet.packet_id ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === packet.packet_id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {/* Thesis Summary */}
                  {packet.decision_brief && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">Thesis Summary</div>
                      <div className="text-gray-900">{packet.decision_brief.thesis_summary}</div>
                    </div>
                  )}

                  {/* Bull/Base/Bear */}
                  {packet.bull_base_bear && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Scenarios</div>
                      <div className="grid grid-cols-3 gap-4">
                        {/* Bull */}
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-800">Bull ({(packet.bull_base_bear.bull.probability * 100).toFixed(0)}%)</span>
                          </div>
                          <div className="text-lg font-bold text-green-900">${packet.bull_base_bear.bull.target_price}</div>
                          <div className="text-sm text-green-700 mt-1">{packet.bull_base_bear.bull.description}</div>
                        </div>
                        {/* Base */}
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <Minus className="h-4 w-4 text-gray-600" />
                            <span className="font-medium text-gray-800">Base ({(packet.bull_base_bear.base.probability * 100).toFixed(0)}%)</span>
                          </div>
                          <div className="text-lg font-bold text-gray-900">${packet.bull_base_bear.base.target_price}</div>
                          <div className="text-sm text-gray-700 mt-1">{packet.bull_base_bear.base.description}</div>
                        </div>
                        {/* Bear */}
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="font-medium text-red-800">Bear ({(packet.bull_base_bear.bear.probability * 100).toFixed(0)}%)</span>
                          </div>
                          <div className="text-lg font-bold text-red-900">${packet.bull_base_bear.bear.target_price}</div>
                          <div className="text-sm text-red-700 mt-1">{packet.bull_base_bear.bear.description}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modules */}
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Research Modules</div>
                    <div className="flex flex-wrap gap-2">
                      {MODULES.map((module) => {
                        const isComplete = packet.modules_completed.includes(module.id);
                        return (
                          <span
                            key={module.id}
                            className={cn(
                              'px-3 py-1 rounded text-sm',
                              isComplete
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-400'
                            )}
                          >
                            {module.name}
                          </span>
                        );
                      })}
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
