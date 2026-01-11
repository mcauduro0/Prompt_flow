'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Screen 4: Run History (Audit Trail)
 * 
 * Shows all DAG runs with:
 * - Run ID, type, status
 * - Timing (started, duration)
 * - Counts (ideas generated, promoted, etc.)
 * - Error logs
 */

interface RunRecord {
  run_id: string;
  dag_name: string;
  status: 'success' | 'failure' | 'running' | 'partial';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  stats: {
    ideas_generated?: number;
    ideas_promoted?: number;
    ideas_rejected?: number;
    packets_created?: number;
    errors?: number;
  };
  error_log?: string[];
}

// Mock data
const MOCK_RUNS: RunRecord[] = [
  {
    run_id: 'run_001',
    dag_name: 'daily_discovery',
    status: 'success',
    started_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 3000000).toISOString(),
    duration_ms: 600000,
    stats: {
      ideas_generated: 45,
      ideas_promoted: 3,
      ideas_rejected: 12,
    },
  },
  {
    run_id: 'run_002',
    dag_name: 'daily_lane_b',
    status: 'success',
    started_at: new Date(Date.now() - 7200000).toISOString(),
    completed_at: new Date(Date.now() - 5400000).toISOString(),
    duration_ms: 1800000,
    stats: {
      packets_created: 2,
    },
  },
  {
    run_id: 'run_003',
    dag_name: 'daily_discovery',
    status: 'failure',
    started_at: new Date(Date.now() - 86400000).toISOString(),
    completed_at: new Date(Date.now() - 86100000).toISOString(),
    duration_ms: 300000,
    stats: {
      ideas_generated: 0,
      errors: 1,
    },
    error_log: [
      'FMP API rate limit exceeded',
      'Retrying in 60 seconds...',
      'Max retries exceeded, aborting run',
    ],
  },
  {
    run_id: 'run_004',
    dag_name: 'weekly_ic_bundle',
    status: 'success',
    started_at: new Date(Date.now() - 172800000).toISOString(),
    completed_at: new Date(Date.now() - 172500000).toISOString(),
    duration_ms: 300000,
    stats: {},
  },
];

export default function RunsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterDag, setFilterDag] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: runs, isLoading, refetch } = useQuery({
    queryKey: ['run-history'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return MOCK_RUNS;
    },
  });

  const filteredRuns = runs?.filter((run) => {
    if (filterDag !== 'all' && run.dag_name !== filterDag) return false;
    if (filterStatus !== 'all' && run.status !== filterStatus) return false;
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failure':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'running':
        return <Play className="h-5 w-5 text-blue-600" />;
      case 'partial':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failure':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDagColor = (dag: string) => {
    switch (dag) {
      case 'daily_discovery':
        return 'bg-blue-100 text-blue-800';
      case 'daily_lane_b':
        return 'bg-green-100 text-green-800';
      case 'weekly_ic_bundle':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Run History</h1>
          <p className="text-gray-600">Audit trail of all DAG runs</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* DAG Filter */}
          <select
            value={filterDag}
            onChange={(e) => setFilterDag(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All DAGs</option>
            <option value="daily_discovery">Lane A (Discovery)</option>
            <option value="daily_lane_b">Lane B (Research)</option>
            <option value="weekly_ic_bundle">IC Bundle</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="running">Running</option>
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
          <div className="text-2xl font-bold text-gray-900">{runs?.length || 0}</div>
          <div className="text-sm text-gray-600">Total Runs</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {runs?.filter((r) => r.status === 'success').length || 0}
          </div>
          <div className="text-sm text-gray-600">Successful</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">
            {runs?.filter((r) => r.status === 'failure').length || 0}
          </div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {runs?.filter((r) => r.status === 'running').length || 0}
          </div>
          <div className="text-sm text-gray-600">Running</div>
        </div>
      </div>

      {/* Runs List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600">Loading runs...</div>
      ) : filteredRuns?.length === 0 ? (
        <div className="text-center py-12 text-gray-600">No runs found</div>
      ) : (
        <div className="space-y-4">
          {filteredRuns?.map((run) => (
            <div
              key={run.run_id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Main Row */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(run.status)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm text-gray-600">{run.run_id}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getDagColor(run.dag_name))}>
                        {run.dag_name}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStatusColor(run.status))}>
                        {run.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(run.started_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-6">
                  {run.duration_ms && (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatDuration(run.duration_ms)}
                      </div>
                      <div className="text-xs text-gray-500">Duration</div>
                    </div>
                  )}
                  {run.stats.ideas_generated !== undefined && (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {run.stats.ideas_generated}
                      </div>
                      <div className="text-xs text-gray-500">Ideas</div>
                    </div>
                  )}
                  {run.stats.packets_created !== undefined && (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {run.stats.packets_created}
                      </div>
                      <div className="text-xs text-gray-500">Packets</div>
                    </div>
                  )}
                  {run.stats.errors !== undefined && run.stats.errors > 0 && (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">
                        {run.stats.errors}
                      </div>
                      <div className="text-xs text-gray-500">Errors</div>
                    </div>
                  )}
                </div>

                {/* Expand */}
                <button
                  onClick={() => setExpandedId(expandedId === run.run_id ? null : run.run_id)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  {expandedId === run.run_id ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              {expandedId === run.run_id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {/* Timing */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">Timing</div>
                      <div className="space-y-1 text-sm">
                        <div>Started: {new Date(run.started_at).toLocaleString()}</div>
                        {run.completed_at && (
                          <div>Completed: {new Date(run.completed_at).toLocaleString()}</div>
                        )}
                        {run.duration_ms && (
                          <div>Duration: {formatDuration(run.duration_ms)}</div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">Statistics</div>
                      <div className="space-y-1 text-sm">
                        {Object.entries(run.stats).map(([key, value]) => (
                          <div key={key}>
                            {key.replace(/_/g, ' ')}: {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Error Log */}
                  {run.error_log && run.error_log.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-sm font-medium text-red-800 mb-2">Error Log</div>
                      <div className="font-mono text-xs text-red-700 space-y-1">
                        {run.error_log.map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
