"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Server, Database, Cpu, Activity, CheckCircle, XCircle, AlertCircle, 
  Clock, DollarSign, Zap, RefreshCw, ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthStatus {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  last_updated: string;
}

interface Provider {
  name: string;
  status: 'connected' | 'error' | 'not_configured';
  last_check: string;
  requests_today: number;
  rate_limit: number;
}

interface SystemInfo {
  version: string;
  environment: string;
  uptime_seconds: number;
  memory_usage_mb: number;
}

interface LLMProvider {
  name: string;
  model: string;
  status: string;
  prompts_assigned: number;
  cost_per_1m_input: number;
  cost_per_1m_output: number;
}

interface DataProvider {
  name: string;
  type: string;
  status: string;
  capabilities: string[];
}

interface RunRecord {
  run_id: string;
  lane: string;
  ticker?: string;
  status: 'completed' | 'failed' | 'running';
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  tokens_used: number;
  cost_usd: number;
  prompts_executed: number;
  ideas_generated?: number;
  error_message?: string;
}

interface RunStats {
  total_runs: number;
  completed: number;
  failed: number;
  total_tokens: number;
  total_cost: number;
  avg_duration_ms: number;
}

const statusIcons = {
  connected: CheckCircle,
  active: CheckCircle,
  error: XCircle,
  not_configured: AlertCircle,
};

const statusColors = {
  connected: 'text-emerald-400',
  active: 'text-emerald-400',
  error: 'text-red-400',
  not_configured: 'text-amber-400',
};

const laneColors: Record<string, string> = {
  lane_a: 'bg-blue-500/10 text-blue-400',
  lane_b: 'bg-purple-500/10 text-purple-400',
  portfolio: 'bg-emerald-500/10 text-emerald-400',
  monitoring: 'bg-amber-500/10 text-amber-400',
  utility: 'bg-gray-500/10 text-gray-400',
};

