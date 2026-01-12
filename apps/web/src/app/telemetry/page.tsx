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

interface QualityMetrics {
  overall_quality_score: number;
  gate_pass_rate: number;
  validation_pass_rate: number;
  data_sufficiency_rate: number;
  coherence_rate: number;
  edge_claim_rate: number;
  style_fit_rate: number;
}

interface LaneOutcomeStats {
  total: number;
  byLane: Record<string, number>;
  byOutcome: Record<string, number>;
  avgQualityScore: number;
  avgCostPerOutcome: number;
  ideasGenerated: number;
  researchCompleted: number;
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
  qualityMetrics?: QualityMetrics;
  laneOutcomeStats?: LaneOutcomeStats;
}

interface BudgetStatus {
  daily_limit_usd: number;
  daily_spent_usd: number;
  daily_remaining_usd: number;
  monthly_limit_usd: number;
  monthly_spent_usd: number;
  monthly_remaining_usd: number;
  token_limit_per_run: number;
  llm_calls_allowed: boolean;
  estimated_calls_remaining: number;
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

interface QuarantineStats {
  total: number;
  pending: number;
  escalated: number;
  resolved: number;
  byPriority: Record<string, number>;
  pendingRetries: number;
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

function QualityGauge({ 
  score, 
  label 
}: { 
  score: number; 
  label: string;
}) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-emerald-500';
    if (s >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="text-center">
      <div className="relative w-20 h-20 mx-auto">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${score * 2.26} 226`}
            className={getBgColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-semibold ${getColor(score)}`}>
            {score}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
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

function GatePassRateBar({ 
  name, 
  rate 
}: { 
  name: string; 
  rate: number;
}) {
  const percentage = rate * 100;
  const status = percentage >= 80 ? 'good' : percentage >= 60 ? 'warning' : 'critical';
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-32 truncate">{name}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            status === 'good' ? 'bg-emerald-500' :
            status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-sm w-12 text-right ${
        status === 'good' ? 'text-emerald-400' :
        status === 'warning' ? 'text-amber-400' : 'text-red-400'
      }`}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function TelemetryPage() {
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [quarantine, setQuarantine] = useState<QuarantineStats | null>(null);
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
      const [statsRes, budgetRes, executionsRes, quarantineRes] = await Promise.all([
        fetch(`/api/telemetry/stats?range=${timeRange}`),
        fetch('/api/telemetry/budget'),
        fetch(`/api/telemetry/executions?limit=20&range=${timeRange}`),
        fetch('/api/telemetry/quarantine'),
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

      if (quarantineRes.ok) {
        const data = await quarantineRes.json();
        setQuarantine(data);
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
    qualityMetrics: {
      overall_quality_score: 78,
      gate_pass_rate: 0.85,
      validation_pass_rate: 0.92,
      data_sufficiency_rate: 0.95,
      coherence_rate: 0.88,
      edge_claim_rate: 0.72,
      style_fit_rate: 0.80,
    },
    laneOutcomeStats: {
      total: 45,
      byLane: { lane_a: 30, lane_b: 15 },
      byOutcome: { idea_generated: 25, research_complete: 12, idea_rejected: 5, research_partial: 3 },
      avgQualityScore: 76,
      avgCostPerOutcome: 0.28,
      ideasGenerated: 25,
      researchCompleted: 12,
    },
  };

  const mockBudget: BudgetStatus = budget || {
    daily_limit_usd: 50,
    daily_spent_usd: 12.45,
    daily_remaining_usd: 37.55,
    monthly_limit_usd: 500,
    monthly_spent_usd: 156.78,
    monthly_remaining_usd: 343.22,
    token_limit_per_run: 100000,
    llm_calls_allowed: true,
    estimated_calls_remaining: 150,
    alerts: [],
  };

  const mockQuarantine: QuarantineStats = quarantine || {
    total: 12,
    pending: 5,
    escalated: 2,
    resolved: 5,
    byPriority: { critical: 1, high: 3, medium: 5, low: 3 },
    pendingRetries: 3,
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

  const qualityMetrics = mockStats.qualityMetrics!;
  const laneOutcomes = mockStats.laneOutcomeStats!;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Telemetry</h1>
            <p className="text-sm text-muted-foreground mt-1">
              System performance, quality metrics, and cost monitoring
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

        {/* LLM Status Banner */}
        {!mockBudget.llm_calls_allowed && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-lg">⛔</span>
              <div>
                <p className="text-red-400 font-medium">LLM Calls Disabled</p>
                <p className="text-sm text-red-400/80">Budget exceeded. Only code functions are allowed.</p>
              </div>
            </div>
          </div>
        )}

        {/* Quality Score Overview */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Quality Metrics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Gauges */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">Quality Scores</h3>
              <div className="flex justify-around">
                <QualityGauge score={qualityMetrics.overall_quality_score} label="Overall" />
                <QualityGauge score={Math.round(qualityMetrics.gate_pass_rate * 100)} label="Gates" />
                <QualityGauge score={Math.round(qualityMetrics.validation_pass_rate * 100)} label="Validation" />
              </div>
            </div>

            {/* Gate Pass Rates */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">Gate Pass Rates</h3>
              <div className="space-y-3">
                <GatePassRateBar name="Data Sufficiency" rate={qualityMetrics.data_sufficiency_rate} />
                <GatePassRateBar name="Coherence" rate={qualityMetrics.coherence_rate} />
                <GatePassRateBar name="Edge Claim" rate={qualityMetrics.edge_claim_rate} />
                <GatePassRateBar name="Style Fit" rate={qualityMetrics.style_fit_rate} />
              </div>
            </div>
          </div>
        </section>

        {/* Lane Outcomes */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Lane Outcomes</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              title="Ideas Generated" 
              value={laneOutcomes.ideasGenerated}
              subtitle="Lane A output"
              status="good"
            />
            <StatCard 
              title="Research Completed" 
              value={laneOutcomes.researchCompleted}
              subtitle="Lane B output"
              status="good"
            />
            <StatCard 
              title="Avg Quality Score" 
              value={laneOutcomes.avgQualityScore}
              subtitle="0-100 scale"
              status={laneOutcomes.avgQualityScore >= 75 ? 'good' : laneOutcomes.avgQualityScore >= 60 ? 'warning' : 'critical'}
            />
            <StatCard 
              title="Cost per Outcome" 
              value={`$${laneOutcomes.avgCostPerOutcome.toFixed(2)}`}
              subtitle="avg cost"
            />
          </div>
        </section>

        {/* Budget Overview */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Budget Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Estimated Capacity</h3>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-semibold ${mockBudget.llm_calls_allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {mockBudget.estimated_calls_remaining}
                </span>
                <span className="text-sm text-muted-foreground">calls remaining</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {mockBudget.llm_calls_allowed ? 'LLM calls enabled' : 'LLM calls disabled'}
              </p>
            </div>
          </div>
        </section>

        {/* Quarantine Status */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Quarantine Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard 
              title="Total Quarantined" 
              value={mockQuarantine.total}
            />
            <StatCard 
              title="Pending Review" 
              value={mockQuarantine.pending}
              status={mockQuarantine.pending > 10 ? 'warning' : 'neutral'}
            />
            <StatCard 
              title="Escalated" 
              value={mockQuarantine.escalated}
              status={mockQuarantine.escalated > 0 ? 'critical' : 'good'}
            />
            <StatCard 
              title="Pending Retries" 
              value={mockQuarantine.pendingRetries}
            />
            <StatCard 
              title="Resolved" 
              value={mockQuarantine.resolved}
              status="good"
            />
          </div>
        </section>

        {/* Key Metrics */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-foreground mb-4">Execution Metrics</h2>
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
              { name: 'Social Trends', status: 'online', latency: 1200 },
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
