'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

// ============================================================================
// TYPES
// ============================================================================

interface TelemetryEntry {
  id: string;
  run_id: string;
  prompt_id: string;
  execution_type: 'llm' | 'code' | 'hybrid';
  provider?: string;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_usd: number;
  success: boolean;
  error?: string;
  created_at: string;
}

interface TelemetryStats {
  total_executions: number;
  success_rate: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  by_provider: Record<string, {
    count: number;
    tokens: number;
    cost: number;
    avg_latency: number;
  }>;
  by_prompt: Record<string, {
    count: number;
    success_rate: number;
    avg_latency: number;
  }>;
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
  token_limit_per_run: number;
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
  trend,
  status = 'neutral'
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  trend?: string;
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
      {trend && (
        <p className="text-xs text-muted-foreground mt-1">{trend}</p>
      )}
    </div>
  );
}

function ProgressBar({ 
  value, 
  max, 
  label,
  showPercentage = true,
  status = 'neutral'
}: { 
  value: number; 
  max: number; 
  label: string;
  showPercentage?: boolean;
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
        {showPercentage && (
          <span className="text-foreground">{percentage.toFixed(1)}%</span>
        )}
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
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
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
  const [recentExecutions, setRecentExecutions] = useState<TelemetryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    fetchTelemetryData();
    const interval = setInterval(fetchTelemetryData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [timeRange]);

  async function fetchTelemetryData() {
    try {
      const [statsRes, budgetRes, executionsRes] = await Promise.all([
        fetch(`/api/telemetry/stats?range=${timeRange}`),
        fetch('/api/telemetry/budget'),
        fetch(`/api/telemetry/executions?limit=20&range=${timeRange}`),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudget(data);
      }

      if (executionsRes.ok) {
        const data = await executionsRes.json();
        setRecentExecutions(data.executions || []);
      }
    } catch (error) {
      console.error('Failed to fetch telemetry data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Mock data for initial display
  const mockStats: TelemetryStats = stats || {
    total_executions: 156,
    success_rate: 94.2,
    total_tokens: 245000,
    total_cost_usd: 12.45,
    avg_latency_ms: 2340,
    by_provider: {
      openai: { count: 120, tokens: 180000, cost: 9.50, avg_latency: 2100 },
      anthropic: { count: 36, tokens: 65000, cost: 2.95, avg_latency: 3200 },
    },
    by_prompt: {
      lane_a_idea_generation: { count: 45, success_rate: 96, avg_latency: 1800 },
      business_model_analysis: { count: 32, success_rate: 94, avg_latency: 2500 },
      valuation_analysis: { count: 28, success_rate: 92, avg_latency: 2800 },
    },
    recent_errors: [],
  };

  const mockBudget: BudgetStatus = budget || {
    daily_limit_usd: 50,
    daily_spent_usd: 12.45,
    daily_remaining_usd: 37.55,
    monthly_limit_usd: 500,
    monthly_spent_usd: 156.78,
    monthly_remaining_usd: 343.22,
    token_limit_per_run: 100000,
    alerts: [],
  };

  const dailyBudgetStatus = mockBudget.daily_spent_usd / mockBudget.daily_limit_usd > 0.9 
    ? 'critical' 
    : mockBudget.daily_spent_usd / mockBudget.daily_limit_usd > 0.7 
      ? 'warning' 
      : 'good';

  const monthlyBudgetStatus = mockBudget.monthly_spent_usd / mockBudget.monthly_limit_usd > 0.9 
    ? 'critical' 
    : mockBudget.monthly_spent_usd / mockBudget.monthly_limit_usd > 0.7 
      ? 'warning' 
      : 'good';

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Telemetry</h1>
            <p className="text-sm text-muted-foreground mt-1">
              System performance and cost monitoring
            </p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['1h', '24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Budget Alerts */}
        <AlertBanner alerts={mockBudget.alerts} />

        {/* Budget Overview */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Budget Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Daily Budget</h3>
              <ProgressBar 
                value={mockBudget.daily_spent_usd} 
                max={mockBudget.daily_limit_usd}
                label={`$${mockBudget.daily_spent_usd.toFixed(2)} / $${mockBudget.daily_limit_usd.toFixed(2)}`}
                status={dailyBudgetStatus}
              />
              <p className="text-xs text-muted-foreground mt-2">
                ${mockBudget.daily_remaining_usd.toFixed(2)} remaining today
              </p>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Monthly Budget</h3>
              <ProgressBar 
                value={mockBudget.monthly_spent_usd} 
                max={mockBudget.monthly_limit_usd}
                label={`$${mockBudget.monthly_spent_usd.toFixed(2)} / $${mockBudget.monthly_limit_usd.toFixed(2)}`}
                status={monthlyBudgetStatus}
              />
              <p className="text-xs text-muted-foreground mt-2">
                ${mockBudget.monthly_remaining_usd.toFixed(2)} remaining this month
              </p>
            </div>
          </div>
        </section>

        {/* Key Metrics */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Key Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              title="Total Executions" 
              value={mockStats.total_executions.toLocaleString()}
              subtitle={`in last ${timeRange}`}
            />
            <StatCard 
              title="Success Rate" 
              value={`${mockStats.success_rate.toFixed(1)}%`}
              status={mockStats.success_rate >= 95 ? 'good' : mockStats.success_rate >= 90 ? 'warning' : 'critical'}
            />
            <StatCard 
              title="Total Tokens" 
              value={`${(mockStats.total_tokens / 1000).toFixed(0)}K`}
              subtitle="input + output"
            />
            <StatCard 
              title="Avg Latency" 
              value={`${(mockStats.avg_latency_ms / 1000).toFixed(1)}s`}
              status={mockStats.avg_latency_ms < 3000 ? 'good' : mockStats.avg_latency_ms < 5000 ? 'warning' : 'critical'}
            />
          </div>
        </section>

        {/* Provider Breakdown */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">By Provider</h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted-foreground p-3">Provider</th>
                  <th className="text-right text-sm font-medium text-muted-foreground p-3">Executions</th>
                  <th className="text-right text-sm font-medium text-muted-foreground p-3">Tokens</th>
                  <th className="text-right text-sm font-medium text-muted-foreground p-3">Cost</th>
                  <th className="text-right text-sm font-medium text-muted-foreground p-3">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mockStats.by_provider).map(([provider, data]) => (
                  <tr key={provider} className="border-b border-border last:border-0">
                    <td className="p-3 text-sm text-foreground capitalize">{provider}</td>
                    <td className="p-3 text-sm text-foreground text-right">{data.count}</td>
                    <td className="p-3 text-sm text-foreground text-right">{(data.tokens / 1000).toFixed(0)}K</td>
                    <td className="p-3 text-sm text-foreground text-right">${data.cost.toFixed(2)}</td>
                    <td className="p-3 text-sm text-foreground text-right">{(data.avg_latency / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Prompt Performance */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Prompt Performance</h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted-foreground p-3">Prompt</th>
                  <th className="text-right text-sm font-medium text-muted-foreground p-3">Executions</th>
                  <th className="text-right text-sm font-medium text-muted-foreground p-3">Success Rate</th>
                  <th className="text-right text-sm font-medium text-muted-foreground p-3">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mockStats.by_prompt).map(([prompt, data]) => (
                  <tr key={prompt} className="border-b border-border last:border-0">
                    <td className="p-3 text-sm text-foreground">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {prompt}
                      </code>
                    </td>
                    <td className="p-3 text-sm text-foreground text-right">{data.count}</td>
                    <td className="p-3 text-sm text-right">
                      <span className={
                        data.success_rate >= 95 ? 'text-emerald-400' : 
                        data.success_rate >= 90 ? 'text-amber-400' : 'text-red-400'
                      }>
                        {data.success_rate}%
                      </span>
                    </td>
                    <td className="p-3 text-sm text-foreground text-right">{(data.avg_latency / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Errors */}
        {mockStats.recent_errors.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-medium text-foreground mb-4">Recent Errors</h2>
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              {mockStats.recent_errors.map((error, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-red-400">✕</span>
                  <div>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {error.prompt_id}
                    </code>
                    <p className="text-muted-foreground mt-1">{error.error}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(error.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Data Sources Status */}
        <section>
          <h2 className="text-lg font-medium text-foreground mb-4">Data Sources</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'FMP', status: 'online', latency: 120 },
              { name: 'Polygon', status: 'online', latency: 85 },
              { name: 'SEC EDGAR', status: 'online', latency: 340 },
              { name: 'FRED', status: 'online', latency: 95 },
              { name: 'Reddit', status: 'online', latency: 450 },
              { name: 'Twitter', status: 'degraded', latency: 1200 },
              { name: 'Perplexity', status: 'online', latency: 2100 },
              { name: 'OpenAI', status: 'online', latency: 1800 },
            ].map((source) => (
              <div key={source.name} className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{source.name}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    source.status === 'online' ? 'bg-emerald-400' :
                    source.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {source.latency}ms avg
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
