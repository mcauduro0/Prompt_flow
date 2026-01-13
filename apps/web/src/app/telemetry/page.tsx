'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

// ============================================================================
// TYPES
// ============================================================================

interface LLMProviderStats {
  provider: string;
  model: string;
  count: number;
  tokens: number;
  cost: number;
  avg_latency_ms: number;
  success_rate: number;
}

interface InstitutionalPromptMetrics {
  prompt_id: string;
  lane: string;
  stage: string;
  model: string;
  expected_value_score: number;
  expected_cost_score: number;
  value_cost_ratio: number;
  status_institucional: string;
}

interface TelemetryStats {
  total_executions: number;
  success_rate: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  by_llm: LLMProviderStats[];
  by_lane: Record<string, {
    count: number;
    tokens: number;
    cost: number;
    success_rate: number;
  }>;
  top_value_prompts: InstitutionalPromptMetrics[];
  quality_metrics: {
    overall_quality_score: number;
    gate_pass_rate: number;
    ideas_generated: number;
    research_completed: number;
    avg_conviction_score: number;
  };
  lane_funnel: {
    lane_a_runs: number;
    ideas_generated: number;
    ideas_promoted: number;
    lane_b_runs: number;
    research_completed: number;
    conversion_rate: number;
  };
  recent_errors: Array<{
    prompt_id: string;
    error: string;
    created_at: string;
  }>;
}