export default function SystemPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [llmProviders, setLLMProviders] = useState<LLMProvider[]>([]);
  const [dataProviders, setDataProviders] = useState<DataProvider[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'providers' | 'runs'>('status');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch system status
      const statusRes = await fetch('/api/system/status');
      if (statusRes.ok) {
        const data = await statusRes.json();
        setHealth(data.health);
        setProviders(data.providers || []);
        setSystemInfo(data.system || null);
      }

      // Fetch provider details
      const providersRes = await fetch('/api/system/providers');
      if (providersRes.ok) {
        const data = await providersRes.json();
        setLLMProviders(data.llm_providers || []);
        setDataProviders(data.data_providers || []);
      }

      // Fetch runs
      const runsRes = await fetch('/api/system/runs?limit=20');
      if (runsRes.ok) {
        const data = await runsRes.json();
        setRuns(data.runs || []);
        setRunStats(data.stats || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse-calm">Loading system status...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-3">
                  <h1 className="text-2xl font-medium text-foreground tracking-tight">
                    System & Runs
                  </h1>
                  {health && (
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium capitalize",
                      health.status === 'healthy' && "bg-emerald-500/10 text-emerald-400",
                      health.status === 'degraded' && "bg-amber-500/10 text-amber-400",
                      health.status === 'critical' && "bg-red-500/10 text-red-400"
                    )}>
                      {health.status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Data providers, LLM status, and execution history
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md text-sm transition-calm"
              >
                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-8 pb-4">
            <div className="flex items-center gap-1">
              {(['status', 'providers', 'runs'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-sm rounded-md transition-calm capitalize",
                    activeTab === tab
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-8">
          <div className="max-w-6xl mx-auto px-8">
            {activeTab === 'status' && (
              <StatusTab 
                health={health} 
                systemInfo={systemInfo} 
                providers={providers}
                runStats={runStats}
              />
            )}
            {activeTab === 'providers' && (
              <ProvidersTab 
                llmProviders={llmProviders} 
                dataProviders={dataProviders} 
              />
            )}
            {activeTab === 'runs' && (
              <RunsTab runs={runs} stats={runStats} />
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

interface StatusTabProps {
  health: HealthStatus | null;
  systemInfo: SystemInfo | null;
  providers: Provider[];
  runStats: RunStats | null;
}

function StatusTab({ health, systemInfo, providers, runStats }: StatusTabProps) {
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-8">
      {/* Health overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Health Score</span>
          </div>
          <p className={cn(
            "text-2xl font-medium",
            health?.score && health.score >= 80 ? "text-emerald-400" :
            health?.score && health.score >= 50 ? "text-amber-400" : "text-red-400"
          )}>
            {health?.score?.toFixed(0) || 0}%
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Server className="w-4 h-4" />
            <span className="text-sm">Version</span>
          </div>
          <p className="text-2xl font-medium text-foreground">
            {systemInfo?.version || 'N/A'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Uptime</span>
          </div>
          <p className="text-2xl font-medium text-foreground">
            {systemInfo ? formatUptime(systemInfo.uptime_seconds) : 'N/A'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Cpu className="w-4 h-4" />
            <span className="text-sm">Memory</span>
          </div>
          <p className="text-2xl font-medium text-foreground">
            {systemInfo?.memory_usage_mb || 0} MB
          </p>
        </div>
      </div>

      {/* Provider status grid */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Service Status</h3>
        <div className="grid grid-cols-2 gap-4">
          {providers.map((provider) => {
            const StatusIcon = statusIcons[provider.status] || AlertCircle;
            return (
              <div 
                key={provider.name}
                className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <StatusIcon className={cn("w-5 h-5", statusColors[provider.status])} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{provider.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{provider.status.replace('_', ' ')}</p>
                  </div>
                </div>
                {provider.status === 'connected' && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Rate limit</p>
                    <p className="text-sm text-foreground">{provider.rate_limit}/day</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Run stats */}
      {runStats && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Execution Summary</h3>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Runs</p>
              <p className="text-lg font-medium text-foreground">{runStats.total_runs}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-medium text-emerald-400">{runStats.completed}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-lg font-medium text-red-400">{runStats.failed}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Tokens</p>
              <p className="text-lg font-medium text-foreground">{runStats.total_tokens.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="text-lg font-medium text-foreground">${runStats.total_cost.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProvidersTabProps {
  llmProviders: LLMProvider[];
  dataProviders: DataProvider[];
}

function ProvidersTab({ llmProviders, dataProviders }: ProvidersTabProps) {
  return (
    <div className="space-y-8">
      {/* LLM Providers */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">LLM Providers</h3>
        </div>
        <div className="divide-y divide-border/50">
          {llmProviders.map((provider) => {
            const StatusIcon = statusIcons[provider.status as keyof typeof statusIcons] || AlertCircle;
            return (
              <div key={provider.name} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <StatusIcon className={cn("w-5 h-5", statusColors[provider.status as keyof typeof statusColors])} />
                    <div>
                      <p className="font-medium text-foreground">{provider.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{provider.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Prompts</p>
                      <p className="text-sm font-medium text-foreground">{provider.prompts_assigned}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Input</p>
                      <p className="text-sm font-medium text-foreground">${provider.cost_per_1m_input}/1M</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Output</p>
                      <p className="text-sm font-medium text-foreground">${provider.cost_per_1m_output}/1M</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Providers */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Data Providers</h3>
        </div>
        <div className="divide-y divide-border/50">
          {dataProviders.map((provider) => {
            const StatusIcon = statusIcons[provider.status as keyof typeof statusIcons] || AlertCircle;
            return (
              <div key={provider.name} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <StatusIcon className={cn("w-5 h-5", statusColors[provider.status as keyof typeof statusColors])} />
                    <div>
                      <p className="font-medium text-foreground">{provider.name}</p>
                      <p className="text-sm text-muted-foreground">{provider.type}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-w-md justify-end">
                    {provider.capabilities.map((cap) => (
                      <span 
                        key={cap}
                        className="text-xs px-2 py-0.5 bg-secondary rounded text-muted-foreground"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface RunsTabProps {
  runs: RunRecord[];
  stats: RunStats | null;
}

function RunsTab({ runs, stats }: RunsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">No execution history yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
          <span>Total: <span className="text-foreground font-medium">{stats.total_runs}</span></span>
          <span>Tokens: <span className="text-foreground font-medium">{stats.total_tokens.toLocaleString()}</span></span>
          <span>Cost: <span className="text-foreground font-medium">${stats.total_cost.toFixed(2)}</span></span>
          <span>Avg Duration: <span className="text-foreground font-medium">{(stats.avg_duration_ms / 1000).toFixed(1)}s</span></span>
        </div>
      )}

      {/* Runs list */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-8 gap-4 px-4 py-3 bg-secondary/30 border-b border-border text-sm font-medium text-muted-foreground">
          <div className="col-span-2">Run ID</div>
          <div>Lane</div>
          <div>Status</div>
          <div>Duration</div>
          <div>Tokens</div>
          <div>Cost</div>
          <div></div>
        </div>

        <div className="divide-y divide-border/50">
          {runs.map((run) => (
            <div key={run.run_id} className={cn("transition-colors", expandedId === run.run_id && "bg-secondary/20")}>
              <div 
                className="grid grid-cols-8 gap-4 px-4 py-3 text-sm cursor-pointer hover:bg-secondary/10"
                onClick={() => setExpandedId(expandedId === run.run_id ? null : run.run_id)}
              >
                <div className="col-span-2 font-mono text-foreground truncate" title={run.run_id}>
                  {run.run_id.slice(0, 8)}...
                  {run.ticker && <span className="ml-2 text-muted-foreground">({run.ticker})</span>}
                </div>
                <div>
                  <span className={cn("px-2 py-0.5 rounded text-xs", laneColors[run.lane])}>
                    {run.lane.replace('lane_', '').toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs",
                    run.status === 'completed' && "bg-emerald-500/10 text-emerald-400",
                    run.status === 'failed' && "bg-red-500/10 text-red-400",
                    run.status === 'running' && "bg-blue-500/10 text-blue-400"
                  )}>
                    {run.status}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {(run.duration_ms / 1000).toFixed(1)}s
                </div>
                <div className="text-muted-foreground">
                  {run.tokens_used.toLocaleString()}
                </div>
                <div className="text-muted-foreground">
                  ${run.cost_usd.toFixed(4)}
                </div>
                <div className="flex justify-end">
                  <ChevronRight className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    expandedId === run.run_id && "rotate-90"
                  )} />
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === run.run_id && (
                <div className="px-4 pb-4">
                  <div className="ml-4 p-4 bg-secondary/30 rounded-lg">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Started</p>
                        <p className="text-foreground">{new Date(run.started_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Completed</p>
                        <p className="text-foreground">
                          {run.completed_at ? new Date(run.completed_at).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Prompts Executed</p>
                        <p className="text-foreground">{run.prompts_executed}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Ideas Generated</p>
                        <p className="text-foreground">{run.ideas_generated || 'N/A'}</p>
                      </div>
                    </div>
                    {run.error_message && (
                      <div className="mt-4 p-3 bg-red-500/10 rounded border border-red-500/20">
                        <p className="text-xs text-red-400 mb-1">Error</p>
                        <p className="text-sm text-foreground">{run.error_message}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
