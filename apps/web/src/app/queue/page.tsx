'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Screen 2: Research Queue (Lane B Input)
 * 
 * Shows promoted ideas awaiting deep research with:
 * - Queue position
 * - Estimated processing time
 * - Status (pending, in_progress, completed)
 */

interface QueueItem {
  idea_id: string;
  ticker: string;
  company_name: string;
  style_tag: string;
  promoted_at: string;
  queue_position: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  estimated_completion?: string;
  agents_completed?: number;
  total_agents: number;
}

// Mock data
const MOCK_QUEUE: QueueItem[] = [
  {
    idea_id: '1',
    ticker: 'NVDA',
    company_name: 'NVIDIA Corporation',
    style_tag: 'quality',
    promoted_at: new Date(Date.now() - 3600000).toISOString(),
    queue_position: 1,
    status: 'in_progress',
    agents_completed: 4,
    total_agents: 7,
  },
  {
    idea_id: '2',
    ticker: 'META',
    company_name: 'Meta Platforms Inc',
    style_tag: 'growth',
    promoted_at: new Date(Date.now() - 7200000).toISOString(),
    queue_position: 2,
    status: 'pending',
    total_agents: 7,
  },
];

export default function QueuePage() {
  const { data: queue, isLoading } = useQuery({
    queryKey: ['research-queue'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return MOCK_QUEUE;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Play className="h-5 w-5 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Research Queue</h1>
        <p className="text-gray-600">Lane B input - Promoted ideas awaiting deep research</p>
      </div>

      {/* Quota Info */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {queue?.filter((q) => q.status === 'pending').length || 0}
          </div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {queue?.filter((q) => q.status === 'in_progress').length || 0}
          </div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            3/10
          </div>
          <div className="text-sm text-gray-600">Weekly Quota Used</div>
        </div>
      </div>

      {/* Queue List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600">Loading queue...</div>
      ) : queue?.length === 0 ? (
        <div className="text-center py-12 text-gray-600">No items in queue</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Style
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Promoted At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {queue?.map((item) => (
                <tr key={item.idea_id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-lg font-bold text-gray-900">
                      #{item.queue_position}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{item.ticker}</div>
                    <div className="text-sm text-gray-500">{item.company_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                      {item.style_tag}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(item.status)}
                      <span className={cn('px-2 py-1 text-xs font-medium rounded', getStatusColor(item.status))}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.status === 'in_progress' && (
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>{item.agents_completed}/{item.total_agents} agents</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${((item.agents_completed || 0) / item.total_agents) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {item.status === 'pending' && (
                      <span className="text-sm text-gray-500">Waiting...</span>
                    )}
                    {item.status === 'completed' && (
                      <span className="text-sm text-green-600">Done</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.promoted_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Research Agents Info */}
      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Research Agents</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            'Business Model',
            'Industry & Moat',
            'Financial Forensics',
            'Capital Allocation',
            'Management Quality',
            'Valuation',
            'Risk & Stress',
          ].map((agent, idx) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-900">{agent}</div>
              <div className="text-xs text-gray-500">Agent {idx + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