interface BudgetStatus {
  daily_limit_usd: number;
  daily_spent_usd: number;
  daily_remaining_usd: number;
  monthly_limit_usd: number;
  monthly_spent_usd: number;
  monthly_remaining_usd: number;
  llm_calls_allowed: boolean;
  estimated_calls_remaining: number;
  by_provider: Record<string, {
    daily_spent: number;
    monthly_spent: number;
  }>;
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle,
  status = 'neutral'
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
}) {
  const statusColors = {
    good: 'text-emerald-400',
    warning: 'text-amber-400',
    critical: 'text-red-400',
    neutral: 'text-foreground',
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`text-2xl font-semibold mt-1 ${statusColors[status]}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function ProgressBar({ 
  value, 
  max, 
  label,
  status = 'neutral'
}: { 
  value: number; 
  max: number; 
  label: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const barColors = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    neutral: 'bg-accent',
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${barColors[status]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function LLMProviderCard({ provider }: { provider: LLMProviderStats }) {
  const providerColors: Record<string, string> = {
    openai: 'border-emerald-500/30 bg-emerald-500/5',
    google: 'border-blue-500/30 bg-blue-500/5',
    anthropic: 'border-orange-500/30 bg-orange-500/5',
  };

  const providerLabels: Record<string, string> = {
    openai: 'OpenAI',
    google: 'Google Gemini',
    anthropic: 'Anthropic Claude',
  };

  return (
    <div className={`border rounded-lg p-4 ${providerColors[provider.provider] || 'border-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-foreground">
          {providerLabels[provider.provider] || provider.provider}
        </h4>
        <span className="text-xs text-muted-foreground font-mono">
          {provider.model}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Executions</p>
          <p className="font-semibold text-foreground">{provider.count}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Success Rate</p>
          <p className={`font-semibold ${provider.success_rate >= 90 ? 'text-emerald-400' : provider.success_rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
            {provider.success_rate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Tokens</p>
          <p className="font-semibold text-foreground">{provider.tokens.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cost</p>
          <p className="font-semibold text-foreground">${provider.cost.toFixed(4)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-muted-foreground">Avg Latency</p>
          <p className="font-semibold text-foreground">{(provider.avg_latency_ms / 1000).toFixed(2)}s</p>
        </div>
      </div>
    </div>
  );
}

function LaneFunnelChart({ funnel }: { funnel: TelemetryStats['lane_funnel'] }) {
  const maxValue = Math.max(funnel.lane_a_runs, funnel.ideas_generated, funnel.lane_b_runs, 1);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-24 text-sm text-muted-foreground">Lane A Runs</div>
        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
          <div 
            className="h-full bg-blue-500 flex items-center justify-end pr-2"
            style={{ width: `${(funnel.lane_a_runs / maxValue) * 100}%` }}
          >
            <span className="text-xs text-white font-medium">{funnel.lane_a_runs}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="w-24 text-sm text-muted-foreground">Ideas Generated</div>
        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
          <div 
            className="h-full bg-emerald-500 flex items-center justify-end pr-2"
            style={{ width: `${(funnel.ideas_generated / maxValue) * 100}%` }}
          >
            <span className="text-xs text-white font-medium">{funnel.ideas_generated}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="w-24 text-sm text-muted-foreground">Lane B Runs</div>
        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
          <div 
            className="h-full bg-purple-500 flex items-center justify-end pr-2"
            style={{ width: `${(funnel.lane_b_runs / maxValue) * 100}%` }}
          >
            <span className="text-xs text-white font-medium">{funnel.lane_b_runs}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="w-24 text-sm text-muted-foreground">Research Done</div>
        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
          <div 
            className="h-full bg-amber-500 flex items-center justify-end pr-2"
            style={{ width: `${(funnel.research_completed / maxValue) * 100}%` }}
          >
            <span className="text-xs text-white font-medium">{funnel.research_completed}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopPromptsTable({ prompts }: { prompts: InstitutionalPromptMetrics[] }) {
  const statusColors: Record<string, string> = {
    core: 'text-emerald-400',
    supporting: 'text-blue-400',
    optional: 'text-muted-foreground',
    experimental: 'text-amber-400',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-muted-foreground font-medium">Prompt</th>
            <th className="text-left py-2 px-3 text-muted-foreground font-medium">Lane</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Value</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Cost</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ratio</th>
            <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {prompts.map((prompt, i) => (
            <tr key={prompt.prompt_id} className="border-b border-border/50 hover:bg-secondary/20">
              <td className="py-2 px-3 font-mono text-xs">{prompt.prompt_id}</td>
              <td className="py-2 px-3">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  prompt.lane === 'lane_a' ? 'bg-blue-500/20 text-blue-400' :
                  prompt.lane === 'lane_b' ? 'bg-purple-500/20 text-purple-400' :
                  prompt.lane === 'portfolio' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {prompt.lane}
                </span>
              </td>
              <td className="py-2 px-3 text-right">{prompt.expected_value_score.toFixed(2)}</td>
              <td className="py-2 px-3 text-right">{prompt.expected_cost_score.toFixed(2)}</td>
              <td className="py-2 px-3 text-right font-semibold text-emerald-400">
                {prompt.value_cost_ratio.toFixed(2)}
              </td>
              <td className={`py-2 px-3 ${statusColors[prompt.status_institucional]}`}>
                {prompt.status_institucional}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertBanner({ alerts }: { alerts: BudgetStatus['alerts'] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert, i) => (
        <div 
          key={i}
          className={`p-3 rounded-lg border ${
            alert.type === 'critical' 
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {alert.type === 'critical' ? '⚠️ Critical' : '⚡ Warning'}
            </span>
            <span className="text-sm">{alert.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function TelemetryPage() {
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    fetchTelemetryData();
    const interval = setInterval(fetchTelemetryData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  async function fetchTelemetryData() {
    try {
      const [statsRes, budgetRes] = await Promise.all([
        fetch(`/api/telemetry/stats?range=${timeRange}`),
        fetch('/api/telemetry/budget'),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudget(data);
      }
    } catch (error) {
      console.error('Failed to fetch telemetry data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Empty state defaults
  const displayStats: TelemetryStats = stats || {
    total_executions: 0,
    success_rate: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    avg_latency_ms: 0,
    by_llm: [],
    by_lane: {},
    top_value_prompts: [],
    quality_metrics: {
      overall_quality_score: 0,
      gate_pass_rate: 0,
      ideas_generated: 0,
      research_completed: 0,
      avg_conviction_score: 0,
    },
    lane_funnel: {
      lane_a_runs: 0,
      ideas_generated: 0,
      ideas_promoted: 0,
      lane_b_runs: 0,
      research_completed: 0,
      conversion_rate: 0,
    },
    recent_errors: [],
  };

  const displayBudget: BudgetStatus = budget || {
    daily_limit_usd: 50,
    daily_spent_usd: 0,
    daily_remaining_usd: 50,
    monthly_limit_usd: 500,
    monthly_spent_usd: 0,
    monthly_remaining_usd: 500,
    llm_calls_allowed: true,
    estimated_calls_remaining: 1000,
    by_provider: {},
    alerts: [],
  };

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <header className="border-b border-border px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                Telemetry Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time system metrics and LLM performance
              </p>
            </div>
            
            {/* Time Range Selector */}
            <div className="flex items-center gap-1 bg-secondary/30 rounded-lg p-1">
              {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    timeRange === range
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-8">
          {loading ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground animate-pulse">Loading telemetry data...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Alerts */}
              <AlertBanner alerts={displayBudget.alerts} />

              {/* Overview Stats */}
              <section>
                <h2 className="text-lg font-medium text-foreground mb-4">Overview</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <StatCard
                    title="Total Executions"
                    value={displayStats.total_executions}
                    status="neutral"
                  />
                  <StatCard
                    title="Success Rate"
                    value={`${displayStats.success_rate.toFixed(1)}%`}
                    status={displayStats.success_rate >= 90 ? 'good' : displayStats.success_rate >= 70 ? 'warning' : 'critical'}
                  />
                  <StatCard
                    title="Total Tokens"
                    value={displayStats.total_tokens.toLocaleString()}
                    status="neutral"
                  />
                  <StatCard
                    title="Total Cost"
                    value={`$${displayStats.total_cost_usd.toFixed(4)}`}
                    status="neutral"
                  />
                  <StatCard
                    title="Ideas Generated"
                    value={displayStats.quality_metrics.ideas_generated}
                    status="good"
                  />
                  <StatCard
                    title="Research Done"
                    value={displayStats.quality_metrics.research_completed}
                    status="good"
                  />
                </div>
              </section>

              {/* LLM Provider Breakdown */}
              <section>
                <h2 className="text-lg font-medium text-foreground mb-4">LLM Provider Performance</h2>
                {displayStats.by_llm.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {displayStats.by_llm.map((provider) => (
                      <LLMProviderCard key={provider.provider} provider={provider} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-card border border-border rounded-lg">
                    <p className="text-muted-foreground">No LLM executions recorded yet</p>
                  </div>
                )}
              </section>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Lane Funnel */}
                <section className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-lg font-medium text-foreground mb-4">Lane Funnel</h2>
                  <LaneFunnelChart funnel={displayStats.lane_funnel} />
                </section>

                {/* Budget Status */}
                <section className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-lg font-medium text-foreground mb-4">Budget Status</h2>
                  <div className="space-y-4">
                    <ProgressBar
                      value={displayBudget.daily_spent_usd}
                      max={displayBudget.daily_limit_usd}
                      label={`Daily Budget ($${displayBudget.daily_spent_usd.toFixed(2)} / $${displayBudget.daily_limit_usd})`}
                      status={
                        displayBudget.daily_spent_usd / displayBudget.daily_limit_usd >= 0.9 ? 'critical' :
                        displayBudget.daily_spent_usd / displayBudget.daily_limit_usd >= 0.7 ? 'warning' : 'good'
                      }
                    />
                    <ProgressBar
                      value={displayBudget.monthly_spent_usd}
                      max={displayBudget.monthly_limit_usd}
                      label={`Monthly Budget ($${displayBudget.monthly_spent_usd.toFixed(2)} / $${displayBudget.monthly_limit_usd})`}
                      status={
                        displayBudget.monthly_spent_usd / displayBudget.monthly_limit_usd >= 0.9 ? 'critical' :
                        displayBudget.monthly_spent_usd / displayBudget.monthly_limit_usd >= 0.7 ? 'warning' : 'good'
                      }
                    />
                    
                    {/* Budget by Provider */}
                    {Object.keys(displayBudget.by_provider).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground mb-2">Cost by Provider (Today)</p>
                        <div className="space-y-2">
                          {Object.entries(displayBudget.by_provider).map(([provider, data]) => (
                            <div key={provider} className="flex justify-between text-sm">
                              <span className="text-foreground capitalize">{provider}</span>
                              <span className="text-muted-foreground">${data.daily_spent.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">LLM Calls Allowed</span>
                        <span className={`text-sm font-medium ${displayBudget.llm_calls_allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                          {displayBudget.llm_calls_allowed ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">Est. Calls Remaining</span>
                        <span className="text-sm font-medium text-foreground">
                          ~{displayBudget.estimated_calls_remaining}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Top Value Prompts */}
              <section className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-medium text-foreground mb-4">
                  Top Value/Cost Ratio Prompts
                </h2>
                {displayStats.top_value_prompts.length > 0 ? (
                  <TopPromptsTable prompts={displayStats.top_value_prompts} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No prompt metrics available</p>
                  </div>
                )}
              </section>

              {/* Recent Errors */}
              {displayStats.recent_errors.length > 0 && (
                <section className="bg-card border border-border rounded-lg p-6">
                  <h2 className="text-lg font-medium text-foreground mb-4">Recent Errors</h2>
                  <div className="space-y-2">
                    {displayStats.recent_errors.map((error, i) => (
                      <div key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-mono text-red-400">{error.prompt_id}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(error.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-red-300">{error.error}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
